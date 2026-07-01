import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from hayapp_python.common.config_manager import config
from hayapp_python.items.app_state import AppState, CBINotificationCounts


class TestCBINotificationCounts:
    def test_default_values(self):
        counts = CBINotificationCounts()
        assert counts.contaminated == 0
        assert counts.incompatible == 0
        assert counts.broken == 0
        assert counts.misplaced == 0

    def test_custom_values(self):
        counts = CBINotificationCounts(contaminated=1, incompatible=2, broken=3, misplaced=4)
        assert counts.contaminated == 1
        assert counts.incompatible == 2
        assert counts.broken == 3
        assert counts.misplaced == 4

    def test_model_dump(self):
        counts = CBINotificationCounts(contaminated=5, incompatible=6, broken=7, misplaced=8)
        result = counts.model_dump()
        assert result == {
            "contaminated": 5,
            "incompatible": 6,
            "broken": 7,
            "misplaced": 8,
        }


class TestAppStateInit:
    def test_default_values(self):
        state = AppState()
        assert state.analyzed_needles == []
        assert state.pending_cbi_validations == []
        assert state.haystack_needles == 0
        assert state.misplaced_needles == 0
        assert state.haystack_reason_counts == {}
        assert state.added_needle_count == 0
        assert state.starting_count == 0
        assert state.incompatible_needle_count == 0
        assert state.contaminated_needle_count == 0
        assert state.broken_needle_count == 0
        assert state.confirmed_misplaced == 0
        assert state.hayscan_count == 0
        assert state.cbi_confirmed_counts == {}
        assert isinstance(state.cbi_notification_counts, CBINotificationCounts)
        assert state.current_cir_screen == ""
        assert state.current_scr_screen == ""
        assert state.surgeon_id == ""
        assert state.cir_id == ""
        assert state.scr_id == ""

    def test_custom_values(self):
        state = AppState(
            haystack_needles=10,
            misplaced_needles=2,
            starting_count=50,
            current_cir_screen="dashboard",
            surgeon_id="surgeon_123",
        )
        assert state.haystack_needles == 10
        assert state.misplaced_needles == 2
        assert state.starting_count == 50
        assert state.current_cir_screen == "dashboard"
        assert state.surgeon_id == "surgeon_123"


class TestAppStateSave:
    def test_save_creates_file(self, tmp_path, monkeypatch):
        # Create new ParlayConfig with restore_state=True (NamedTuples are immutable)
        new_parlay = config.parlay._replace(restore_state=True)
        monkeypatch.setattr(config, "parlay", new_parlay)
        file_path = tmp_path / "app_state.json"
        state = AppState()
        state.set_file_path(file_path)
        state.haystack_needles = 5
        state.starting_count = 20

        result = state.save()

        assert result is True
        assert file_path.exists()
        with open(file_path) as f:
            data = json.load(f)
        assert data["haystack_needles"] == 5
        assert data["starting_count"] == 20

    def test_save_creates_parent_directories(self, tmp_path, monkeypatch):
        new_parlay = config.parlay._replace(restore_state=True)
        monkeypatch.setattr(config, "parlay", new_parlay)
        file_path = tmp_path / "nested" / "dir" / "app_state.json"
        state = AppState()
        state.set_file_path(file_path)

        result = state.save()

        assert result is True
        assert file_path.exists()

    def test_save_without_file_path_returns_false(self, monkeypatch):
        new_parlay = config.parlay._replace(restore_state=True)
        monkeypatch.setattr(config, "parlay", new_parlay)
        state = AppState()
        result = state.save()
        assert result is False

    def test_save_serializes_needles_without_state_machine(self, tmp_path, monkeypatch):
        new_parlay = config.parlay._replace(restore_state=True)
        monkeypatch.setattr(config, "parlay", new_parlay)
        file_path = tmp_path / "app_state.json"
        state = AppState()
        state.set_file_path(file_path)

        # Add needle with a mock state machine
        mock_sm = MagicMock()
        state.analyzed_needles.append(
            {
                "id": "needle_1",
                "needle_state": "VERIFICATION",
                "needle_state_machine": mock_sm,
            }
        )

        result = state.save()

        assert result is True
        with open(file_path) as f:
            data = json.load(f)
        # State machine should not be in saved data
        assert "needle_state_machine" not in data["analyzed_needles"][0]
        assert data["analyzed_needles"][0]["id"] == "needle_1"

    def test_save_handles_exception(self, tmp_path, monkeypatch):
        new_parlay = config.parlay._replace(restore_state=True)
        monkeypatch.setattr(config, "parlay", new_parlay)
        file_path = tmp_path / "app_state.json"
        state = AppState()
        state.set_file_path(file_path)

        with patch.object(Path, "write_text", side_effect=IOError("Write failed")):
            result = state.save()

        assert result is False


class TestAppStateLoad:
    def test_load_creates_new_state_if_file_missing(self, tmp_path):
        file_path = tmp_path / "nonexistent.json"

        state = AppState.load(file_path)

        assert isinstance(state, AppState)
        assert state.haystack_needles == 0

    def test_load_creates_new_state_if_file_empty(self, tmp_path):
        file_path = tmp_path / "empty.json"
        file_path.write_text("")

        state = AppState.load(file_path)

        assert isinstance(state, AppState)
        assert state.haystack_needles == 0

    def test_load_creates_new_state_if_json_empty_object(self, tmp_path):
        file_path = tmp_path / "empty_obj.json"
        file_path.write_text("{}")

        state = AppState.load(file_path)

        assert isinstance(state, AppState)
        assert state.haystack_needles == 0

    def test_load_restores_state_from_file(self, tmp_path):
        file_path = tmp_path / "app_state.json"
        data = {
            "analyzed_needles": [{"id": "needle_1"}],
            "pending_cbi_validations": [],
            "haystack_needles": 15,
            "misplaced_needles": 3,
            "haystack_reason_counts": {"broken": 2},
            "added_needle_count": 5,
            "starting_count": 30,
            "incompatible_needle_count": 1,
            "contaminated_needle_count": 2,
            "broken_needle_count": 3,
            "confirmed_misplaced": 1,
            "hayscan_count": 10,
            "cbi_confirmed_counts": {},
            "cbi_notification_counts": {
                "contaminated": 1,
                "incompatible": 0,
                "broken": 2,
                "misplaced": 0,
            },
            "current_cir_screen": "verification",
            "current_scr_screen": "validation",
            "surgeon_id": "doc_1",
            "cir_id": "cir_1",
            "scr_id": "scr_1",
        }
        file_path.write_text(json.dumps(data))

        state = AppState.load(file_path)

        assert state.haystack_needles == 15
        assert state.misplaced_needles == 3
        assert state.starting_count == 30
        assert state.current_cir_screen == "verification"
        assert state.current_scr_screen == "validation"
        assert state.surgeon_id == "doc_1"
        assert state.cbi_notification_counts.contaminated == 1
        assert state.cbi_notification_counts.broken == 2
        assert len(state.analyzed_needles) == 1

    def test_load_handles_invalid_json(self, tmp_path):
        file_path = tmp_path / "invalid.json"
        file_path.write_text("not valid json {{{")

        state = AppState.load(file_path)

        assert isinstance(state, AppState)
        assert state.haystack_needles == 0

    def test_load_accepts_string_path(self, tmp_path):
        file_path = tmp_path / "app_state.json"
        file_path.write_text(json.dumps({"haystack_needles": 42}))

        state = AppState.load(str(file_path))

        assert state.haystack_needles == 42


class TestAppStateClear:
    def test_clear_resets_all_values(self, tmp_path, monkeypatch):
        new_parlay = config.parlay._replace(restore_state=True)
        monkeypatch.setattr(config, "parlay", new_parlay)
        file_path = tmp_path / "app_state.json"
        state = AppState(
            haystack_needles=10,
            misplaced_needles=5,
            starting_count=100,
            current_cir_screen="dashboard",
            surgeon_id="surgeon_1",
        )
        state.analyzed_needles.append({"id": "needle_1"})
        state.set_file_path(file_path)
        state.save()

        state.clear()

        assert state.analyzed_needles == []
        assert state.pending_cbi_validations == []
        assert state.haystack_needles == 0
        assert state.misplaced_needles == 0
        assert state.starting_count == 0
        assert state.current_cir_screen == ""
        assert state.surgeon_id == ""

    def test_clear_deletes_file(self, tmp_path, monkeypatch):
        new_parlay = config.parlay._replace(restore_state=True)
        monkeypatch.setattr(config, "parlay", new_parlay)
        file_path = tmp_path / "app_state.json"
        state = AppState()
        state.set_file_path(file_path)
        state.save()
        assert file_path.exists()

        state.clear()

        assert not file_path.exists()

    def test_clear_handles_missing_file(self, tmp_path):
        file_path = tmp_path / "nonexistent.json"
        state = AppState()
        state.set_file_path(file_path)

        # Should not raise
        state.clear()

        assert state.haystack_needles == 0


class TestAppStateRestoreNeedleStateMachines:
    def test_restore_creates_state_machines_from_state_name(self):
        state = AppState()
        state.analyzed_needles = [
            {"id": "needle_1", "needle_state": "VERIFICATION"},
            {"id": "needle_2", "needle_state": "ADJUDICATION"},
            {"id": "needle_3", "needle_state": "VALIDATION"},
        ]

        result = state.restore_needle_state_machines()

        assert len(result) == 3
        assert "needle_state_machine" in result[0]
        assert result[0]["needle_state_machine"].get_state().name == "VERIFICATION"
        assert result[1]["needle_state_machine"].get_state().name == "ADJUDICATION"
        assert result[2]["needle_state_machine"].get_state().name == "VALIDATION"

    def test_restore_creates_default_state_machine_if_no_state(self):
        state = AppState()
        state.analyzed_needles = [
            {"id": "needle_1"},  # No needle_state
        ]

        result = state.restore_needle_state_machines()

        assert "needle_state_machine" in result[0]
        # Default state should be VERIFICATION
        assert result[0]["needle_state_machine"].get_state().name == "VERIFICATION"

    def test_restore_handles_invalid_state_name(self):
        state = AppState()
        state.analyzed_needles = [
            {"id": "needle_1", "needle_state": "INVALID_STATE"},
        ]

        result = state.restore_needle_state_machines()

        assert "needle_state_machine" in result[0]
        # Should fall back to default
        assert result[0]["needle_state_machine"].get_state().name == "VERIFICATION"


class TestAppStateToRestoredStateDict:
    def test_returns_correct_dict(self):
        state = AppState(
            current_cir_screen="dashboard",
            current_scr_screen="validation",
            starting_count=50,
            added_needle_count=10,
            surgeon_id="surgeon_1",
            cir_id="cir_1",
            scr_id="scr_1",
            cbi_notification_counts=CBINotificationCounts(contaminated=1, broken=2),
        )

        result = state.to_restored_state_dict()

        assert result == {
            "is_fresh": False,
            "current_cir_screen": "dashboard",
            "current_scr_screen": "validation",
            "cbi_notification_counts": {
                "contaminated": 1,
                "incompatible": 0,
                "broken": 2,
                "misplaced": 0,
            },
            "starting_count": 50,
            "added_needle_count": 10,
            "surgeon_id": "surgeon_1",
            "cir_id": "cir_1",
            "scr_id": "scr_1",
        }


class TestAppStateSetFilePath:
    def test_set_file_path_with_path_object(self, tmp_path, monkeypatch):
        new_parlay = config.parlay._replace(restore_state=True)
        monkeypatch.setattr(config, "parlay", new_parlay)
        file_path = tmp_path / "app_state.json"
        state = AppState()

        state.set_file_path(file_path)

        # Verify by saving
        result = state.save()
        assert result is True
        assert file_path.exists()

    def test_set_file_path_with_string(self, tmp_path, monkeypatch):
        new_parlay = config.parlay._replace(restore_state=True)
        monkeypatch.setattr(config, "parlay", new_parlay)
        file_path = tmp_path / "app_state.json"
        state = AppState()

        state.set_file_path(str(file_path))

        result = state.save()
        assert result is True
        assert file_path.exists()


class TestAppStateSerializeNeedles:
    def test_serialize_removes_state_machine(self):
        state = AppState()
        mock_sm = MagicMock()
        state.analyzed_needles = [
            {"id": "needle_1", "needle_state": "VERIFICATION", "needle_state_machine": mock_sm},
            {"id": "needle_2", "response_type": "single"},
        ]

        result = state._serialize_needles()

        assert len(result) == 2
        assert "needle_state_machine" not in result[0]
        assert result[0]["id"] == "needle_1"
        assert result[0]["needle_state"] == "VERIFICATION"
        assert result[1]["id"] == "needle_2"

    def test_serialize_preserves_other_fields(self):
        state = AppState()
        state.analyzed_needles = [
            {
                "id": "needle_1",
                "needle_state": "ADJUDICATION",
                "image_filename": "test.png",
                "adjudication_reason": "broken",
                "hasOtherPiece": True,
            }
        ]

        result = state._serialize_needles()

        assert result[0]["id"] == "needle_1"
        assert result[0]["image_filename"] == "test.png"
        assert result[0]["adjudication_reason"] == "broken"
        assert result[0]["hasOtherPiece"] is True


class TestAppStateIntegration:
    def test_save_and_load_roundtrip(self, tmp_path, monkeypatch):
        new_parlay = config.parlay._replace(restore_state=True)
        monkeypatch.setattr(config, "parlay", new_parlay)
        file_path = tmp_path / "app_state.json"

        # Create and save state
        state1 = AppState(
            haystack_needles=25,
            misplaced_needles=3,
            starting_count=100,
            current_cir_screen="adjudication",
            surgeon_id="doc_123",
            cbi_notification_counts=CBINotificationCounts(contaminated=2, broken=1),
        )
        state1.analyzed_needles.append({"id": "needle_1", "needle_state": "VERIFICATION"})
        state1.haystack_reason_counts = {"broken": 5, "multiple": 2}
        state1.set_file_path(file_path)
        state1.save()

        # Load state
        state2 = AppState.load(file_path)

        assert state2.haystack_needles == 25
        assert state2.misplaced_needles == 3
        assert state2.starting_count == 100
        assert state2.current_cir_screen == "adjudication"
        assert state2.surgeon_id == "doc_123"
        assert state2.cbi_notification_counts.contaminated == 2
        assert state2.cbi_notification_counts.broken == 1
        assert len(state2.analyzed_needles) == 1
        assert state2.analyzed_needles[0]["id"] == "needle_1"
        assert state2.haystack_reason_counts["broken"] == 5
        assert state2.haystack_reason_counts["multiple"] == 2

    def test_clear_and_reload(self, tmp_path, monkeypatch):
        new_parlay = config.parlay._replace(restore_state=True)
        monkeypatch.setattr(config, "parlay", new_parlay)
        file_path = tmp_path / "app_state.json"

        state = AppState(haystack_needles=50)
        state.set_file_path(file_path)
        state.save()

        state.clear()

        # File should be deleted
        assert not file_path.exists()

        # Loading should create new empty state
        new_state = AppState.load(file_path)
        assert new_state.haystack_needles == 0
