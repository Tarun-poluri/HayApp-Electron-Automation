"""
Unit tests for deferring analyzed_needles / dashboard verification until the
post-deposit reference image completes.
"""

import json
import threading
from unittest.mock import MagicMock

import pytest

from hayapp_python.common.defs import NeedleResponseType
from hayapp_python.common.events import ImageAnalyzedEvent
from hayapp_python.items.app_state import AppState
from hayapp_python.items.case import CaseManager
from hayapp_python.items.models import Case


def _analyzed_parlay_event(result: dict) -> dict:
    """Build the CONTENTS shape expected by ImageAnalyzedEvent.from_event (uppercase keys)."""
    raw = ImageAnalyzedEvent(result=result).to_event()
    return {
        "CONTENTS": {
            "EVENT": raw["event"],
            "INFO": raw["info"],
            "DESCRIPTION": raw["description"],
        }
    }


def _needle_captured_calls(send_mock: MagicMock) -> list:
    return [c for c in send_mock.call_args_list if c.kwargs.get("event") == "NEEDLE_IMAGE_CAPTURED"]


def _deposit_failed_calls(send_mock: MagicMock) -> list:
    return [c for c in send_mock.call_args_list if c.kwargs.get("event") == "ERROR_EVENT"]


@pytest.fixture
def case_manager_stub():
    cm = object.__new__(CaseManager)
    cm._adapter = MagicMock()
    cm.app_state = AppState()
    cm.case = Case()
    cm._pending_analyzed_result = None
    cm._pending_analyzed_lock = threading.Lock()
    cm._reference_image_event = threading.Event()
    cm._reference_image_valid = True
    cm._reference_image_event.set()
    cm.send_event = MagicMock()
    cm.update_dashboards = MagicMock()
    return cm


def _single_needle_result():
    return {
        "response_type": NeedleResponseType.SINGLE_NEEDLE,
        "id": "needle-1",
        "results": [{"image_filename_used": "capture.bmp"}],
        "image_number": 3,
        "received_time": "2026-01-01T00:00:00",
    }


def test_reference_passes_after_analyzed_then_commits_once(case_manager_stub):
    cm = case_manager_stub
    cm._reference_image_event.clear()
    CaseManager.on_analyzed_event(cm, _analyzed_parlay_event(_single_needle_result()))
    assert len(cm.app_state.analyzed_needles) == 0
    cm.update_dashboards.reset_mock()

    cm._reference_image_valid = True
    cm._reference_image_event.set()
    CaseManager._maybe_commit_pending_analyzed(cm)

    assert len(cm.app_state.analyzed_needles) == 1
    assert cm.update_dashboards.call_count == 1


def test_reference_fails_after_analyzed_discards_and_deposit_error(case_manager_stub):
    cm = case_manager_stub
    cm._reference_image_event.clear()
    CaseManager.on_analyzed_event(cm, _analyzed_parlay_event(_single_needle_result()))
    assert len(cm.app_state.analyzed_needles) == 0

    cm._reference_image_valid = False
    cm._reference_image_event.set()
    CaseManager._maybe_commit_pending_analyzed(cm)

    assert len(cm.app_state.analyzed_needles) == 0
    cm.update_dashboards.assert_not_called()
    assert any(
        "Deposit Failed" in str(c.kwargs.get("info", ""))
        for c in _deposit_failed_calls(cm.send_event)
    )


def test_reference_passes_before_analyzed_commits_on_analyzed(case_manager_stub):
    cm = case_manager_stub
    cm._reference_image_valid = True
    cm._reference_image_event.set()
    CaseManager.on_analyzed_event(cm, _analyzed_parlay_event(_single_needle_result()))
    assert len(cm.app_state.analyzed_needles) == 1
    assert cm.update_dashboards.call_count == 1


def test_analyzed_event_does_not_emit_needle_image_captured(case_manager_stub):
    """NEEDLE_IMAGE_CAPTURED is only sent from on_imaging_ready, not from on_analyzed_event."""
    cm = case_manager_stub
    cm._reference_image_event.clear()
    CaseManager.on_analyzed_event(cm, _analyzed_parlay_event(_single_needle_result()))
    assert _needle_captured_calls(cm.send_event) == []


def test_needle_image_captured_on_imaging_ready_after_imaging_complete(case_manager_stub):
    cm = case_manager_stub
    cm.take_image_with_retry = MagicMock(
        return_value=("/tmp/needle_capture.bmp", {"is_success": True})
    )
    cm.haystack = MagicMock()
    cm.detector = MagicMock(analyzed_count=4)
    CaseManager.on_imaging_ready(cm)
    assert len(_needle_captured_calls(cm.send_event)) == 1
    cm.haystack.imaging_complete.assert_called_once_with()
    info_json = _needle_captured_calls(cm.send_event)[0].kwargs.get("info", "")
    assert "needle_capture.bmp" in info_json
    info = json.loads(info_json)
    assert info["image_number"] == 5
    assert info["image_filename_used"] == "needle_capture.bmp"


def test_no_objects_bypasses_gate_no_append(case_manager_stub):
    cm = case_manager_stub
    result = {
        "response_type": NeedleResponseType.NO_OBJECTS,
        "results": [],
        "image_number": 0,
        "received_time": "",
    }
    CaseManager.on_analyzed_event(cm, _analyzed_parlay_event(result))
    assert len(cm.app_state.analyzed_needles) == 0
    assert cm.update_dashboards.call_count == 1


def test_error_response_buffers_until_reference(case_manager_stub):
    cm = case_manager_stub
    cm._reference_image_event.clear()
    result = {
        "response_type": NeedleResponseType.ERROR,
        "error": "detector oops",
        "id": "e1",
        "results": [{"image_filename_used": "x.bmp"}],
    }
    CaseManager.on_analyzed_event(cm, _analyzed_parlay_event(result))
    assert len(cm.app_state.analyzed_needles) == 0
    assert any("Image Analysis" in str(c.kwargs) for c in _deposit_failed_calls(cm.send_event))

    cm._reference_image_valid = True
    cm._reference_image_event.set()
    CaseManager._maybe_commit_pending_analyzed(cm)
    assert len(cm.app_state.analyzed_needles) == 1
