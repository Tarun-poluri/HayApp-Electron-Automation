import ctypes
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, NamedTuple, Optional

from hayapp_python.common.config_manager import DECODER_PATH
from hayapp_python.common.utils import (
    collect_decoder_data,
    use_thread,
)
from hayapp_python.iTrace.exceptions import (
    ITraceDecodeError,
    ITraceNotEnabledError,
)

# Provided via example iTrace client.py code
RESULTS_BUFFER_SIZE = 4096
SERIAL_BUFFER_SIZE = 256

# Configure logging
logger = logging.getLogger(__name__)


class _DecodeTuple(NamedTuple):
    status: int
    serial: Optional[str] = None
    results: Optional[str] = None


@dataclass
class DecodeResult:
    """Result of a mark decode operation."""

    serial: Optional[str] = None  # serial string from itrace
    results: dict[str, Any] = field(default_factory=dict[str, Any])
    pix_per_mm: Optional[float] = None
    is_success: bool = False

    def __post_init__(self):
        """Compute is_success after initialization."""
        self.is_success = (
            self.serial is not None
            and len(self.serial) > 0
            and self.pix_per_mm is not None
            and self.pix_per_mm > 0
        )


class DecoderInterface:
    """
    Interface for iTrace mark decoding.

    This class provides methods to decode iTrace marks
    in images using the underlying C/C++ libraries.

    The C++ library calls are executed in isolated subprocesses to prevent
    segfaults from crashing the main Python process.

    Attributes:
        mark_decoder_dll_path: Path to mark decoder shared library
        auth_key_path: Path to authentication key file
        decode_flags: Decode operation flags
        mark_config_path: Path to mark decoder configuration
        company_id: Company ID for license key selection (67 for Magvation)
        mark_type: Mark type identifier (82f for Magvation 2DMI marks)
    """

    def __init__(
        self,
        mark_decoder_dll_path: str,
        auth_key_path: str,
        decode_flags: str,
        mark_config_path: str,
        company_id: int = 67,
        mark_type: str = "82f",
    ):
        """
        Initialize the iTrace interface.

        Args:
            mark_decoder_dll_path: Path to mark decoder shared library
            auth_key_path: Path to authentication key file
            decode_flags: Decode operation flags
            mark_config_path: Path to mark decoder configuration
            company_id: Company ID for license key selection (default: 67 for Magvation)
            mark_type: Mark type identifier (default: 82f for Magvation 2DMI marks)

        Raises:
            ITraceConfigError: If configuration cannot be loaded
            ITraceNotEnabledError: If required libraries are not found
        """
        self.project_dir = DECODER_PATH
        self.mark_decoder_dll_path: Path = Path(mark_decoder_dll_path)
        self.auth_key_path: str = auth_key_path
        self.decode_flags: str = decode_flags
        self.mark_config_path: str = mark_config_path
        self.company_id: int = company_id
        self.mark_type: str = mark_type
        self._itrace_interface: Optional[ctypes.CDLL] = None

        if not self.mark_decoder_dll_path.exists():
            logger.warning(f"Mark decoder library not found at {self.mark_decoder_dll_path}")
            return
        self._initialize_interface()

    def _initialize_interface(self):
        """
        Initialize the iTrace interface
        """
        # Add DLL directory to search path for dependent DLLs (Windows only)
        dll_dir = self.mark_decoder_dll_path.parent
        if sys.platform == "win32" and hasattr(os, "add_dll_directory"):
            # Python 3.8+ on Windows - add DLL directory to search path
            os.add_dll_directory(str(dll_dir))
            logger.info(f"Added DLL directory to search path: {dll_dir}")

        # Preload dependent DLLs explicitly to ensure they're loaded in the right order
        dependent_dlls = [
            "opencv_world490.dll",
            "itrace.core.dll",
            "itrace.preProcessImage.dll",
            "itrace.readAMark.dll",
        ]

        for dll_name in dependent_dlls:
            dll_path = dll_dir / dll_name
            if dll_path.exists():
                try:
                    ctypes.CDLL(str(dll_path))
                    logger.info(f"Preloaded dependency: {dll_name}")
                except Exception as e:
                    logger.warning(f"Failed to preload {dll_name}: {e}")

        self._itrace_interface = ctypes.CDLL(str(self.mark_decoder_dll_path))

        # Map GetVersion function
        self._itrace_interface.GetVersion.argtypes = []
        self._itrace_interface.GetVersion.restype = ctypes.c_char_p

        # Map Decode function
        self._itrace_interface.Decode.argtypes = [
            ctypes.c_int,  # companyToken
            ctypes.c_char_p,  # filename
            ctypes.c_char_p,  # licenseFilename
            ctypes.c_char_p,  # inputDecodeFlags
            ctypes.c_char_p,  # configFilename
            ctypes.c_char_p,  # sResultsOut (buffer)
            ctypes.c_int,  # resCapacity
            ctypes.c_char_p,  # strSerialOut (buffer)
            ctypes.c_int,  # serCapacity
            ctypes.c_bool,  # preProcessYN
            ctypes.c_char_p,  # markTypeIn
        ]
        self._itrace_interface.Decode.restype = ctypes.c_int

    def decode_enabled(self) -> bool:
        """
        Check if the decode functionality is enabled.
        """
        return self._itrace_interface is not None

    def get_version(self) -> Optional[str]:
        """
        Get the version of the iTrace decoder library.

        Returns:
            Version string or None if not available

        Raises:
            ITraceNotEnabledError: If decode functionality is not enabled
        """
        if not self.decode_enabled():
            raise ITraceNotEnabledError("Decode functionality is not enabled")

        try:
            version_bytes = self._itrace_interface.GetVersion()
            if version_bytes:
                version = version_bytes.decode("utf-8")
                logger.info(f"[DecoderInterface] iTrace library version: {version}")
                return version
            else:
                logger.warning("[DecoderInterface] GetVersion returned None")
                return None
        except Exception as e:
            logger.error(f"[DecoderInterface] Failed to get version: {e}")
            return None

    def decode_mark(self, image_path: str, request_preprocess: bool = True) -> DecodeResult:
        """
        Decode an iTrace mark from an image.

        Args:
            image_path: Path to the image file
            request_preprocess: Whether to preprocess the image (default: True)

        Returns:
            DecodeResult containing serial number and results

        Raises:
            ITraceNotEnabledError: If decode functionality is not enabled
            ITraceDecodeError: If decoding fails
        """
        try:
            result_tuple = self._decode(image_path, request_preprocess)
            use_thread(
                collect_decoder_data, image_path, self.mark_config_path, result_tuple.results
            )
            return self._parse_decode_results(result_tuple.results, result_tuple.serial)
        except Exception as e:
            logger.error(f"Mark decode failed: {e}")
            return DecodeResult()

    def _decode(self, image_path: str, request_preprocess: bool = True) -> _DecodeTuple:
        """
        Decode an iTrace mark from an image.
        """
        if not self.decode_enabled():
            raise ITraceNotEnabledError("Decode functionality is not enabled")

        res_buffer = ctypes.create_string_buffer(RESULTS_BUFFER_SIZE)
        ser_buffer = ctypes.create_string_buffer(SERIAL_BUFFER_SIZE)

        # Convert Python types to C-compatible types
        f_bytes = image_path.encode("utf-8")
        a_bytes = self.auth_key_path.encode("utf-8")
        d_bytes = self.decode_flags.encode("utf-8")
        c_bytes = self.mark_config_path.encode("utf-8")
        m_bytes = self.mark_type.encode("utf-8")

        logger.info(
            (
                f"[DecoderInterface] Company ID: {self.company_id}, "
                f"File: {image_path}, "
                f"Auth Key: {self.auth_key_path}, "
                f"Decode Flags: {self.decode_flags}, "
                f"Config: {self.mark_config_path}, "
                f"Mark Type: {self.mark_type}, "
                f"Request Preprocess: {request_preprocess}"
            )
        )

        # Execute DLL function with updated 11-argument interface
        status = self._itrace_interface.Decode(
            self.company_id,
            f_bytes,
            a_bytes,
            d_bytes,
            c_bytes,
            res_buffer,
            len(res_buffer),
            ser_buffer,
            len(ser_buffer),
            request_preprocess,
            m_bytes,
        )
        if status == 0:
            # .value automatically stops at the null terminator set by the C++ code
            results_str = res_buffer.value.decode("utf-8")
            serial_str = ser_buffer.value.decode("utf-8")
            logger.info(f"[DecoderInterface] Result: {results_str}, Serial: {serial_str}")
            return _DecodeTuple(serial=serial_str, results=results_str, status=status)
        else:
            logger.error(f"[DecoderInterface] Decoding failed with status: {status}")
            return _DecodeTuple(status=status)

    def _parse_decode_results(self, results_str: str, serial_str: str) -> DecodeResult:
        """
        Parse decode results from strings.

        Args:
            results_str: JSON results string
            serial_str: Serial number string

        Returns:
            DecodeResult containing parsed data
        """
        if not results_str or not serial_str:
            logger.error("Decode results or serial number are empty")
            return DecodeResult()

        try:
            parsed_results: dict[str, Any] = json.loads(results_str)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON results: {e}")
            raise ITraceDecodeError(f"Invalid JSON results: {e}") from e

        pix_per_mm = None
        for result in parsed_results.get("body", {}).get("results", []):
            if result.get("2dmimark_decode_nResult") == 0:
                pix_per_mm = result.get("full_image_pixels_per_mm")
                if pix_per_mm:
                    break

        if pix_per_mm is None:
            available_keys = (
                list(parsed_results.get("body", {}).get("results", [{}])[0].keys())
                if parsed_results.get("body", {}).get("results")
                else "No results"
            )
            logger.warning(
                f"Failed to extract pixels per mm from decode results. "
                f"Available keys: {available_keys}"
            )

        return DecodeResult(serial=serial_str, results=parsed_results, pix_per_mm=pix_per_mm)
