# -*- coding: utf-8 -*-
import logging
import time
from dataclasses import asdict
from pathlib import Path
from typing import Any

from parlay import ParlayCommandItem, ParlayProperty, local_item, parlay_command

from hayapp_python.common.config_manager import config
from hayapp_python.common.defs import DecoderAdapter_item as item
from hayapp_python.common.events import ImageDecodedEvent, TimerImageDecodedEvent
from hayapp_python.common.parlay_mixin import ThreadSafePublishMixin
from hayapp_python.iTrace.decoder_interface import DecodeResult, DecoderInterface
from hayapp_python.iTrace.exceptions import (
    ITraceConfigError,
    ITraceDecodeError,
    ITraceNotEnabledError,
)

logger = logging.getLogger("hayapp")


@local_item()
class DecoderAdapter(ThreadSafePublishMixin, ParlayCommandItem):
    """
    Parlay adapter for mark decoding
    """

    __version__: str = "0.0.1"

    decode_enabled = ParlayProperty(default=False, val_type=bool, read_only=True)
    auth_key_path = ParlayProperty(default="", val_type=str, read_only=True)
    decode_flags = ParlayProperty(default="", val_type=str, read_only=True)
    mark_config_path = ParlayProperty(default="", val_type=str, read_only=True)
    mark_decoder_dll_path = ParlayProperty(default="", val_type=str, read_only=True)
    company_id = ParlayProperty(default=67, val_type=int, read_only=True)
    mark_type = ParlayProperty(default="82f", val_type=str, read_only=True)
    version = ParlayProperty(default="", val_type=str, read_only=True)
    decoded_mark_count = ParlayProperty(default=0, val_type=int, read_only=True)

    def __init__(self, item_id: int = item.id, name: str = item.name):
        ParlayCommandItem.__init__(self, item_id=item_id, name=name)

        self.initialize_decoder()
        self.version = self.get_library_version()

    # ###############################################################################
    # iTrace Library Commands
    # ###############################################################################

    @parlay_command()
    def decode_mark(self, image: str, check_empty: bool = False) -> dict[str, Any]:
        """
        Decode iTrace mark from an image
        :param image: Path to the image file
        :return: Dict with 'serial', 'results', and 'pix_per_mm' keys
        """
        if self._decoder_interface is None:
            raise RuntimeError("Decoder interface is not initialized")

        try:
            start = time.perf_counter()
            result = self._decoder_interface.decode_mark(image)
            execution_duration_ms = (time.perf_counter() - start) * 1000
            # Publish timer event for image decoded
            self.decoded_mark_count += 1
            self.send_event(
                **TimerImageDecodedEvent(execution_duration_ms=execution_duration_ms).to_event()
            )
            self.send_event(**ImageDecodedEvent(image, result.pix_per_mm, check_empty).to_event())
            return asdict(result)
        except (ITraceNotEnabledError, ITraceDecodeError) as e:
            raise RuntimeError(f"Failed to decode mark: {e}") from e

    @parlay_command()
    def get_library_version(self) -> str:
        """
        Get the version of the iTrace decoder library
        :return: Version string
        """
        if self._decoder_interface is None:
            raise RuntimeError("Decoder interface is not initialized")
        return self._decoder_interface.get_version() or "Unknown"

    @parlay_command()
    def initialize_decoder(self):
        """
        Initialize the decoder interface
        """
        try:
            self.auth_key_path = config.itrace.decoder_key_path
            self.decode_flags = config.itrace.decoder_flags
            self.mark_config_path = config.itrace.decoder_config_path
            self.mark_decoder_dll_path = config.itrace.decoder_dll_path
            self.company_id = config.itrace.company_id
            self.mark_type = config.itrace.mark_type

            self._decoder_interface = DecoderInterface(
                mark_decoder_dll_path=self.mark_decoder_dll_path,
                auth_key_path=self.auth_key_path,
                decode_flags=self.decode_flags,
                mark_config_path=self.mark_config_path,
                company_id=self.company_id,
                mark_type=self.mark_type,
            )
            self.decode_enabled = self._decoder_interface.decode_enabled()

            return self.decode_enabled
        except ITraceConfigError as e:
            raise RuntimeError(f"Failed to initialize decoder: {e}") from e


class MockDecoderAdapter(DecoderAdapter):
    """
    Mock decoder adapter that simulates mark decoding without requiring the actual DLL.
    This allows for cross-platform testing and development.
    """

    def __init__(self, item_id: int = item.id, name: str = item.name):
        """Initialize the mock decoder without calling the parent's DLL initialization."""
        ParlayCommandItem.__init__(self, item_id=item_id, name=name)
        self.version = self.__version__
        self.decode_enabled = True
        self._decoder_interface = None
        logger.info("MockDecoderAdapter initialized for cross-platform testing")

    @parlay_command()
    def decode_mark(self, image: str, check_empty: bool = False) -> dict[str, Any]:
        """
        Mock decode iTrace mark from an image
        :param image: Path to the image file
        :param check_empty: Whether this is a check empty operation
        :return: Dict with 'serial', 'results', and 'pix_per_mm' keys
        """
        logger.info(f"Mock decoding image: {image}")

        start = time.perf_counter()

        # Verify image exists
        image_path = Path(image)
        if not image_path.exists():
            logger.warning(f"Mock decoder: Image not found at {image}")
            result = DecodeResult(
                serial=None, results={"error": "Image not found"}, pix_per_mm=None, is_success=False
            )
        else:
            mock_serial = "MOCK-12345-TEST-67890"
            mock_pix_per_mm = 24.5  # Typical pixels per mm value

            mock_results = {
                "image_filename": str(image_path),
                "decode_time_ms": 125,
                "confidence": 0.95,
                "mock_mode": True,
            }

            result = DecodeResult(
                serial=mock_serial, results=mock_results, pix_per_mm=mock_pix_per_mm
            )

        execution_duration_ms = (time.perf_counter() - start) * 1000

        # Publish events just like the real decoder
        self.decoded_mark_count += 1
        self.send_event(
            **TimerImageDecodedEvent(execution_duration_ms=execution_duration_ms).to_event()
        )
        self.send_event(**ImageDecodedEvent(image, result.pix_per_mm, check_empty).to_event())

        logger.info(
            f"Mock decode result: serial={result.serial}, pix_per_mm={result.pix_per_mm}, "
            f"success={result.is_success}"
        )
        return asdict(result)

    @parlay_command()
    def initialize_decoder(self):
        """
        Mock initialize the decoder interface
        """
        logger.info("Mock decoder initialization complete (no DLL required)")
        self.decode_enabled = True
        return True
