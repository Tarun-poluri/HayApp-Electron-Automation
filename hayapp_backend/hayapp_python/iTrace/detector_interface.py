import ctypes
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, computed_field

from hayapp_python.common.config_manager import DETECTOR_PATH
from hayapp_python.common.config_manager import config as hayapp_config
from hayapp_python.common.defs import NeedleResponseType as DetectionType
from hayapp_python.common.utils import (
    collect_detector_data,
    get_local_time_string,
    update_subdict,
    use_thread,
)
from hayapp_python.iTrace.exceptions import (
    ITraceDetectError,
    ITraceNotEnabledError,
)

OBJECT_TO_IMAGE_RATIO = hayapp_config.itrace.object_to_image_ratio
OBJECT_PIXEL_COUNT = hayapp_config.itrace.object_pixel_count

# Configure logging
logger = logging.getLogger("hayapp")


class BaseMetaResponse(BaseModel):
    id: str
    timestamp_ms: int = Field(
        alias="timestamp", description="Timestamp in milliseconds since epoch"
    )


class NeedleMetaResponse(BaseMetaResponse):
    number_of_objects_found: int
    key: Literal["ANALYZE_HAYSTACK_IMAGE_RESULT"]


class CheckEmptyMetaResponse(BaseMetaResponse):
    key: Literal["ANALYZE_CHECK_EMPTY_RESULT"]


class BaseResult(BaseModel):

    analyze_elapsed_time_ms: int
    configfile_used: str
    grey_image_brightness: float
    image_filename_used: str
    image_pixels_per_mm: float
    needle_decode_nResult: int
    needle_decode_error_string: Optional[str] = None


class CheckEmptyResult(BaseResult, BaseModel):
    """
    Result from check-empty analysis. Fields are optional because they are only
    present when the DLL successfully performs the empty check.
    """

    object_pixel_count: Optional[int] = None
    object_to_image_ratio: Optional[float] = None


class NeedleResult(BaseResult, BaseModel):
    """
    Result from needle analysis. Fields are optional because they are only
    present when a needle is successfully detected (needle_decode_nResult == 0).
    """

    avg_suture_color_rgb: Optional[list[float]] = None
    needle_arc_length_px: Optional[float] = None
    needle_box_length_px: Optional[float] = None
    needle_box_width_px: Optional[float] = None
    needle_chord_to_top_of_curve_mm: Optional[float] = None
    needle_chord_to_top_of_curve_px: Optional[float] = None
    needle_inside_contour_area_px: Optional[int | float] = None
    needle_length_mm: Optional[float] = None
    needle_length_px: Optional[float] = None
    needle_point_to_tail_chord_length_mm: Optional[float] = None
    needle_point_to_tail_chord_length_px: Optional[float] = None
    needle_radius_mm: Optional[float] = None
    needle_radius_px: Optional[float] = None
    needle_result_image_filename: Optional[str] = None
    needle_segment_size_percent: Optional[float] = None
    needle_swage_xy: Optional[list[float]] = None
    needle_theoritical_circumference_mm: Optional[float] = None
    needle_theoritical_circumference_px: Optional[float] = None
    needle_tip_xy: Optional[list[float]] = None
    needle_top_of_arc_xy: Optional[list[float]] = None
    needle_widest_point_mm: Optional[float] = None
    needle_widest_point_px: Optional[float] = None
    needle_width_to_length_ratio: Optional[float] = None
    object_pixel_count: Optional[int] = None
    object_to_image_ratio: Optional[float] = None


class NeedleBodyResponse(BaseModel):
    results: BaseResult | list[NeedleResult]
    configuration: dict[str, Any]


class NeedleAnalysisResponse(BaseModel):
    meta: NeedleMetaResponse
    raw: NeedleBodyResponse = Field(alias="body")

    @computed_field
    @property
    # if result.needle_decode_nResult == 0
    def results(self) -> list[NeedleResult]:
        return [result for result in self.raw.results]

    @computed_field
    @property
    def error_string(self) -> Optional[str]:
        if (
            isinstance(self.raw.results, BaseResult)
            and self.meta.key == "ANALYZE_HAYSTACK_IMAGE_RESULT"
        ):
            return self.raw.results.needle_decode_error_string
        return None

    @computed_field
    @property
    def errors(self) -> list[str]:
        return [
            result.needle_decode_error_string
            for result in self.raw.results
            if result.needle_decode_nResult != 0
        ]

    @computed_field
    @property
    def error_codes(self) -> list[int]:
        return [
            result.needle_decode_nResult
            for result in self.raw.results
            if result.needle_decode_nResult != 0
        ]

    @computed_field
    @property
    def timestamp(self) -> datetime:
        return datetime.fromtimestamp(self.meta.timestamp_ms / 1000, tz=timezone.utc)

    @computed_field
    @property
    def received_time(self) -> str:
        return get_local_time_string(self.meta.timestamp_ms)

    @computed_field
    @property
    def object_count(self) -> int:
        return self.meta.number_of_objects_found

    @computed_field
    @property
    def not_a_needle_count(self) -> int:
        return len(
            [result for result in self.raw.results if result.needle_decode_nResult in (0x7105,)]
        )

    @computed_field
    @property
    def needle_count(self) -> int:
        return len([result for result in self.raw.results if result.needle_decode_nResult == 0])

    @computed_field
    @property
    def response_type(self) -> str:
        if not self.error_string:
            if self.object_count == 0:
                return DetectionType.NO_OBJECTS
            elif self.needle_count == self.object_count and self.object_count > 0:
                return (
                    DetectionType.SINGLE_NEEDLE
                    if self.needle_count == 1
                    else DetectionType.MULTIPLE_NEEDLES
                )
            # if self.not_a_needle_count == self.object_count and self.object_count > 0:
            #     return (
            #         DetectionType.SINGLE_SHARP
            #         if self.not_a_needle_count == 1
            #         else DetectionType.MULTIPLE_SHARPS
            #     )
            elif self.object_count == 1:
                return DetectionType.SINGLE_SHARP
            elif self.object_count > 1:
                return DetectionType.MULTIPLE_SHARPS
            return DetectionType.MIXED_OBJECTS
        return DetectionType.ERROR

    @computed_field
    @property
    def id(self) -> str:
        return self.meta.id


class CheckEmptyBodyResponse(BaseModel):
    results: CheckEmptyResult
    configuration: dict[str, Any]


class CheckEmptyResponse(BaseModel):
    meta: CheckEmptyMetaResponse
    raw: CheckEmptyBodyResponse = Field(alias="body")

    @computed_field
    @property
    def is_success(self) -> bool:
        if (
            self.raw.results.object_pixel_count is None
            or self.raw.results.object_to_image_ratio is None
        ):
            return False
        return (
            self.raw.results.object_pixel_count <= OBJECT_PIXEL_COUNT
            and self.raw.results.object_to_image_ratio <= OBJECT_TO_IMAGE_RATIO
        )

    @computed_field
    @property
    def error_code(self) -> int:
        return self.raw.results.needle_decode_nResult

    @computed_field
    @property
    def error_string(self) -> str:
        return self.raw.results.needle_decode_error_string


class DetectorInterface:
    """
    Interface for iTrace needle detection.

    This class provides methods to analyze needles
    in images using the underlying C/C++ libraries.

    Attributes:
        project_dir: Directory containing the iTrace module
        needle_detector_dll_path: Path to needle detector shared library
        needle_config_path: Path to needle detector configuration

    Methods:
        detect_enabled: Check if the detect functionality is enabled
        analyze_needle: Analyze needle in an image
        analyze_reference_image: Analyze a reference image
        set_reference_image: Set the reference image for the iTrace library
        get_reference_image: Get the reference image for the iTrace library
        _analyze: Internal method to analyze needles using ctypes
    """

    def __init__(
        self,
        needle_detector_dll_path: str,
        needle_config_path: str,
    ):
        """
        Initialize the detector interface.

        Args:
            needle_detector_dll_path: Path to needle detector shared library
            needle_config_path: Path to needle detector configuration

        Raises:
            ITraceConfigError: If configuration cannot be loaded
            ITraceNotEnabledError: If required libraries are not found
        """
        self.project_dir = DETECTOR_PATH
        self.needle_detector_dll_path: Path = Path(needle_detector_dll_path)
        self.needle_config_path: str = needle_config_path
        self._itrace_interface: Optional[ctypes.WinDLL] = None
        self._reference_image: Optional[Path] = None

        if not self.needle_detector_dll_path.exists():
            logger.warning(f"Needle detector library not found at {self.needle_detector_dll_path}")
        else:
            self._initialize_interface()

    def _initialize_interface(self):
        """
        Initialize the iTrace interface
        """
        # Add DLL directory to search path for dependent DLLs (Windows only)
        dll_dir = self.needle_detector_dll_path.parent
        if sys.platform == "win32" and hasattr(os, "add_dll_directory"):
            # Python 3.8+ on Windows
            os.add_dll_directory(str(dll_dir))
            logger.info(f"Added DLL directory to search path: {dll_dir}")

        self._itrace_interface = ctypes.WinDLL(str(self.needle_detector_dll_path))
        self._itrace_interface.AnalyzeNeedleImage_Export.argtypes = [
            ctypes.c_char_p,  # filename
            ctypes.c_char_p,  # configFilename
            ctypes.c_double,  # pixPerMM
            ctypes.c_int,  # checkEmpty
        ]
        # We return void_p (raw pointer) so we can manually pass it back to FreeStringMemory
        self._itrace_interface.AnalyzeNeedleImage_Export.restype = ctypes.c_void_p
        self._itrace_interface.FreeStringMemory.argtypes = [ctypes.c_void_p]
        self._itrace_interface.FreeStringMemory.restype = None

    def set_reference_image(self, image: str | Path):
        """
        Set the reference image for the iTrace library
        :param image: Path to the image file
        :return: None
        """
        if isinstance(image, str):
            image_path = Path(image)
        elif isinstance(image, Path):
            image_path = image
        else:
            raise TypeError(f"Invalid image path: {image}")
        if not image_path.exists():
            raise FileNotFoundError(f"Image file not found: {image_path}")
        image_path_str = str(image_path)
        if image_path.resolve().is_relative_to(self.project_dir):
            image_path_str = "./" + image_path_str

        self._set_needle_config_value(
            ["NeedleDetectorConfig", "FlatFieldCorrection", "whiteImageFilename"], image_path_str
        )
        self._reference_image = image_path

    def get_reference_image(self) -> str:
        """
        Get the reference image for the iTrace library
        :return: Path to the reference image
        """
        return self._get_needle_config_value(
            ["NeedleDetectorConfig", "FlatFieldCorrection", "whiteImageFilename"]
        )

    def _get_needle_config_value(self, dict_path: list[str]) -> str:
        """
        Get a value from the needle config
        :param dict_path: Path to the dictionary value
        :return: Value
        """
        needle_file_path = Path(self.needle_config_path)
        if not needle_file_path.exists():
            raise FileNotFoundError(f"Needle file path not found: {needle_file_path}")
        with open(needle_file_path, "r") as file:
            needle_data: dict[str, Any] = json.load(file)
            for key in dict_path:
                needle_data = needle_data[key]
            return needle_data

    def _set_needle_config_value(self, dict_path: list[str], value: str):
        """
        Set a value in the needle config
        :param dict_path: Path to the dictionary value
        :param value: Value to set
        :return: None
        """
        # Read the needle file path from the config
        needle_file_path = Path(self.needle_config_path)
        if not needle_file_path.exists():
            raise FileNotFoundError(f"Needle file path not found: {needle_file_path}")
        # Read file and parse as JSON
        with open(needle_file_path, "r") as file:
            needle_data: dict[str, Any] = json.load(file)

        # Set the value
        update_subdict(needle_data, dict_path, value)

        # Write the needle data back to the file
        with open(needle_file_path, "w") as file:
            json.dump(needle_data, file, indent=4)

    def detect_enabled(self) -> bool:
        """
        Check if the detect functionality is enabled.
        """
        return self._itrace_interface is not None

    def analyze_needle(self, image_path: str, pix_per_mm: float) -> NeedleAnalysisResponse:
        """
        Analyze needle in an image.

        Args:
            image_path: Path to the image file
            pix_per_mm: Pixels per millimeter calibration value

        Returns:
            NeedleAnalysisResult with count and any errors

        Raises:
            ITraceNotEnabledError: If analyze functionality is not enabled
            ITraceDetectError: If the DLL returns a null pointer
        """
        needle_results = self._analyze(
            image_path=image_path, pix_per_mm=pix_per_mm, check_empty=False
        )
        response = NeedleAnalysisResponse.model_validate(json.loads(needle_results))
        use_thread(
            collect_detector_data,
            image_path,
            self.needle_config_path,
            self._reference_image,
            needle_results,
        )
        return response

    def analyze_reference_image(self, image_path: str, pix_per_mm: float) -> CheckEmptyResponse:
        """
        Analyze a reference image.

        Args:
            image_path: Path to the image file
            pix_per_mm: Pixels per millimeter calibration value

        Returns:
            CheckEmptyResult with analysis results

        Raises:
            ITraceNotEnabledError: If analyze functionality is not enabled
            ITraceDetectError: If the DLL returns a null pointer
        """
        empty_results = self._analyze(
            image_path=image_path, pix_per_mm=pix_per_mm, check_empty=True
        )

        response = CheckEmptyResponse.model_validate(json.loads(empty_results))
        use_thread(
            collect_detector_data,
            image_path,
            self.needle_config_path,
            self._reference_image,
            empty_results,
        )
        return response

    def _analyze(self, image_path: str, pix_per_mm: float, check_empty: bool = False) -> str:
        """
        Calls the DLL to analyze the image.
        check_empty defaults to False (0) per requirements.

        Raises:
            ITraceNotEnabledError: If analyze functionality is not enabled
            ITraceDetectError: If the DLL returns a null pointer
        """
        if not self.detect_enabled():
            raise ITraceNotEnabledError("Analyze functionality is not enabled")

        # Convert Python types to C-compatible types
        f_bytes = image_path.encode("utf-8")
        c_bytes = self.needle_config_path.encode("utf-8")
        check_empty_int = 1 if check_empty else 0
        logger.info(
            (
                f"[NeedleDetector] File: {image_path}, "
                f"Config: {self.needle_config_path}, "
                f"Pix Per MM: {pix_per_mm}, "
                f"Check Empty: {check_empty}"
            )
        )

        # Execute DLL function
        res_ptr = self._itrace_interface.AnalyzeNeedleImage_Export(
            f_bytes, c_bytes, ctypes.c_double(pix_per_mm), ctypes.c_int(check_empty_int)
        )

        if not res_ptr:
            raise ITraceDetectError("DLL returned a null pointer")

        # Extract the string content from the pointer
        result_str = ctypes.string_at(res_ptr).decode("utf-8")
        # IMPORTANT: Free the memory allocated on the DLL heap
        self._itrace_interface.FreeStringMemory(res_ptr)
        logger.info(f"[NeedleDetector] Result: {result_str}")
        return result_str
