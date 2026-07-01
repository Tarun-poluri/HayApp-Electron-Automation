import json
import logging
import os
import shutil
import socket
import time
from enum import Enum
from typing import List, Optional

from parlay import ParlayCommandItem, ParlayProperty, local_item, parlay_command
from pydantic import BaseModel, ConfigDict, Field

from hayapp_python.common.config_manager import config
from hayapp_python.common.defs import Camera_item as item
from hayapp_python.common.defs import HayStack_item as haystack_item
from hayapp_python.common.events import TimerImageCapturedEvent
from hayapp_python.common.parlay_mixin import ThreadSafePublishMixin
from hayapp_python.common.paths import APPLICATION_PATH
from hayapp_python.common.utils import _ScientificFloatEncoder, calculate_md5

try:
    import win32service
except ImportError:  # pragma: no cover - platform-specific dependency
    win32service = None

# This camera adapter communicates with the Video Image
# Recognition (VIR) C++ service using a standard TCP/IP socket
# (localhost:PORT). It sends structured JSON requests to trigger specific
# camera operations (image capture or exposure setting)
# and parses the JSON response from the service.

# Compatible with VIR 1.2.5.1+
# - GET_VERSION command for service version monitoring
# - RESTART_REQUEST command for programmatic service restart
# - Enhanced error handling for disk space and file validation errors
# - meta.code is now populated (e.g. 503, 504, -1 for Vimba errors)

# Run make install_vir in a Administrator command prompt to setup the
# VIR service on Windows.

# Configure logging
logger = logging.getLogger("hayapp")

SERVER_HOST = config.camera.server_host  # Localhost address
SERVER_PORT = config.camera.server_port  # Chosen port for VIR service (MUST match C++ service)

IMAGE_PATH = config.paths.image_path / "haystack_object_images"
DEFAULT_EXPOSURE_TIME_US = float(config.camera.default_exposure_time)
IMAGE_FORMAT = config.camera.image_format
SET_EXPOSURE_KEY = "SET_EXPOSURE_REQUEST"
GET_IMAGE_KEY = "NEEDLE_IMAGE_REQUEST"
GET_VERSION_KEY = "GET_VERSION_REQUEST"
RESTART_CAMERA_KEY = "RESTART_CAMERA_REQUEST"
GET_CAMERA_STATUS_KEY = "GET_CAMERA_STATUS_REQUEST"
CALIBRATION_OUTPUT_FILE = config.camera.calibration_output_file
CALIBRATION_DEFAULT_MATRIX = config.camera.calibration_default_matrix
CALIBRATION_DEFAULT_DISTORTION = config.camera.calibration_default_distortion

# VIR error codes that indicate a persistent hardware failure and should NOT be retried.
# 503: camera hardware is offline
# Transient errors (e.g. camera not ready after restart) carry no code or other codes.
NON_TRANSIENT_CODES = {503}

VIR_SERVICE_NAME = config.camera.vir_service_name
ENABLE_VIR_SERVICE_CHECK = config.camera.check_vir_service
AUTO_START_VIR_SERVICE = config.camera.auto_start_vir_service
SERVICE_START_TIMEOUT_S = config.camera.service_start_timeout_s


class VIRServiceState(Enum):
    """Explicit states for VIR service query/control operations."""

    RUNNING = "RUNNING"
    START_PENDING = "START_PENDING"
    STOPPED = "STOPPED"
    UNKNOWN = "UNKNOWN"  # Service query failed or unavailable
    NOT_INSTALLED = "NOT_INSTALLED"  # Service does not exist
    CHECK_DISABLED = "CHECK_DISABLED"  # Check disabled or not on Windows


# Function received from example client to set the timestamp
def get_current_timestamp():
    # Use ISO 8601 timestamp for all requests
    return time.strftime("%Y-%m-%dT%H:%M:%S%Z", time.gmtime())


class RequestMeta(BaseModel):
    key: str
    timestamp: str = Field(default_factory=get_current_timestamp)


class RequestBodyGetImage(BaseModel):
    imagePath: str = IMAGE_PATH
    format: str = IMAGE_FORMAT


class RequestBodySetExposure(BaseModel):
    value: float


class RequestBodyGetVersion(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RequestBodyRestartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RequestBodyGetCameraStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RequestData(BaseModel):
    meta: RequestMeta
    body: (
        RequestBodySetExposure
        | RequestBodyGetImage
        | RequestBodyGetVersion
        | RequestBodyRestartRequest
        | RequestBodyGetCameraStatus
    )


class ResponseMeta(BaseModel):
    code: Optional[int] = None  # Only added in response if status is error
    id: Optional[str] = (
        None  # Echoes the request ID for matching responses (may not be present in all versions)
    )
    key: str  # Either EXPOSURE_SET_CONFIRMED or NEEDLE_IMAGE_AVAILABLE
    message: Optional[str] = None  # Will show detailed description of the status
    status: str  # The result of the operation: success or error.
    timestamp: Optional[str] = None  # Timestamp of when the response was generated (UTC format)
    version: Optional[str] = None  # VIR version number (may not be present in all responses)


class ResponseBodySetExposure(BaseModel):
    unit: Optional[str] = "microseconds"
    value: float


class ResponseBodyGetImage(BaseModel):
    format: str
    imagePath: str
    sizeMiB: float


class ResponseBodyGetVersion(BaseModel):
    """Note: In VIR 1.1.1.007+, version is returned in meta, not body"""

    model_config = ConfigDict(extra="ignore")


class ResponseBodyRestartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ResponseBodyCameraStatus(BaseModel):
    isCameraConnected: bool
    cameraStatusCode: int = None
    cameraStatusMessage: str = None


class ResponseSetExposure(BaseModel):
    meta: ResponseMeta
    body: ResponseBodySetExposure


class ResponseGetImage(BaseModel):
    meta: ResponseMeta
    body: ResponseBodyGetImage


class ResponseGetVersion(BaseModel):
    meta: ResponseMeta


class ResponseRestartRequest(BaseModel):
    meta: ResponseMeta


class ResponseCameraStatus(BaseModel):
    meta: ResponseMeta
    body: ResponseBodyCameraStatus


class VIRError(Exception):
    """Raised for any VIRError"""

    pass


class VIRResponseError(VIRError):
    """Raised for error status in the VIR Response"""

    def __init__(self, message: str, code: Optional[int] = None):
        super().__init__(message)
        self.code = int(code) if code is not None else None


class VIRSetupError(VIRError):
    """Raised for any errors in the VIR setup"""

    pass


class VIRJSONDecodeError(VIRError):
    """Raised when failed to decode JSON from the service response"""

    pass


class VIRRestartingError(VIRError):
    """Raised when the VIR service is restarting"""

    pass


@local_item()
class Camera(ThreadSafePublishMixin, ParlayCommandItem):

    __version__: Optional[str] = None
    _service_manager_handle = None
    _vir_service_handle = None

    # Store as parlay properties for easy access at any time
    save_images_path = ParlayProperty(default=str(IMAGE_PATH), val_type=str)
    current_exposure = ParlayProperty(
        default=-1,
        val_type=float,
        custom_write=lambda self, value: self._set_exposure_internal(value),
    )
    is_connected = ParlayProperty(
        default=False,
        val_type=bool,
        read_only=True,
        custom_read=lambda self: self._get_camera_status_internal().body.isCameraConnected,
    )
    version = ParlayProperty(
        default="",
        val_type=str,
        read_only=True,
        custom_read=lambda self: self._get_vir_version_internal(),
    )
    vir_service_state = ParlayProperty(
        default=VIRServiceState.CHECK_DISABLED.value,
        val_type=str,
        read_only=True,
        custom_read=lambda self: self._query_vir_service_state().value,
    )
    last_image_path = ParlayProperty(default="", val_type=str, read_only=True)
    last_image_hash = ParlayProperty(default="", val_type=str, read_only=True)
    last_image_timestamp = ParlayProperty(default="", val_type=str, read_only=True)
    check_image_hash = ParlayProperty(default=False, val_type=bool)

    def __init__(self, item_id=item.id, name=item.name):
        ParlayCommandItem.__init__(self, item_id=item.id, name=item.name)
        self._service_manager_handle = None
        self._vir_service_handle = None

        if not IMAGE_PATH.exists():
            try:
                # Create haystack object images directory if it doesn't exist
                IMAGE_PATH.mkdir(parents=True, exist_ok=True)
                logger.info(f"Created image directory at {IMAGE_PATH}")
            except Exception as e:
                logger.error(f"Failed to create image directory at {IMAGE_PATH}: {e}")
                raise VIRSetupError(f"Failed to create image directory at {IMAGE_PATH}: {e}")

        try:
            self.set_exposure()
        except VIRResponseError as e:
            logger.error(f"Failed to set exposure: {e.code}-{e}")

    def _get_vir_version_internal(self):
        """
        Internal method called by custom_read to get VIR version

        Compatible with VIR 1.1.0.007+

        :return: VIR version string
        """
        # Return cached version if available
        if self.__version__ is not None:
            return self.__version__

        # Send request to get VIR version
        request_data = RequestData(
            meta=RequestMeta(key=GET_VERSION_KEY),
            body=RequestBodyGetVersion(),
        )

        response_dict = self.send_request(request_data)
        response = ResponseGetVersion(**response_dict)
        # Cache the version (may be None in some VIR versions)
        self.__version__ = response.meta.version or "unknown"
        return self.__version__

    def _set_exposure_internal(self, exposure_value: float):
        """
        Internal method called by custom_write to set exposure.
        """
        exposure_value = float(exposure_value)

        request_data = RequestData(
            meta=RequestMeta(key=SET_EXPOSURE_KEY),
            body=RequestBodySetExposure(value=exposure_value),
        )

        response_dict = self.send_request(request_data)
        response = ResponseSetExposure(**response_dict)
        return response.body.value

    @parlay_command()
    def set_exposure(self, exposure_value: float = DEFAULT_EXPOSURE_TIME_US):
        """
        Set the camera exposure time

        Note: In VIR 1.1.0.007+, this triggers a full VIR service restart to properly
        recalculate and apply the new Frame Acquisition Rate based on the exposure time.

        :param exposure_value: A float value in micro seconds. 150000 Recommended as start value
        :return: A float value of the actually set exposure time (differs very slightly)
        """
        if self.is_connected and self.current_exposure != exposure_value:
            logging.info(f"Setting exposure to {exposure_value} microseconds")
            self.current_exposure = exposure_value
        return self.current_exposure

    @parlay_command()
    def take_image(self):
        """
        Take an image with the camera
        :return: path of the saved image
        """
        request_data = RequestData(
            meta=RequestMeta(key=GET_IMAGE_KEY),
            body=RequestBodyGetImage(imagePath=self.save_images_path),
        )

        start = time.perf_counter()
        response_dict = self.send_request(request_data)
        execution_duration_ms = (time.perf_counter() - start) * 1000

        response = ResponseGetImage(**response_dict)
        # Store as camera parlay property
        self.last_image_path = response.body.imagePath

        if (
            self.check_image_hash
            and (image_hash := calculate_md5(self.last_image_path)) == self.last_image_hash
        ):
            logger.error(
                f"Image hash has not changed, buffer is stale."
                f"path: {self.last_image_path}, hash: {image_hash}"
            )
            self.last_image_hash = image_hash
        self.last_image_timestamp = get_current_timestamp()
        self.send_event(
            **TimerImageCapturedEvent(execution_duration_ms=execution_duration_ms).to_event()
        )
        return self.last_image_path

    @parlay_command()
    def restart_camera(self):
        """
        Initiates an asynchronous "Hot-Restart" of the camera hardware. The service handler now
        awaits the completion of the full hardware re-initialization cycle—including all internal
        retry attempts and the mandatory USB stack settlement time—before returning a final
        response to the client.

        Because the service waits for the hardware to fully stabilize, this command may take
        between 2 and 60 seconds to complete. If the re-initialization fails after all configured
        retry attempts, the service will return an error status instead of the success response.

        Note: SET_EXPOSURE requests automatically trigger a restart in VIR 1.1.0.007+

        :return: Success message or raises VIRError on failure
        """
        request_data = RequestData(
            meta=RequestMeta(key=RESTART_CAMERA_KEY),
            body=RequestBodyRestartRequest(),
        )

        response_dict = self.send_request(request_data)
        response = ResponseRestartRequest(**response_dict)
        success_message = response.meta.message
        logger.info(f"Restart Camera: {success_message}")
        return success_message

    @parlay_command()
    def get_camera_status(self) -> dict:
        """
        Get the current status of the camera hardware.

        :return: A dict containing camera connection status and any relevant status codes/messages
        """
        response = self._get_camera_status_internal()

        status_info = {
            "is_connected": response.body.isCameraConnected,
            "status_code": response.body.cameraStatusCode,
            "status_message": response.body.cameraStatusMessage,
        }
        logger.info(f"Camera Status: {status_info}")
        return status_info

    def _get_camera_status_internal(self) -> ResponseCameraStatus:
        """
        Internal method called by custom_read and command handler.

        Returns:
            ResponseCameraStatus: Parsed response containing camera status information
        """
        request_data = RequestData(
            meta=RequestMeta(key=GET_CAMERA_STATUS_KEY),
            body=RequestBodyGetCameraStatus(),
        )

        response_dict = self.send_request(request_data)
        return ResponseCameraStatus(**response_dict)

    @staticmethod
    def build_calibration_payload(
        mtx: Optional[List[float]],
        dist: Optional[List[float]],
        calibration_time: Optional[str] = None,
    ) -> dict:
        """Build the calibration payload dict, falling back to defaults when values are None."""
        if calibration_time is None:
            calibration_time = time.strftime("%a %b %d %H:%M:%S %Y", time.localtime())
        default_matrix = [float(v) for v in CALIBRATION_DEFAULT_MATRIX]
        default_distortion = [float(v) for v in CALIBRATION_DEFAULT_DISTORTION]
        return {
            "calibration_time": calibration_time,
            "camera_matrix": {
                "type_id": "opencv-matrix",
                "rows": 3,
                "cols": 3,
                "dt": "d",
                "data": mtx if mtx is not None else default_matrix,
            },
            "distortion_coefficients": {
                "type_id": "opencv-matrix",
                "rows": 5,
                "cols": 1,
                "dt": "d",
                "data": dist if dist is not None else default_distortion,
            },
        }

    @parlay_command()
    def write_calibration_to_file(self, mtx: Optional[List[str]], dist: Optional[List[str]]) -> str:
        """Write calibration to out_camera_data.json in calibration_output_dir."""
        payload = self.build_calibration_payload(mtx, dist)
        with open(CALIBRATION_OUTPUT_FILE, "w") as f:
            f.write(json.dumps(payload, indent=4, cls=_ScientificFloatEncoder))
        logger.info("Wrote camera calibration to %s", CALIBRATION_OUTPUT_FILE)
        return str(CALIBRATION_OUTPUT_FILE)

    @staticmethod
    def _parse_response(json_response: str) -> dict:
        """
        Parse and validate the JSON response from VIR service.

        Args:
            json_response: Raw JSON string from the service

        Returns:
            dict: Parsed response object

        Raises:
            VIRJSONDecodeError: If response is empty or invalid JSON
            VIRResponseError: If the response indicates an error status
        """
        if not json_response.strip():
            logger.error("VIRJSONDecodeError: Received empty response from VIR service")
            raise VIRJSONDecodeError("Received empty response from VIR service")

        try:
            response_obj = json.loads(json_response)
        except json.JSONDecodeError:
            logger.error(
                "VIRJSONDecodeError: Failed to decode JSON. " f"Raw response: {json_response!r}"
            )
            raise VIRJSONDecodeError(
                "Failed to decode JSON from the service response. " f"Raw: {json_response[:200]!r}"
            )

        response_meta = response_obj.get("meta")
        if "restarting" in response_meta.get("message", ""):
            raise VIRRestartingError(f"VIR service is restarting: {response_obj}")
        if response_meta.get("status") != "success":
            code = response_meta.get("code")
            key = response_meta.get("key", "NO KEY FOUND")
            message = response_meta.get("message", "NO ERROR MESSAGE FOUND.")
            logger.error(f"VIRResponseError Code: {code}, Key: {key}, Message: {message}")
            raise VIRResponseError(f"Code: {code}, Key: {key}, Message: {message}", code=code)

        return response_obj

    def _send_socket_request(self, request_data: RequestData, attempt: int, max_retries: int):
        """
        Send a request via TCP/IP Socket and return the response.

        Args:
            request_data: The request payload to send
            attempt: Current attempt number (0-indexed)
            max_retries: Maximum number of retries for logging

        Returns:
            dict: Parsed response object on success

        Raises:
            VIRSetupError: For socket connection issues
            VIRJSONDecodeError: For response parsing issues
            VIRResponseError: For error responses from service
            BrokenPipeError: For transient connection errors (can be retried)
        """
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_address = (SERVER_HOST, SERVER_PORT)
        try:
            logger.debug(f"Connecting to TCP/IP socket \
                    {SERVER_HOST}:{SERVER_PORT} (attempt {attempt + 1}/{max_retries}).")
            sock.connect(server_address)

            json_request = json.dumps(request_data.model_dump(mode="json"))
            logger.debug(f"Sending request: {json_request}")
            sock.sendall(json_request.encode("utf-8"))

            response_data = sock.recv(8192)  # VIR 1.2.5.1+ responses can exceed 4 KiB
            json_response = response_data.decode("utf-8")
            logger.debug(f"Received response: {json_response}")

            return self._parse_response(json_response)
        except ConnectionRefusedError:
            logger.error(
                f"VIRSetupError: Connection refused. Is the C++ service"
                f" running and listening on {SERVER_HOST}:{SERVER_PORT}?"
            )
            raise VIRSetupError(
                f"Connection refused. Is the C++ service running"
                f" and listening on {SERVER_HOST}:{SERVER_PORT}?"
            )
        except TimeoutError:
            logger.error(
                f"Error: Connection timed out. Is the firewall blocking port {SERVER_PORT}?"
            )
            raise VIRSetupError(
                f"Connection timed out. Is the firewall blocking port {SERVER_PORT}?"
            )
        finally:
            logger.debug("Closing socket.")
            sock.close()

    @staticmethod
    def _map_service_status_code(state_code: int | None) -> VIRServiceState:
        if state_code == getattr(win32service, "SERVICE_RUNNING", None):
            return VIRServiceState.RUNNING
        if state_code == getattr(win32service, "SERVICE_START_PENDING", None):
            return VIRServiceState.START_PENDING
        if state_code == getattr(win32service, "SERVICE_STOPPED", None):
            return VIRServiceState.STOPPED
        return VIRServiceState.UNKNOWN

    def _reset_vir_service_handles(self) -> None:
        if win32service is None:
            self._service_manager_handle = None
            self._vir_service_handle = None
            return

        if self._vir_service_handle is not None:
            win32service.CloseServiceHandle(self._vir_service_handle)
            self._vir_service_handle = None

        if self._service_manager_handle is not None:
            win32service.CloseServiceHandle(self._service_manager_handle)
            self._service_manager_handle = None

    def _get_vir_service_handle(self):
        if win32service is None:
            return None

        if self._vir_service_handle is not None:
            return self._vir_service_handle

        scm_handle = win32service.OpenSCManager(
            None,
            None,
            win32service.SC_MANAGER_CONNECT,
        )
        try:
            service_handle = win32service.OpenService(
                scm_handle,
                VIR_SERVICE_NAME,
                win32service.SERVICE_QUERY_STATUS | win32service.SERVICE_START,
            )
        except Exception:
            # OpenSCManager succeeded; close the handle if OpenService fails.
            win32service.CloseServiceHandle(scm_handle)
            raise

        self._service_manager_handle = scm_handle
        self._vir_service_handle = service_handle
        return service_handle

    def _query_vir_service_state(self) -> VIRServiceState:
        """
        Query VIR service state via the Windows service control manager.

        Returns:
            VIRServiceState enum indicating service state or error condition.
        """
        if os.name != "nt" or not ENABLE_VIR_SERVICE_CHECK:
            return VIRServiceState.CHECK_DISABLED

        try:
            service_handle = self._get_vir_service_handle()
            if service_handle is None:
                return VIRServiceState.NOT_INSTALLED

            _, state_code, *_ = win32service.QueryServiceStatus(service_handle)
            return self._map_service_status_code(state_code)
        except Exception as e:
            logger.warning(f"Failed to query VIR service state: {e}")
            self._reset_vir_service_handles()
            return VIRServiceState.UNKNOWN

    def _start_vir_service(self) -> bool:
        try:
            service_handle = self._get_vir_service_handle()
            if service_handle is None:
                return False

            _, state_code, *_ = win32service.QueryServiceStatus(service_handle)
            current_state = self._map_service_status_code(state_code)
            if current_state in {VIRServiceState.RUNNING, VIRServiceState.START_PENDING}:
                return True

            win32service.StartService(service_handle, None)
            return True
        except Exception as e:
            error_text = str(e).lower()
            if "already running" in error_text:
                return True
            if "access is denied" in error_text:
                logger.error(f"No permission to start VIR service '{VIR_SERVICE_NAME}'.")
                return False

            logger.warning(f"Failed to start VIR service via SCM: {e}")
            self._reset_vir_service_handles()
            return False

    def _ensure_vir_service_running(self) -> None:
        state = self._query_vir_service_state()
        if state in {
            VIRServiceState.RUNNING,
            VIRServiceState.START_PENDING,
            VIRServiceState.CHECK_DISABLED,
        }:
            return

        if not AUTO_START_VIR_SERVICE:
            logger.error(
                f"VIR service '{VIR_SERVICE_NAME}' is {state.value}. " "Auto-start is disabled."
            )
            return

        logger.error(f"VIR service '{VIR_SERVICE_NAME}' is {state.value}. Attempting start.")
        started = self._start_vir_service()
        if not started:
            return

        deadline = time.time() + SERVICE_START_TIMEOUT_S
        while time.time() < deadline:
            current_state = self._query_vir_service_state()
            if current_state == VIRServiceState.RUNNING:
                logger.info(
                    f"VIR service '{VIR_SERVICE_NAME}' successfully restarted "
                    f"(state: {current_state.value})."
                )
                return
            time.sleep(0.1)

        logger.warning(
            f"VIR service '{VIR_SERVICE_NAME}' did not become ready "
            f"within {SERVICE_START_TIMEOUT_S:.1f}s."
        )

    def _retry_on_error(self, error: Exception, attempt: int, max_retries: int):
        """
        Handle an error and retry if necessary.
        """
        if attempt < max_retries - 1:
            delay = 0.1 * (2**attempt)  # Exponential backoff: 0.1s, 0.2s, 0.4s
            logger.warning(
                f"{error.__class__.__name__} on attempt {attempt + 1}/{max_retries}. "
                f"Retrying in {delay:.1f}s... (Race condition in VIR service)"
            )
            time.sleep(delay)
        else:
            logger.error(
                f"{error.__class__.__name__} persisted after {max_retries} attempts. "
                f"This may indicate a persistent issue with the VIR service."
            )
            raise VIRError(f"Failed after {max_retries} attempts: {error}") from error

    def send_request(self, request_data: RequestData, max_retries: int = 3) -> dict:
        """
        Sends the request, and processes the response.

        Implements retry logic with exponential backoff to handle transient
        network failures like BrokenPipeError caused by race conditions in
        the VIR service.

        Args:
            request_data (RequestData): The complete request payload
            max_retries (int): Maximum number of retry attempts (default: 3)

        Returns:
            dict: The parsed JSON response from the VIR service

        Raises:
            VIRError: For various VIR-specific errors after all retries exhausted
        """
        self._ensure_vir_service_running()

        last_exception = None

        for attempt in range(max_retries):
            try:
                response = self._send_socket_request(request_data, attempt, max_retries)
                if attempt > 0:
                    logger.info(f"Request succeeded on attempt {attempt + 1}/{max_retries}")
                return response

            except VIRRestartingError as e:
                last_exception = e
                self._retry_on_error(e, attempt, max_retries)
            except VIRResponseError as e:
                # Retry on transient errors (e.g. camera not ready after restart).
                # Non-transient hardware failure codes should not be retried.
                last_exception = e
                if e.code in NON_TRANSIENT_CODES:
                    raise
                self._retry_on_error(e, attempt, max_retries)
            except BrokenPipeError as e:
                last_exception = e
                self._retry_on_error(e, attempt, max_retries)
            except VIRError:
                # Re-raise all VIR-specific errors (not transient, should not retry)
                raise
            except Exception as e:
                logger.error(f"VIRError An unexpected error occurred: {e}")
                raise VIRError(f"An unexpected error occurred: {e}")

        # If we get here, all retries failed
        if last_exception:
            raise VIRError(
                f"Failed after {max_retries} attempts: {last_exception}"
            ) from last_exception


class MockCamera(Camera):
    reference_image_name = "HayStackFlatWhitePostDistortion.bmp"
    image_name = "HayStackSingleNeedlePostDistortion.bmp"  # Needle image
    blank_image_name = "HayStackFlatWhitePostDistortion.bmp"  # Blank image
    reference_image_path = str(IMAGE_PATH / reference_image_name)
    image_path = str(IMAGE_PATH / image_name)
    blank_image_path = str(IMAGE_PATH / blank_image_name)
    is_connected = ParlayProperty(default=True, val_type=bool, read_only=True)

    # Normalized reference capture modes for take_image when is_reference is True
    _REFERENCE_STATE_ALIASES = {
        "empty": "empty",
        "clean": "empty",
        "reference_empty": "empty",
        "with_objects": "with_objects",
        "objects": "with_objects",
        "dirty": "with_objects",
    }

    def __init__(self, item_id=item.id, name=item.name):
        super().__init__(item_id=item_id, name=name)
        self._initialize_mock_images()
        self.is_reference = True
        self.image_mode = "needle"  # Options: "blank", "needle"
        # When is_reference: "empty" = flat tray (passes empty check); "with_objects" = needle image
        self.reference_capture_state = "empty"
        self.subscribe(self.on_stack_needle_event, MSG_TYPE="EVENT", FROM=haystack_item.id)
        self.subscribe(self.on_stack_button_event, MSG_TYPE="EVENT", FROM=haystack_item.id)

    def _initialize_mock_images(self):
        """
        Copy test images from the tests folder to the expected output path
        if they don't already exist.
        """
        # Hardcoded source path for test images
        test_images_path = APPLICATION_PATH / "tests" / "iTrace" / "images"

        # Images to copy
        images_to_copy = [self.reference_image_name, self.image_name, self.blank_image_name]

        for image_name in images_to_copy:
            source_path = test_images_path / image_name
            dest_path = IMAGE_PATH / image_name

            # Only copy if source exists and destination doesn't
            if source_path.exists() and not dest_path.exists():
                try:
                    shutil.copy2(source_path, dest_path)
                    logger.info(f"Copied mock camera image: {image_name} to {dest_path}")
                except Exception as e:
                    logger.warning(f"Failed to copy mock camera image {image_name}: {e}")
            elif not source_path.exists():
                logger.warning(f"Mock camera source image not found: {source_path}")
            else:
                logger.debug(f"Mock camera image already exists: {dest_path}")

    def on_stack_needle_event(self, msg):
        """
        Triggered when Haystack sends any event
        Filters for stack_needle events specifically
        """
        # Check if this is a stack_needle event
        event_name = msg.get("CONTENTS", {}).get("EVENT")
        if event_name != "stack_needle":
            return

        # Parse the event data from INFO field
        event_data = msg.get("CONTENTS", {}).get("INFO", "{}")
        json_event = json.loads(event_data)
        event_type = json_event.get("event")

        if event_type == "moved_to_sharps":
            self.is_reference = True

    def on_stack_button_event(self, msg):
        """
        Triggered when Haystack sends any event
        Filters for stack_button events specifically
        """
        event_name = msg.get("CONTENTS", {}).get("EVENT")
        if event_name != "stack_button":
            return
        event_data = msg.get("CONTENTS", {}).get("INFO", "{}")
        json_event = json.loads(event_data)
        event_type = json_event.get("button")
        if event_type == "deposit":
            self.is_reference = False

    @parlay_command()
    def set_image_mode(self, mode: str):
        """
        Set which image type to use when taking non-reference images
        :param mode: "blank" or "needle"
        :return: The mode that was set
        """
        valid_modes = ["blank", "needle"]
        mode = mode.lower()
        if mode not in valid_modes:
            raise ValueError(f"Invalid mode '{mode}'. Must be one of: {valid_modes}")
        self.image_mode = mode
        # When manually setting image mode, disable reference mode so image_mode takes effect
        self.is_reference = False
        logger.info(f"MockCamera image mode set to: {mode}, is_reference set to False")
        return mode

    @parlay_command()
    def get_image_mode(self):
        """
        Get the current image mode
        :return: Current mode ("blank" or "needle")
        """
        return self.image_mode

    @parlay_command()
    def set_state(self, state: str) -> str:
        """
        Set what the mock returns when ``take_image`` runs while ``is_reference`` is True
        (post-deposit reference / empty-tray check).

        - ``empty`` (aliases: ``clean``, ``reference_empty``):
          flat tray image; simulates a clean tray.
        - ``with_objects`` (aliases: ``objects``, ``dirty``):
          image containing a needle; simulates debris or a needle still in view so the empty check
          can fail.

        Call ``set_state("empty")`` before each reference capture to simulate consecutive
        empty captures (e.g. empty then empty). Non-reference captures still use ``image_mode``
        (``blank`` / ``needle``).

        :param state: One of the values or aliases above
        :return: Normalized state: ``empty`` or ``with_objects``
        """
        key = state.strip().lower().replace("-", "_")
        normalized = self._REFERENCE_STATE_ALIASES.get(key)
        if normalized is None:
            allowed = sorted(set(self._REFERENCE_STATE_ALIASES.keys()))
            raise ValueError(f"Invalid state {state!r}. Use one of: {allowed}")
        self.reference_capture_state = normalized
        logger.info(f"MockCamera reference capture state set to: {normalized}")
        return normalized

    @parlay_command()
    def get_state(self) -> str:
        """Return the normalized reference capture state (``empty`` or ``with_objects``)."""
        return self.reference_capture_state

    def take_image(self):
        """
        Mock take an image with the camera
        :return: path of the saved image
        """
        start = time.perf_counter()

        # is_reference flag takes precedence (controlled by events)
        if self.is_reference:
            if self.reference_capture_state == "with_objects":
                self.last_image_path = self.image_path
            else:
                self.last_image_path = self.reference_image_path
        # For non-reference images, use image_mode to choose blank vs needle
        elif self.image_mode == "blank":
            self.last_image_path = self.blank_image_path
        else:  # "needle" or any other value defaults to needle
            self.last_image_path = self.image_path

        execution_duration_ms = (time.perf_counter() - start) * 1000

        # Update timestamp and send event after updating the path
        self.last_image_timestamp = get_current_timestamp()
        self.send_event(
            **TimerImageCapturedEvent(execution_duration_ms=execution_duration_ms).to_event()
        )
        return self.last_image_path

    def set_exposure(self, exposure_value: float = DEFAULT_EXPOSURE_TIME_US):
        """
        Mock set the exposure time
        :param exposure_value: A float value in micro seconds. 50000 Recommended as start value
        :return: A float value of the actually set exposure time (differs very slightly)
        """
        return exposure_value

    def _get_vir_version_internal(self):
        """
        Mock get VIR version
        :return: Mock version string
        """
        return "MOCK-VIR-1.1.0.007"

    def restart_camera(self):
        """
        Mock restart camera
        :return: Mock success message
        """
        logger.info("Mock restart camera requested (no-op in mock mode)")
        return "Mock restart camera successful"
