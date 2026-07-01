"""
Application State Model for crash recovery and state persistence.
Uses Pydantic for validation and serialization.
"""

from __future__ import annotations

import json
import logging
from enum import IntEnum
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from hayapp_python.common.needle_state_machine import NeedleState, NeedleStateMachine

logger = logging.getLogger("hayapp")


class Stage(IntEnum):
    """Case stage enum for tracking surgery progress."""

    SETUP = 1
    ACTIVE = 2
    CLOSING = 3


class CBINotificationCounts(BaseModel):
    """CBI notification counts for each type."""

    contaminated: int = 0
    incompatible: int = 0
    broken: int = 0
    misplaced: int = 0


class AppState(BaseModel):
    """
    Application state for crash recovery.
    Call save() after making changes to persist to disk.
    """

    # Needle tracking
    analyzed_needles: list[dict[str, Any]] = Field(default_factory=list)
    pending_cbi_validations: list[dict[str, Any]] = Field(default_factory=list)
    latest_needle_result: dict[str, Any] | None = None

    # Counts
    haystack_needles: int = 0
    misplaced_needles: int = 0
    whole_misplaced_needles: int = 0
    found_non_sterile_needles: int = 0
    haystack_reason_counts: dict[str, int] = Field(default_factory=dict)
    added_needle_count: int = 0
    interim_added_needle_count: int = 0
    starting_count: int = 0
    incompatible_needle_count: int = 0
    contaminated_needle_count: int = 0
    broken_needle_count: int = 0
    confirmed_misplaced: int = 0
    hayscan_count: int = 0
    haystack_analyzed_count: int = 0
    # Haystack broken halves where has_other_piece=True (partner claimed to be in CBI box)
    haystack_paired_broken_count: int = 0

    # CBI tracking
    cbi_confirmed_counts: dict[str, int] = Field(default_factory=dict)
    cbi_notification_counts: CBINotificationCounts = Field(default_factory=CBINotificationCounts)
    last_cbi_image: dict[str, Any] | None = None

    # Screen tracking
    current_cir_screen: str = ""
    current_scr_screen: str = ""

    # Staff tracking
    surgeon_id: str = ""
    cir_id: str = ""
    scr_id: str = ""

    # Expected login role (set when user selects role before badge scan)
    expected_login_role: str = ""

    # Total count tracking
    confirmed_total: int = 0
    field_count: int = 0

    # Stage tracking
    stage: Stage = Stage.SETUP

    # Pending needle confirmation (stores suture pack info while waiting for SCR)
    pending_needle_confirmation: dict[str, Any] | None = None

    # Current pack being confirmed by CIR (for SCR to display on CountTypes screen)
    current_confirming_pack: dict[str, Any] | None = None

    # Current index in CIR's caseSutures array (tracks which pack CIR is on)
    current_confirming_index: int = 0

    # Cached enriched summary sheet items (includes full nomenclature from SuturePackInfo)
    enriched_summary_items: list[dict[str, Any]] = Field(default_factory=list)

    # Redundancy adjustments from REVIEW_REDUNDANT_NEEDLES step
    # (persisted to survive surgeon additions)
    redundant_adjustments: list[dict[str, Any]] = Field(default_factory=list)

    # Setup state - selected surgeons with their case groups for current case
    # Format: [{
    #     "surgeon_id": str,
    #     "case_groups": [{
    #         "primary": {
    #             "case_type_id": str,
    #             "name": str,
    #             "cpt_code": str,
    #             "is_primary": bool,
    #             "secondary_cpt_codes": [str]
    #         },
    #         "addOns": [{
    #             "case_type_id": str,
    #             "name": str,
    #             "cpt_code": str,
    #             "is_primary": bool,
    #             "secondary_cpt_codes": [str]
    #         }]
    #     }]
    # }]
    selected_surgeons_with_case_groups: list[dict[str, Any]] = Field(default_factory=list)

    # Last confirmed CBI image record per needle type (contaminated/incompatible/broken)
    # Used by the Remove From CBI compare screen to show the previously confirmed image
    last_cbi_images_by_type: dict[str, Any] = Field(default_factory=dict)

    # Private - file path for persistence
    _file_path: Path | None = None

    class Config:
        underscore_attrs_are_private = True
        extra = "allow"

    def set_file_path(self, path: Path | str) -> None:
        """Set the file path for persistence."""
        object.__setattr__(self, "_file_path", Path(path) if isinstance(path, str) else path)

    def _serialize_needles(self) -> list[dict[str, Any]]:
        """
        Create a serializable copy of analyzed_needles by removing needle_state_machine objects.
        """
        serialized = []
        for needle in self.analyzed_needles:
            needle_copy = dict(needle)
            if "needle_state_machine" in needle_copy:
                del needle_copy["needle_state_machine"]
            serialized.append(needle_copy)
        return serialized

    def save(self) -> bool:
        """
        Save the current state to disk.
        Returns True if successful, False otherwise.
        Only saves if restore_state is enabled in config.
        """
        # Check if state restoration is disabled in config
        from hayapp_python.common.config_manager import config

        if not config.parlay.restore_state:
            return True  # Return success but don't actually save

        try:
            file_path = object.__getattribute__(self, "_file_path")
        except AttributeError:
            logger.error("AppState: No file path set, cannot save")
            return False

        if not file_path:
            logger.error("AppState: No file path set, cannot save")
            return False

        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Build serializable dict manually to handle needle_state_machine
            data = {
                "analyzed_needles": self._serialize_needles(),
                "pending_cbi_validations": self.pending_cbi_validations,
                "latest_needle_result": self.latest_needle_result,
                "haystack_needles": self.haystack_needles,
                "misplaced_needles": self.misplaced_needles,
                "haystack_reason_counts": self.haystack_reason_counts,
                "added_needle_count": self.added_needle_count,
                "interim_added_needle_count": self.interim_added_needle_count,
                "starting_count": self.starting_count,
                "incompatible_needle_count": self.incompatible_needle_count,
                "contaminated_needle_count": self.contaminated_needle_count,
                "broken_needle_count": self.broken_needle_count,
                "confirmed_misplaced": self.confirmed_misplaced,
                "hayscan_count": self.hayscan_count,
                "haystack_analyzed_count": self.haystack_analyzed_count,
                "haystack_paired_broken_count": self.haystack_paired_broken_count,
                "cbi_confirmed_counts": self.cbi_confirmed_counts,
                "cbi_notification_counts": self.cbi_notification_counts.model_dump(),
                "last_cbi_image": self.last_cbi_image,
                "current_cir_screen": self.current_cir_screen,
                "current_scr_screen": self.current_scr_screen,
                "surgeon_id": self.surgeon_id,
                "cir_id": self.cir_id,
                "scr_id": self.scr_id,
                "confirmed_total": self.confirmed_total,
                "stage": int(self.stage),
                "current_confirming_pack": self.current_confirming_pack,
                "current_confirming_index": self.current_confirming_index,
                "enriched_summary_items": self.enriched_summary_items,
                "redundant_adjustments": self.redundant_adjustments,
                "selected_surgeons_with_case_groups": self.selected_surgeons_with_case_groups,
                "last_cbi_images_by_type": self.last_cbi_images_by_type,
            }

            json_str = json.dumps(data, indent=2)
            file_path.write_text(json_str)
            return True
        except Exception as e:
            logger.error(f"AppState: Failed to save state: {e}")
            return False

    @classmethod
    def load(cls, path: Path | str) -> "AppState":
        """
        Load state from disk.
        Returns a new AppState if file doesn't exist, is empty, or is invalid.
        """
        file_path = Path(path) if isinstance(path, str) else path

        if not file_path.exists():
            state = cls()
            state.set_file_path(file_path)
            return state

        try:
            json_str = file_path.read_text().strip()

            # Handle empty file
            if not json_str:
                state = cls()
                state.set_file_path(file_path)
                return state

            data = json.loads(json_str)

            # Handle empty JSON object
            if not data:
                state = cls()
                state.set_file_path(file_path)
                return state

            # Handle nested CBINotificationCounts
            if "cbi_notification_counts" in data and isinstance(
                data["cbi_notification_counts"], dict
            ):
                data["cbi_notification_counts"] = CBINotificationCounts(
                    **data["cbi_notification_counts"]
                )

            # Convert stage int to Stage enum if present
            if "stage" in data and isinstance(data["stage"], int):
                data["stage"] = Stage(data["stage"])

            state = cls(**data)
            state.set_file_path(file_path)
            return state
        except json.JSONDecodeError as e:
            logger.error(f"AppState: Invalid JSON in state file: {e}")
            state = cls()
            state.set_file_path(file_path)
            return state
        except Exception as e:
            logger.error(f"AppState: Failed to load state: {e}")
            import traceback

            traceback.print_exc()
            state = cls()
            state.set_file_path(file_path)
            return state

    def clear(self) -> None:
        """Clear all state and delete the file."""
        self.analyzed_needles = []
        self.pending_cbi_validations = []
        self.latest_needle_result = None
        self.haystack_needles = 0
        self.misplaced_needles = 0
        self.whole_misplaced_needles = 0
        self.found_non_sterile_needles = 0
        self.haystack_reason_counts = {}
        self.added_needle_count = 0
        self.interim_added_needle_count = 0
        self.starting_count = 0
        self.incompatible_needle_count = 0
        self.contaminated_needle_count = 0
        self.broken_needle_count = 0
        self.confirmed_misplaced = 0
        self.hayscan_count = 0
        self.haystack_analyzed_count = 0
        self.haystack_paired_broken_count = 0
        self.cbi_confirmed_counts = {}
        self.cbi_notification_counts = CBINotificationCounts()
        self.last_cbi_image = None
        self.current_cir_screen = ""
        self.current_scr_screen = ""
        self.surgeon_id = ""
        self.cir_id = ""
        self.scr_id = ""
        self.stage = Stage.SETUP
        self.pending_needle_confirmation = None
        self.current_confirming_pack = None
        self.current_confirming_index = 0
        self.enriched_summary_items = []
        self.redundant_adjustments = []
        self.selected_surgeons_with_case_groups = []
        self.last_cbi_images_by_type = {}

        try:
            file_path = object.__getattribute__(self, "_file_path")
            if file_path and file_path.exists():
                file_path.unlink()
        except Exception as e:
            logger.error(f"AppState: Failed to delete state file: {e}")

    def restore_needle_state_machines(self) -> list[dict[str, Any]]:
        """
        Restore needle_state_machine objects to analyzed needles.
        Returns the needles with their state machines restored.
        """
        for needle in self.analyzed_needles:
            if "needle_state" in needle:
                state_name = needle["needle_state"]
                try:
                    initial_state = NeedleState[state_name]
                    needle["needle_state_machine"] = NeedleStateMachine(initial_state=initial_state)
                except KeyError:
                    needle["needle_state_machine"] = NeedleStateMachine()
            else:
                needle["needle_state_machine"] = NeedleStateMachine()
        return self.analyzed_needles

    def is_fresh(self) -> bool:
        """
        Check if this is a fresh/empty state with no meaningful data.
        Returns True only if no meaningful state has been set.
        """
        has_screens = bool(self.current_cir_screen or self.current_scr_screen)
        has_staff = bool(self.surgeon_id or self.cir_id or self.scr_id)
        has_needles = len(self.analyzed_needles) > 0
        has_pending_cbi = len(self.pending_cbi_validations) > 0
        has_counts = (
            self.haystack_needles > 0
            or self.misplaced_needles > 0
            or self.added_needle_count > 0
            or self.starting_count > 0
            or self.incompatible_needle_count > 0
            or self.contaminated_needle_count > 0
            or self.broken_needle_count > 0
            or self.hayscan_count > 0
        )
        has_reason_counts = len(self.haystack_reason_counts) > 0

        return not (
            has_screens
            or has_staff
            or has_needles
            or has_pending_cbi
            or has_counts
            or has_reason_counts
        )

    def to_restored_state_dict(self) -> dict[str, Any]:
        """Return the state dictionary for frontend restoration."""
        return {
            "is_fresh": self.is_fresh(),
            "current_cir_screen": self.current_cir_screen,
            "current_scr_screen": self.current_scr_screen,
            "cbi_notification_counts": self.cbi_notification_counts.model_dump(),
            "starting_count": self.starting_count,
            "added_needle_count": self.added_needle_count,
            "surgeon_id": self.surgeon_id,
            "cir_id": self.cir_id,
            "scr_id": self.scr_id,
        }
