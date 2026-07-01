"""
Tests for Camera adapter calibration utilities.
"""

import json
from unittest.mock import MagicMock

import pytest

import hayapp_python.items.camera_adapter as camera_adapter_module
from hayapp_python.items.camera_adapter import (
    Camera,
    MockCamera,
    RequestBodyGetImage,
    RequestData,
    RequestMeta,
    VIRError,
    VIRResponseError,
    VIRServiceState,
)

EXPECTED_DEFAULT_MATRIX = [
    float(v)
    for v in [
        "9.3545465017801194E+04",
        "0.0",
        "2.2555000000000000E+03",
        "0.0",
        "9.3545465017801194E+04",
        "2.2555000000000000E+03",
        "0.0",
        "0.0",
        "1.0",
    ]
]

EXPECTED_DEFAULT_DISTORTION = [
    float(v)
    for v in [
        "-5.2666981814202863E+01",
        "2.1059825374380680E+03",
        "0.0",
        "0.0",
        "4.0701218088399527E+00",
    ]
]

FIXED_CALIBRATION_TIME = "Tue Dec 19 16:16:04 2023"


class TestBuildCalibrationPayload:
    """Tests for Camera.build_calibration_payload"""

    def test_none_values_return_defaults(self):
        """When mtx and dist are None the payload uses the default calibration values."""
        result = Camera.build_calibration_payload(
            mtx=None,
            dist=None,
            calibration_time=FIXED_CALIBRATION_TIME,
        )

        expected = {
            "calibration_time": FIXED_CALIBRATION_TIME,
            "camera_matrix": {
                "type_id": "opencv-matrix",
                "rows": 3,
                "cols": 3,
                "dt": "d",
                "data": EXPECTED_DEFAULT_MATRIX,
            },
            "distortion_coefficients": {
                "type_id": "opencv-matrix",
                "rows": 5,
                "cols": 1,
                "dt": "d",
                "data": EXPECTED_DEFAULT_DISTORTION,
            },
        }

        assert result == expected

    def test_none_matrix_uses_default(self):
        """When only mtx is None the camera_matrix data falls back to the default."""
        custom_dist = [1.0, 2.0, 3.0, 4.0, 5.0]
        result = Camera.build_calibration_payload(
            mtx=None,
            dist=custom_dist,
            calibration_time=FIXED_CALIBRATION_TIME,
        )

        assert result["camera_matrix"]["data"] == EXPECTED_DEFAULT_MATRIX
        assert result["distortion_coefficients"]["data"] == custom_dist

    def test_none_distortion_uses_default(self):
        """When only dist is None the distortion_coefficients data falls back to the default."""
        custom_mtx = [1.0] * 9
        result = Camera.build_calibration_payload(
            mtx=custom_mtx,
            dist=None,
            calibration_time=FIXED_CALIBRATION_TIME,
        )

        assert result["camera_matrix"]["data"] == custom_mtx
        assert result["distortion_coefficients"]["data"] == EXPECTED_DEFAULT_DISTORTION

    def test_provided_values_are_used(self):
        """When both mtx and dist are provided the payload contains those values."""
        custom_mtx = [float(i) for i in range(9)]
        custom_dist = [float(i) for i in range(5)]
        result = Camera.build_calibration_payload(
            mtx=custom_mtx,
            dist=custom_dist,
            calibration_time=FIXED_CALIBRATION_TIME,
        )

        assert result["camera_matrix"]["data"] == custom_mtx
        assert result["distortion_coefficients"]["data"] == custom_dist

    def test_payload_structure(self):
        """Payload always contains the required top-level and nested keys."""
        result = Camera.build_calibration_payload(
            mtx=None,
            dist=None,
            calibration_time=FIXED_CALIBRATION_TIME,
        )

        assert "calibration_time" in result

        cam = result["camera_matrix"]
        assert cam["type_id"] == "opencv-matrix"
        assert cam["rows"] == 3
        assert cam["cols"] == 3
        assert cam["dt"] == "d"
        assert "data" in cam

        dist_coef = result["distortion_coefficients"]
        assert dist_coef["type_id"] == "opencv-matrix"
        assert dist_coef["rows"] == 5
        assert dist_coef["cols"] == 1
        assert dist_coef["dt"] == "d"
        assert "data" in dist_coef


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_success_response(key="NEEDLE_IMAGE_AVAILABLE") -> dict:
    return {
        "meta": {"status": "success", "key": key, "message": "ok"},
        "body": {"imagePath": "/tmp/img.bmp", "format": "bmp", "sizeMiB": 1.0},
    }


def _make_error_response(code: int | None, message: str = "hardware error") -> dict:
    meta: dict = {"status": "error", "key": "NEEDLE_IMAGE_AVAILABLE", "message": message}
    if code is not None:
        meta["code"] = code
    return {"meta": meta, "body": {}}


def _make_camera_instance() -> Camera:
    """Return a Camera without triggering real __init__ side-effects."""
    return Camera.__new__(Camera)


def _dummy_request() -> RequestData:
    return RequestData(
        meta=RequestMeta(key="NEEDLE_IMAGE_REQUEST"),
        body=RequestBodyGetImage(),
    )


# ---------------------------------------------------------------------------
# _parse_response tests
# ---------------------------------------------------------------------------


class TestParseResponse:
    """Unit tests for Camera._parse_response."""

    def test_success_response_returns_dict(self):
        raw = json.dumps(_make_success_response())
        result = Camera._parse_response(raw)
        assert result["meta"]["status"] == "success"

    def test_error_response_raises_vir_response_error(self):
        raw = json.dumps(_make_error_response(code=503))
        with pytest.raises(VIRResponseError) as exc_info:
            Camera._parse_response(raw)
        assert exc_info.value.code == 503

    def test_error_response_without_code_does_not_crash(self):
        """Missing 'code' field must not raise ValueError — critical regression guard."""
        raw = json.dumps(_make_error_response(code=None))
        with pytest.raises(VIRResponseError) as exc_info:
            Camera._parse_response(raw)
        assert exc_info.value.code is None

    def test_empty_response_raises_json_decode_error(self):
        from hayapp_python.items.camera_adapter import VIRJSONDecodeError

        with pytest.raises(VIRJSONDecodeError):
            Camera._parse_response("")

    def test_invalid_json_raises_json_decode_error(self):
        from hayapp_python.items.camera_adapter import VIRJSONDecodeError

        with pytest.raises(VIRJSONDecodeError):
            Camera._parse_response("{not valid json")


# ---------------------------------------------------------------------------
# send_request retry behaviour tests
# ---------------------------------------------------------------------------


class TestSendRequestRetry:
    """Verify that send_request retries correctly and respects NON_TRANSIENT_CODES."""

    def _mock_socket_response(self, camera: Camera, response_dict: dict):
        """Patch _send_socket_request to return a fixed dict."""
        camera._send_socket_request = MagicMock(return_value=response_dict)

    def _mock_socket_raises(self, camera: Camera, exc: Exception, then_return: dict | None = None):
        """Patch _send_socket_request to raise exc on first call, then optionally succeed."""
        if then_return is not None:
            camera._send_socket_request = MagicMock(side_effect=[exc, then_return])
        else:
            camera._send_socket_request = MagicMock(side_effect=exc)

    def test_success_on_first_attempt_returns_response(self):
        camera = _make_camera_instance()
        expected = _make_success_response()
        self._mock_socket_response(camera, expected)

        result = camera.send_request(_dummy_request(), max_retries=3)

        assert result == expected
        camera._send_socket_request.assert_called_once()

    def test_non_transient_code_503_raises_immediately(self):
        """A 503 VIRResponseError must propagate immediately without retrying."""
        camera = _make_camera_instance()
        error = VIRResponseError("hardware offline", code=503)
        camera._send_socket_request = MagicMock(side_effect=error)

        with pytest.raises(VIRResponseError) as exc_info:
            camera.send_request(_dummy_request(), max_retries=3)

        assert exc_info.value.code == 503
        camera._send_socket_request.assert_called_once()

    def test_transient_vir_response_error_is_retried(self):
        """A VIRResponseError with a code NOT in NON_TRANSIENT_CODES should be retried."""
        camera = _make_camera_instance()
        transient_error = VIRResponseError("camera not ready", code=None)
        success = _make_success_response()
        # Fail first attempt, succeed on second
        camera._send_socket_request = MagicMock(side_effect=[transient_error, success])

        result = camera.send_request(_dummy_request(), max_retries=3)

        assert result == success
        assert camera._send_socket_request.call_count == 2

    def test_all_retries_exhausted_raises_vir_error(self):
        """After all retries the original exception must be chained onto VIRError."""
        camera = _make_camera_instance()
        transient_error = VIRResponseError("camera not ready", code=None)
        camera._send_socket_request = MagicMock(side_effect=transient_error)

        with pytest.raises(VIRError) as exc_info:
            camera.send_request(_dummy_request(), max_retries=2)

        assert exc_info.value.__cause__ is not None
        assert camera._send_socket_request.call_count == 2


class TestVirServiceStateQuery:
    def test_query_state_reads_latest_value_each_time(self, monkeypatch):
        camera = _make_camera_instance()
        camera._service_manager_handle = None
        camera._vir_service_handle = None
        states = iter([1, 4])

        fake_win32service = MagicMock()
        fake_win32service.SC_MANAGER_CONNECT = 1
        fake_win32service.SERVICE_QUERY_STATUS = 4
        fake_win32service.SERVICE_START = 16
        fake_win32service.SERVICE_STOPPED = 1
        fake_win32service.SERVICE_RUNNING = 4
        fake_win32service.SERVICE_START_PENDING = 2
        fake_win32service.OpenSCManager.return_value = "scm"
        fake_win32service.OpenService.return_value = "service"
        fake_win32service.QueryServiceStatus.side_effect = lambda handle: (
            None,
            next(states),
            None,
            None,
            None,
            None,
            None,
        )

        monkeypatch.setattr(camera_adapter_module, "win32service", fake_win32service)
        monkeypatch.setattr(camera_adapter_module.os, "name", "nt", raising=False)
        monkeypatch.setattr(camera_adapter_module, "ENABLE_VIR_SERVICE_CHECK", True)

        first = camera._query_vir_service_state()
        second = camera._query_vir_service_state()

        assert first == VIRServiceState.STOPPED
        assert second == VIRServiceState.RUNNING
        fake_win32service.OpenSCManager.assert_called_once()
        fake_win32service.OpenService.assert_called_once()
        assert fake_win32service.QueryServiceStatus.call_count == 2


class TestMockCameraSetState:
    """MockCamera.set_state controls reference captures (is_reference=True)."""

    def _bare_mock_camera(self):
        m = object.__new__(MockCamera)
        m._adapter = MagicMock()
        m.reference_image_path = "/ref.bmp"
        m.image_path = "/needle.bmp"
        m.blank_image_path = "/blank.bmp"
        m.is_reference = True
        m.image_mode = "needle"
        m.reference_capture_state = "empty"
        m.send_event = MagicMock()
        return m

    def test_reference_empty_then_with_objects_then_clean(self):
        m = self._bare_mock_camera()
        assert MockCamera.take_image(m) == "/ref.bmp"
        MockCamera.set_state(m, "with_objects")
        assert MockCamera.take_image(m) == "/needle.bmp"
        MockCamera.set_state(m, "clean")
        assert MockCamera.take_image(m) == "/ref.bmp"
        assert MockCamera.get_state(m) == "empty"

    def test_non_reference_ignores_reference_capture_state(self):
        m = self._bare_mock_camera()
        m.is_reference = False
        MockCamera.set_state(m, "with_objects")
        assert MockCamera.take_image(m) == "/needle.bmp"
        MockCamera.set_image_mode(m, "blank")
        assert MockCamera.take_image(m) == "/blank.bmp"

    def test_set_state_invalid_raises(self):
        m = self._bare_mock_camera()
        with pytest.raises(ValueError, match="Invalid state"):
            MockCamera.set_state(m, "not_a_mode")
