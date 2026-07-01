# -*- coding: utf-8 -*-
import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from parlay import ParlayCommandItem, ParlayProperty, local_item, parlay_command

from hayapp_python.common.config_manager import config
from hayapp_python.common.defs import DetectorAdapter_item as item
from hayapp_python.common.events import (
    ImageAnalyzedEvent,
    ImageDecodedEvent,
    TimerImageAnalyzedEvent,
)
from hayapp_python.common.parlay_mixin import ThreadSafePublishMixin
from hayapp_python.iTrace import decoder_adapter
from hayapp_python.iTrace.detector_interface import (
    CheckEmptyMetaResponse,
    CheckEmptyResponse,
    CheckEmptyResult,
    DetectorInterface,
    NeedleAnalysisResponse,
    NeedleMetaResponse,
    NeedleResult,
)
from hayapp_python.iTrace.exceptions import (
    ITraceConfigError,
    ITraceDetectError,
    ITraceNotEnabledError,
)

logger = logging.getLogger("hayapp")


@local_item()
class DetectorAdapter(ThreadSafePublishMixin, ParlayCommandItem):
    """
    Parlay adapter for iTrace needle detection
    """

    __version__: str = "0.0.1"

    detect_enabled = ParlayProperty(default=False, val_type=bool, read_only=True)
    needle_config_path = ParlayProperty(default="", val_type=str, read_only=True)
    needle_detector_dll_path = ParlayProperty(default="", val_type=str, read_only=True)
    version = ParlayProperty(default="", val_type=str, read_only=True)
    analyzed_count = ParlayProperty(default=0, val_type=int, read_only=True)

    def __init__(self, item_id: int = item.id, name: str = item.name):
        ParlayCommandItem.__init__(self, item_id=item_id, name=name)

        self.version = self.__version__
        self.initialize_detector()
        self.subscribe(self.on_decoded_event, MSG_TYPE="EVENT", FROM=decoder_adapter.item.id)

    # ###############################################################################
    # iTrace Library Commands
    # ###############################################################################

    def on_decoded_event(self, event: dict[str, dict[str, Any]]):
        """
        Handle a decoded event from the decoder adapter
        Spawns a background thread for analysis to not block the sharps movement
        """
        if (
            decoded_event := ImageDecodedEvent.from_event(event.get("CONTENTS", {}))
        ) and decoded_event is not None:
            # Run analysis in background thread to not block sharps movement
            if not decoded_event.check_empty:
                analysis_thread = threading.Thread(
                    target=self._analyze_needle_async,
                    args=(decoded_event.image, decoded_event.pix_per_mm),
                    daemon=True,
                )
                analysis_thread.start()

    def _analyze_needle_async(self, image: str, pix_per_mm: float):
        """
        Internal method to run needle analysis in background thread
        Catches exceptions and logs errors without propagating them
        """
        try:
            self.analyze_needle(image, pix_per_mm)
        except Exception as e:
            print(f"Error during background needle analysis: {e}")

    @parlay_command()
    def analyze_needle(self, image: str, pix_per_mm: float) -> dict[str, Any]:
        """
        Analyze needle image (detect needle)
        :param image: Path to the image file
        :param pix_per_mm: Pixels per millimeter calibration value
        :return: Dictionary with 'needle_count', 'error', and 'results' keys
        """
        if self._detector_interface is None:
            raise RuntimeError("iTrace interface is not initialized")

        try:
            start = time.perf_counter()
            result = self._detector_interface.analyze_needle(
                image_path=image, pix_per_mm=pix_per_mm
            )
            execution_duration_ms = (time.perf_counter() - start) * 1000
            self.analyzed_count += 1
            enriched_result = {
                **result.model_dump(mode="json"),
                "image_number": self.analyzed_count,
            }
            self.send_event(**ImageAnalyzedEvent(result=enriched_result).to_event())
            self.send_event(
                **TimerImageAnalyzedEvent(
                    execution_duration_ms=result.raw.results[0].analyze_elapsed_time_ms
                ).to_event()
            )
            logger.info(
                "Needle analysis duration: Reported("
                + f"{result.raw.results[0].analyze_elapsed_time_ms} ms) Actual("
                + f"{execution_duration_ms} ms)"
            )
            return enriched_result
        except (ITraceNotEnabledError, ITraceDetectError) as e:
            raise RuntimeError(str(e))

    @parlay_command()
    def analyze_reference_image(self, image: str, pix_per_mm: float) -> dict[str, Any]:
        """
        Analyze reference image (detect empty)
        :param image: Path to the image file
        :param pix_per_mm: Pixels per millimeter calibration value
        :return: Dictionary
        """
        if self._detector_interface is None:
            raise RuntimeError("iTrace interface is not initialized")

        try:
            start = time.perf_counter()
            result: CheckEmptyResponse = self._detector_interface.analyze_reference_image(
                image_path=image, pix_per_mm=pix_per_mm
            )
            execution_duration_ms = (time.perf_counter() - start) * 1000
            self.send_event(
                **TimerImageAnalyzedEvent(execution_duration_ms=execution_duration_ms).to_event()
            )
            return result.model_dump()
        except (ITraceNotEnabledError, ITraceDetectError) as e:
            raise RuntimeError(str(e))

    @parlay_command()
    def initialize_detector(self) -> bool:
        """
        Initialize the detector interface
        """
        try:
            self.needle_detector_dll_path = config.itrace.needle_detector_dll_path
            self.needle_config_path = config.itrace.needle_detector_config_path

            self._detector_interface = DetectorInterface(
                needle_detector_dll_path=self.needle_detector_dll_path,
                needle_config_path=self.needle_config_path,
            )
            self.detect_enabled = self._detector_interface.detect_enabled()
            return self.detect_enabled
        except ITraceConfigError as e:
            raise RuntimeError(f"Failed to initialize detector: {e}") from e

    @parlay_command()
    def set_reference_image(self, image: str | Path):
        """
        Set the reference image for the iTrace library
        :param image: Path to the image file
        :return: None
        """
        self._detector_interface.set_reference_image(image)

    @parlay_command()
    def reset_analyzed_count(self):
        self.analyzed_count = 0
        return True


class MockDetectorAdapter(DetectorAdapter):
    """
    Mock detector adapter that simulates needle detection without requiring the actual DLL.
    This allows for cross-platform testing and development.
    """

    def __init__(self, item_id: int = item.id, name: str = item.name):
        """Initialize the mock detector without calling the parent's DLL initialization."""
        ParlayCommandItem.__init__(self, item_id=item_id, name=name)
        self.version = self.__version__
        self.detect_enabled = True
        self._detector_interface = None
        self.subscribe(self.on_decoded_event, MSG_TYPE="EVENT", FROM=decoder_adapter.item.id)
        logger.info("MockDetectorAdapter initialized for cross-platform testing")

    @parlay_command()
    def analyze_needle(self, image: str, pix_per_mm: float) -> dict[str, Any]:
        """
        Mock analyze needle image (detect needle)
        :param image: Path to the image file
        :param pix_per_mm: Pixels per millimeter calibration value
        :return: Dictionary with 'needle_count', 'error', and 'results' keys
        """
        logger.info(f"Mock analyzing needle image: {image}, pix_per_mm: {pix_per_mm}")

        start = time.perf_counter()

        # Verify image exists
        image_path = Path(image)
        if not image_path.exists():
            logger.warning(f"Mock detector: Image not found at {image}")
            result = NeedleAnalysisResponse(
                meta=NeedleMetaResponse(
                    id="mock-error",
                    timestamp=int(datetime.now(timezone.utc).timestamp() * 1000),
                    number_of_objects_found=0,
                    key="ANALYZE_HAYSTACK_IMAGE_RESULT",
                ),
                body={"results": [], "configuration": {}, "error": "Image not found"},
            )
        else:
            # Generate mock needle detection data - always detect 1 needle
            timestamp_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

            mock_meta = NeedleMetaResponse(
                id=f"mock-{timestamp_ms}",
                timestamp=timestamp_ms,
                number_of_objects_found=1,
                key="ANALYZE_HAYSTACK_IMAGE_RESULT",
            )

            # Create a realistic mock needle result
            mock_needle_result = NeedleResult(
                analyze_elapsed_time_ms=150,
                configfile_used="mock_config.json",
                grey_image_brightness=128.5,
                image_filename_used=str(image_path),
                image_pixels_per_mm=pix_per_mm,
                needle_decode_nResult=0,  # Success
                needle_decode_error_string=None,
                # Needle measurements (mock realistic values)
                avg_suture_color_rgb=[180.5, 175.2, 170.8],
                needle_arc_length_px=245.6,
                needle_box_length_px=234.5,
                needle_box_width_px=45.2,
                needle_chord_to_top_of_curve_mm=3.2,
                needle_chord_to_top_of_curve_px=78.4,
                needle_inside_contour_area_px=8500,
                needle_length_mm=9.5,
                needle_length_px=232.75,
                needle_point_to_tail_chord_length_mm=9.2,
                needle_point_to_tail_chord_length_px=225.4,
                needle_radius_mm=7.8,
                needle_radius_px=191.1,
                needle_result_image_filename=f"{image_path.stem}_result.jpg",
                needle_segment_size_percent=75.5,
                needle_swage_xy=[150.5, 200.3],
                needle_theoritical_circumference_mm=49.0,
                needle_theoritical_circumference_px=1200.5,
                needle_tip_xy=[375.2, 205.8],
                needle_top_of_arc_xy=[262.5, 125.4],
                needle_widest_point_mm=0.4,
                needle_widest_point_px=9.8,
                needle_width_to_length_ratio=0.042,
                object_pixel_count=8500,
                object_to_image_ratio=0.00009824,
            )

            mock_body = {"results": [mock_needle_result], "configuration": {}}
            result = NeedleAnalysisResponse(meta=mock_meta, body=mock_body)

        execution_duration_ms = (time.perf_counter() - start) * 1000

        # Update count and send events
        self.analyzed_count += 1
        enriched_result = {
            **result.model_dump(mode="json"),
            "image_number": self.analyzed_count,
            "mock_mode": True,
        }

        self.send_event(**ImageAnalyzedEvent(result=enriched_result).to_event())
        self.send_event(
            **TimerImageAnalyzedEvent(execution_duration_ms=execution_duration_ms).to_event()
        )

        logger.info(
            f"Mock analysis result: {result.meta.number_of_objects_found} needle(s) detected"
        )
        return enriched_result

    @parlay_command()
    def analyze_reference_image(self, image: str, pix_per_mm: float) -> dict[str, Any]:
        """
        Mock analyze reference image (detect empty)
        :param image: Path to the image file
        :param pix_per_mm: Pixels per millimeter calibration value
        :return: Dictionary
        """
        logger.info(f"Mock analyzing reference image: {image}, pix_per_mm: {pix_per_mm}")

        start = time.perf_counter()

        # Verify image exists
        image_path = Path(image)
        timestamp_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

        if not image_path.exists():
            logger.warning(f"Mock detector: Reference image not found at {image}")
            # Return error response
            mock_result = CheckEmptyResult(
                analyze_elapsed_time_ms=0,
                configfile_used="mock_config.json",
                grey_image_brightness=0.0,
                image_filename_used=str(image_path),
                image_pixels_per_mm=pix_per_mm,
                needle_decode_nResult=-1,
                needle_decode_error_string="Image not found",
                object_pixel_count=0,
                object_to_image_ratio=0.0,
            )
        else:
            # Generate mock check empty result
            mock_result = CheckEmptyResult(
                analyze_elapsed_time_ms=120,
                configfile_used="mock_config.json",
                grey_image_brightness=245.8,
                image_filename_used=str(image_path),
                image_pixels_per_mm=pix_per_mm,
                needle_decode_nResult=0,  # Success
                needle_decode_error_string=None,
                object_pixel_count=150,  # Small amount for reference image
                object_to_image_ratio=0.00001,  # Very small ratio
            )

        result = CheckEmptyResponse(
            meta=CheckEmptyMetaResponse(
                id=f"mock-ref-{timestamp_ms}",
                timestamp=timestamp_ms,
                key="ANALYZE_CHECK_EMPTY_RESULT",
            ),
            body={"results": mock_result, "configuration": {}},
        )

        execution_duration_ms = (time.perf_counter() - start) * 1000

        self.send_event(
            **TimerImageAnalyzedEvent(execution_duration_ms=execution_duration_ms).to_event()
        )

        logger.info(f"Mock reference analysis complete: {mock_result.object_pixel_count} pixels")
        return result.model_dump()

    @parlay_command()
    def initialize_detector(self) -> bool:
        """
        Mock initialize the detector interface
        """
        logger.info("Mock detector initialization complete (no DLL required)")
        self.detect_enabled = True
        return True

    @parlay_command()
    def set_reference_image(self, image: str | Path):
        """
        Mock set the reference image for the iTrace library
        :param image: Path to the image file
        :return: None
        """
        logger.info(f"Mock detector: Setting reference image to {image}")
