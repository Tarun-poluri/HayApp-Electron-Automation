import base64
import json
import logging
import os
import re
import threading
import time
from dataclasses import asdict
from threading import Lock
from typing import Any, Optional

from parlay import ParlayCommandItem, ParlayProperty, local_item, parlay_command
from parlay.server.broker import run_in_thread

from hayapp_python.common.config_manager import config
from hayapp_python.common.defs import CaseManager_item as item
from hayapp_python.common.defs import CaseState as State
from hayapp_python.common.defs import (
    NeedleResponseType,
    ScrubScreen,
    ScrubScreenToLedMapping,
)
from hayapp_python.common.enums import (
    AdjudicationReason,
    CIRScreen,
    HayAppRole,
    SCRScreen,
)
from hayapp_python.common.events import (
    ErrorEvent,
    HaystackConnectionEvent,
    ImageAnalyzedEvent,
    NeedleImageCapturedEvent,
    ScrConfirmedFieldCountEvent,
    ScrTotalConfirmationEvent,
    TotalValidationStatus,
)
from hayapp_python.common.logger import log_command
from hayapp_python.common.needle_state_machine import (
    NeedleState,
    NeedleStateMachine,
    set_result_state_name,
)
from hayapp_python.common.parlay_mixin import ThreadSafePublishMixin
from hayapp_python.common.paths import HAYSCAN_IMAGE_PATH
from hayapp_python.common.utils import (
    find_in_enum,
    get_local_time_string,
    get_utc_iso_timestamp,
    hash_password,
)
from hayapp_python.items.all_in_one import AllInOneAdapter
from hayapp_python.items.app_state import AppState, CBINotificationCounts, Stage
from hayapp_python.items.camera_adapter import Camera, VIRResponseError
from hayapp_python.items.data_store import DataStore
from hayapp_python.items.haystack.haystack_adapter import HayStack
from hayapp_python.items.haystack.haystack_interface import (
    BtnIndicatorCommand,
    IlluminatorCommand,
    LedCommand,
    SetCommand,
)
from hayapp_python.items.models import (
    AdjudicatedImage,
    Case,
    CaseSuture,
    ClosingCount,
    InterimCount,
    LoginEvent,
    ReliefCount,
)
from hayapp_python.items.scanner_adapter import HayScanner
from hayapp_python.iTrace.decoder_adapter import DecoderAdapter
from hayapp_python.iTrace.detector_adapter import DetectorAdapter

logger = logging.getLogger("hayapp")


@local_item()
class CaseManager(ThreadSafePublishMixin, ParlayCommandItem):
    """
    Case Manager is responsible for coordinating the surgical case being performed.
    Uses AppState as the single source of truth for all runtime state.
    """

    __version__: str = "0.0.1"

    # Class-level lock to protect access to shared staff lists across multiple instances
    _staff_lock = Lock()

    state = ParlayProperty(default=State.NOT_STARTED, val_type=int, read_only=True)
    name = ParlayProperty(default="", val_type=str, read_only=True)
    cir_name = ParlayProperty(default="", val_type=str, read_only=True)
    scr_name = ParlayProperty(default="", val_type=str, read_only=True)
    surgeon = ParlayProperty(default="", val_type=str, read_only=True)
    selected_case_types = ParlayProperty(default=[], val_type=list, read_only=True)
    new_reference_image = ParlayProperty(default=True, val_type=bool)
    max_image_retries = ParlayProperty(default=1, val_type=int)

    def __init__(
        self,
        item_id=item.id,
        name: str = "Case Manager",
        model: DataStore = None,
        scanner: HayScanner = None,
        haystack: HayStack = None,
        decoder: DecoderAdapter = None,
        detector: DetectorAdapter = None,
        camera: Camera = None,
        all_in_one: AllInOneAdapter = None,
    ):
        ParlayCommandItem.__init__(self, item_id=item.id, name=item.name)
        self.data_store = model if model else DataStore()
        self.scanner = scanner if scanner else HayScanner()
        self.haystack = haystack if haystack else HayStack()
        self.decoder = decoder if decoder else DecoderAdapter()
        self.detector = detector if detector else DetectorAdapter()
        self.camera = camera if camera else Camera()
        self.all_in_one = all_in_one if all_in_one else AllInOneAdapter()
        self.login_events: list[LoginEvent] = []
        self.case = self.data_store.get_case_model()
        if self.case is None:
            self.case = Case()
            self.data_store.save_case(self.case)
        self.cap_btn_indicate_state: Optional[BtnIndicatorCommand] = None

        # Protect staff data loading with lock to prevent race conditions
        with CaseManager._staff_lock:
            self.hayapp_users = self.data_store.get_hayapp_users_objects()
            self.surgeons = self.data_store.get_surgeons_objects()

        # Initialize app state - single source of truth for all runtime state
        state_file_path = config.paths.database_path / "app_state.json"

        # Only load state if restore_state is enabled, otherwise start fresh
        if config.parlay.restore_state:
            self.app_state = AppState.load(state_file_path)
        else:
            # Start with fresh state and delete any existing state file
            self.app_state = AppState()
            self.app_state.set_file_path(state_file_path)
            if state_file_path.exists():
                state_file_path.unlink()

        self.last_pix_per_mm = None

        # Event is pre-set (valid) so on_deposit_ready proceeds unless a new reference
        # image cycle is in progress. Cleared by on_moved_to_sharps before capture begins,
        # then set again by take_reference_image_with_retry once processing completes.
        self._reference_image_event = threading.Event()
        self._reference_image_event.set()
        self._reference_image_valid = True

        self._pending_analyzed_result: Optional[dict] = None
        self._pending_analyzed_lock = threading.Lock()

        # Subscribe to all events from the haystack and filter by EVENT type in the callback
        self.subscribe(self.on_stack_needle_event, MSG_TYPE="EVENT", FROM=self.haystack.item_id)
        self.subscribe(self.on_stack_tray_event, MSG_TYPE="EVENT", FROM=self.haystack.item_id)
        self.subscribe(self.on_analyzed_event, MSG_TYPE="EVENT", FROM=self.detector.item_id)
        self.subscribe(self.on_stack_connection_event, MSG_TYPE="EVENT", FROM=self.haystack.item_id)

        # Subscribe to all events from the scanner
        self.subscribe(self.on_scanner_event, MSG_TYPE="EVENT", FROM=self.scanner.item_id)

    def reload_reference_staff_from_store(self) -> None:
        """
        Refresh in-memory surgeon and HayApp user lists from the DataStore (e.g. after
        sync_group_data / _first_time_migration on the shared broker DataStore).
        """
        with CaseManager._staff_lock:
            self.hayapp_users = self.data_store.get_hayapp_users_objects()
            self.surgeons = self.data_store.get_surgeons_objects()

    # ========== State restoration methods ==========

    def _restore_from_app_state(self):
        """
        Restore state from file when frontend requests it.
        Reloads AppState from disk and restores needle state machines.
        Can be disabled by setting restore_state=False in hayapp_config.ini.
        """
        # Check if restoration is disabled
        restore_enabled = config.parlay.restore_state

        if not restore_enabled:
            # Return a fresh state instead
            state_file_path = config.paths.database_path / "app_state.json"
            self.app_state = AppState()
            self.app_state.set_file_path(state_file_path)
            return

        state_file_path = config.paths.database_path / "app_state.json"
        self.app_state = AppState.load(state_file_path)
        self.app_state.restore_needle_state_machines()

    def _sync_staff_to_app_state(self):
        """
        Sync current staff IDs from case to app state.
        Called during dashboard updates to ensure staff IDs are persisted.
        """
        surgeon_id = ""
        cir_id = ""
        scr_id = ""
        if self.case and self.case.staff:
            if self.case.staff.surgeon and len(self.case.staff.surgeon) > 0:
                surgeon_id = self.case.staff.surgeon[-1].surgeon_id
            if self.case.staff.cir and len(self.case.staff.cir) > 0:
                cir_id = self.case.staff.cir[-1].user_id
            if self.case.staff.scr and len(self.case.staff.scr) > 0:
                scr_id = self.case.staff.scr[-1].user_id

        self.app_state.surgeon_id = surgeon_id
        self.app_state.cir_id = cir_id
        self.app_state.scr_id = scr_id

    # ========== Startup and initialization ==========

    @parlay_command()
    def on_start_up(self):
        """
        Perform any startup initialization tasks.
        Delays health checks briefly to allow the frontend WebSocket to connect
        and register its event listeners before events are published.
        """
        logger.info("Checking storage space...")
        self.all_in_one.get_storage_space()
        logger.info("Checking battery level...")
        self.all_in_one.check_battery_low()

        if self.haystack.is_connected:
            self._handle_haystack_connected()

    @parlay_command()
    def reset_haystack(self):
        log_command("reset_haystack", self.case)
        btn_command = BtnIndicatorCommand(btn1=False, btn2=False, btn3=False, btn4=False)
        self.haystack.reset_needle_count()
        self.detector.reset_analyzed_count()
        self.haystack.set_state(SetCommand.NOT_READY)
        self.haystack.set_cap_btn_indicate(btn_command)
        self.haystack.set_illuminator(IlluminatorCommand.OFF)
        return True

    @parlay_command()
    def restart_count(self):
        """
        Restart the counting process.
        Keeps case_sutures (scanned packs) but resets the confirmation progress.
        All packs need to be confirmed again (field counts re-entered).
        """
        log_command("restart_count", self.case)

        # Reset app state counters
        self.app_state.current_confirming_index = 0
        self.app_state.confirmed_total = 0
        self.app_state.field_count = 0
        self.app_state.current_confirming_pack = None

        # Save changes
        self.data_store.save_case(self.case)
        self.app_state.save()
        return True

    @parlay_command()
    def start_haystack(self):
        if self.haystack.status_tray:
            self.initialize_haystack()

    @parlay_command()
    def version(self):
        version = CaseManager.__version__
        log_command("version", self.case, version)
        return version

    @parlay_command()
    def get_restore_state_enabled(self):
        """Return whether state restoration is enabled in config."""
        return config.parlay.restore_state

    @parlay_command()
    def get_development_mode(self):
        """Return whether development mode is enabled in config."""
        return config.parlay.development_mode

    @parlay_command()
    def get_staff_ids(self):
        """
        Return current staff IDs without affecting app state.
        Used for loading staff in skip/demo flows.
        """
        return {
            "surgeon_id": self.app_state.surgeon_id,
            "cir_id": self.app_state.cir_id,
            "scr_id": self.app_state.scr_id,
        }

    @parlay_command()
    def get_case_info_memory(self):
        info = self.case.to_dict() if self.case else {}
        log_command("get_case_info_memory", self.case, info)
        return info

    @parlay_command()
    def verify_login(
        self, email: str = None, password: str = None, role: str = None, badge: str = None
    ):
        """
        Verify login credentials - supports both password and badge authentication.
        Either (email + password + role) OR (badge + role) must be provided.
        """
        log_command(
            "verify_login",
            self.case,
            {"email": email, "role": role, "badge": badge if badge else None},
        )
        event = None
        if not self.hayapp_users or len(self.hayapp_users) == 0:
            return False

        # Badge authentication
        if badge:
            user = next((u for u in self.hayapp_users if u.badge == badge), None)
            if user is None:
                # Convert role string to HayAppRole enum (search by value)
                role_enum = next((r for r in HayAppRole if r.value == role), None) if role else None
                event = LoginEvent(
                    type="failed_badge",
                    when=get_utc_iso_timestamp(),
                    who=badge,
                    role=role_enum,
                    password=None,
                )
                self.data_store.save_login_event(self.case, event)
                return False

            # Badge login requires explicit role
            if not role:
                return False

            # Validate that user has the requested role
            role = role.strip().upper()
            user_roles = [r.value for r in user.roles]
            if role not in user_roles:
                # Convert role string to HayAppRole enum (search by value)
                role_enum = next((r for r in HayAppRole if r.value == role), None)
                event = LoginEvent(
                    type="failed_badge",
                    when=get_utc_iso_timestamp(),
                    who=f"{user.first_name} {user.last_name}".strip(),
                    role=role_enum,
                    password=None,
                )
                self.data_store.save_login_event(self.case, event)
                return False

            full_name = f"{user.first_name} {user.last_name}".strip()
            event = LoginEvent(
                type="badge_login",
                when=get_utc_iso_timestamp(),
                who=full_name,
                role=HayAppRole(role),
                password=None,
            )
            self.data_store.save_login_event(self.case, event)
            self.add_case_worker(user.user_id, role)
            return True

        # Email/password authentication
        if not email or not password or not role:
            return False

        email = email.strip().lower()
        user = next(
            (u for u in self.hayapp_users if u.email and u.email.strip().lower() == email),
            None,
        )
        if user is None:
            event = LoginEvent(
                type="failed",
                when=get_utc_iso_timestamp(),
                who=email,
                role=HayAppRole(role),
                password=password,
            )
            self.data_store.save_login_event(self.case, event)
            return False

        role = role.strip().upper()
        user_roles = [r.value for r in user.roles]
        if role not in user_roles:
            event = LoginEvent(
                type="failed",
                when=get_utc_iso_timestamp(),
                who=email,
                role=HayAppRole(role) if role in HayAppRole.__members__ else HayAppRole.Circulator,
                password=password,
            )
            self.data_store.save_login_event(self.case, event)
            return False
        password_hash = hash_password(password, salt=user.salt)
        if user.password_hash != password_hash:
            event = LoginEvent(
                type="failed",
                when=get_utc_iso_timestamp(),
                who=email,
                role=HayAppRole(role),
                password=password,
            )
            self.data_store.save_login_event(self.case, event)
            return False

        event = LoginEvent(
            type="login",
            when=get_utc_iso_timestamp(),
            who=email,
            role=HayAppRole(role),
            password=password,
        )
        self.data_store.save_login_event(self.case, event)
        self.add_case_worker(user.user_id, role)
        return True

    @parlay_command()
    def set_expected_login_role(self, role: str):
        """
        Set the expected login role for badge authentication.
        Called by frontend before user scans their badge to indicate which role
        they're logging in as.
        """
        log_command("set_expected_login_role", self.case, role)
        self.app_state.expected_login_role = role
        self.app_state.save()
        return True

    @parlay_command()
    def logout_user(self, role: str):
        """
        Logout a user by role (CIR or SCR).
        Clears the user from app state and updates properties.
        Returns info about remaining logged-in users.
        """
        log_command("logout_user", self.case, role)

        # Validate role
        if role not in ["CIR", "SCR"]:
            logger.error(f"Invalid role for logout: {role}")
            return {"success": False, "error": "Invalid role"}

        # Clear the appropriate user ID in app state and case staff
        # so _sync_staff_to_app_state won't restore the logged-out user
        if role == "CIR":
            self.app_state.cir_id = ""
            if self.case and self.case.staff:
                self.case.staff.cir.clear()
        elif role == "SCR":
            self.app_state.scr_id = ""
            if self.case and self.case.staff:
                self.case.staff.scr.clear()

        self.app_state.save()

        # Return info about what's left
        has_cir = bool(self.app_state.cir_id)
        has_scr = bool(self.app_state.scr_id)
        # Check if at least one role is still logged in after this logout
        at_least_one_still_logged_in = has_cir or has_scr

        return {
            "success": True,
            "at_least_one_still_logged_in": at_least_one_still_logged_in,
            "has_cir": has_cir,
            "has_scr": has_scr,
        }

    @parlay_command()
    def set_case_types(self, case_types_list: list[dict]):
        log_command("set_case_types", self.case, case_types_list)
        if isinstance(case_types_list, str):
            import json

            case_types_list = json.loads(case_types_list)
        self.data_store.set_case_types(self.case, case_types_list)
        return True

    @parlay_command()
    def remove_case_type(self, case_type_id: str):
        log_command("remove_case_type", self.case, case_type_id)
        if not case_type_id or len(case_type_id) == 0:
            return False
        self.data_store.remove_case_type(self.case, case_type_id)
        return True

    @parlay_command()
    def add_case_worker(self, user_id: str, role: str):
        log_command(
            "add_case_worker",
            self.case,
            {"user_id": user_id, "role": role},
        )
        user = next((u for u in self.hayapp_users if u.user_id == user_id), None)
        if not user:
            return False
        try:
            hayapp_role = HayAppRole(role)
        except ValueError:
            return False
        if hayapp_role not in user.roles:
            return False
        result = self.data_store.add_case_worker(self.case, user_id, role)

        # Sync and save staff IDs after adding worker
        self._sync_staff_to_app_state()
        self.app_state.save()

        return result

    @parlay_command()
    def add_surgeon(self, surgeon_id: str):
        log_command("add_surgeon", self.case, surgeon_id)
        surgeon = next((s for s in self.surgeons if s.surgeon_id == surgeon_id), None)
        if not surgeon:
            return False
        result = self.data_store.add_surgeon(self.case, surgeon_id)

        # Sync and save staff IDs after adding surgeon
        self._sync_staff_to_app_state()
        self.app_state.save()

        return result

    @parlay_command()
    def set_case_staff(self, surgeon_id: str = None, cir_id: str = None, scr_id: str = None):
        log_command(
            "set_case_staff",
            self.case,
            {"surgeon_id": surgeon_id, "cir_id": cir_id, "scr_id": scr_id},
        )
        if surgeon_id is not None:
            staff = next((s for s in self.surgeons if s.surgeon_id == surgeon_id), None)
            if staff:
                self.add_surgeon(surgeon_id)
        if cir_id is not None:
            staff = next(
                (
                    u
                    for u in self.hayapp_users
                    if u.user_id == cir_id and HayAppRole.Circulator in u.roles
                ),
                None,
            )
            if staff:
                self.add_case_worker(user_id=cir_id, role="CIR")
        if scr_id is not None:
            staff = next(
                (
                    u
                    for u in self.hayapp_users
                    if u.user_id == scr_id and HayAppRole.Scrub in u.roles
                ),
                None,
            )
            if staff:
                self.add_case_worker(user_id=scr_id, role="SCR")
        return True

    @parlay_command()
    def set_surgeons_with_case_types(self, surgeons_data: list[dict]):
        """
        Set multiple surgeons with their associated case types.
        Stores complete structure in app_state for state tracking.

        surgeons_data format: [
            {
                "surgeon_id": "123",
                "case_groups": [{"primary": {...}, "addOns": [...]}]
            },
            ...
        ]
        """
        log_command("set_surgeons_with_case_types", self.case, surgeons_data)

        if isinstance(surgeons_data, str):
            import json

            surgeons_data = json.loads(surgeons_data)

        # Store in app_state for state tracking and totals calculation
        # CRITICAL: Use deep copy to avoid reference sharing issues where modifications
        # to the original
        # data would also modify what's stored in app_state
        import copy

        self.app_state.selected_surgeons_with_case_groups = copy.deepcopy(surgeons_data)
        self.app_state.save()

        # Clear existing surgeons
        self.case.staff.surgeon = []

        # Add each surgeon
        for surgeon_data in surgeons_data:
            surgeon_id = surgeon_data.get("surgeon_id")
            if surgeon_id:
                surgeon = next((s for s in self.surgeons if s.surgeon_id == surgeon_id), None)
                if surgeon:
                    self.add_surgeon(surgeon_id)

        # Collect all case types from all surgeons
        all_case_types = []
        for surgeon_data in surgeons_data:
            for group in surgeon_data.get("case_groups", []):
                primary = group.get("primary")
                if primary:
                    all_case_types.append(primary)
                for add_on in group.get("addOns", []):
                    all_case_types.append(add_on)

        # Set all case types (this will combine them)
        if all_case_types:
            self.data_store.set_case_types(self.case, all_case_types)

        # Notify all dashboards of surgeon changes
        self.update_dashboards()

        return True

    @parlay_command()
    def get_surgeons_with_case_types(self):
        """
        Get current surgeons with their per-surgeon case groups from app_state.
        Returns surgeon details (from reference DB) merged with their case_groups.
        """
        surgeons_result = []
        for entry in self.app_state.selected_surgeons_with_case_groups:
            surgeon_id = entry.get("surgeon_id")
            surgeon_data = self.data_store.get_surgeon_by_id(surgeon_id)
            if surgeon_data:
                surgeons_result.append(
                    {
                        **surgeon_data,
                        "case_groups": entry.get("case_groups", []),
                    }
                )
        result = {"surgeons": surgeons_result}
        log_command("get_surgeons_with_case_types", self.case, result)
        return result

    @parlay_command()
    def add_bad_needle(self, image: list, amount: int, verified: bool):
        log_command(
            "add_bad_needle",
            self.case,
            {"image": image, "amount": amount, "verified": verified},
        )
        self.data_store.add_bad_needle(self.case, image, amount, verified)
        return True

    @parlay_command()
    def get_bad_needles(self):
        result = self.data_store.get_bad_needles()
        log_command("get_bad_needles", self.case, result)
        return result

    @parlay_command()
    def add_interim_count(
        self,
        when: str,
        cir_id: int,
        scr_id: int,
        remaining_count: int,
        bad_needles_count: int,
        verified: bool,
    ):
        log_command(
            "add_interim_count",
            self.case,
            {
                "when": when,
                "cir_id": cir_id,
                "scr_id": scr_id,
                "remaining_count": remaining_count,
                "bad_needles_count": bad_needles_count,
                "verified": verified,
            },
        )
        interim_count = InterimCount(
            when=when,
            cir_id=cir_id,
            scr_id=scr_id,
            remaining_count=remaining_count,
            bad_needles_count=bad_needles_count,
            verified=verified,
        )
        self.data_store.add_interim_count(self.case, interim_count)
        return True

    @parlay_command()
    def add_relief_count(
        self,
        when: str,
        remaining_count: int,
        bad_needles_count: int,
        misplaced_count: int,
        remaining_verified: bool,
        bad_needles_verified: bool,
        total_needles_verified: bool,
        relief_count_verified: bool,
        cir_replaced: bool,
        scr_replaced: bool,
        cir_replacement_id: str = None,
        scr_replacement_id: str = None,
    ):
        log_command(
            "add_relief_count",
            self.case,
            {
                "when": when,
                "remaining_count": remaining_count,
                "bad_needles_count": bad_needles_count,
                "misplaced_count": misplaced_count,
                "remaining_verified": remaining_verified,
                "bad_needles_verified": bad_needles_verified,
                "total_needles_verified": total_needles_verified,
                "relief_count_verified": relief_count_verified,
                "cir_replaced": cir_replaced,
                "scr_replaced": scr_replaced,
                "cir_replacement_id": cir_replacement_id,
                "scr_replacement_id": scr_replacement_id,
            },
        )
        cir_name = ""
        scr_name = ""
        if self.case.staff.cir:
            cir_worker = self.case.staff.cir[-1]
            cir_staff = next(
                (u for u in self.hayapp_users if u.user_id == cir_worker.user_id), None
            )
            if cir_staff:
                cir_name = f"{cir_staff.first_name} {cir_staff.last_name}".strip()
        if self.case.staff.scr:
            scr_worker = self.case.staff.scr[-1]
            scr_staff = next(
                (u for u in self.hayapp_users if u.user_id == scr_worker.user_id), None
            )
            if scr_staff:
                scr_name = f"{scr_staff.first_name} {scr_staff.last_name}".strip()
        relief_count = ReliefCount(
            when=when,
            cir=cir_name,
            scr=scr_name,
            remaining_count=remaining_count,
            bad_needles_count=bad_needles_count,
            misplaced_count=misplaced_count,
            remaining_verified=remaining_verified,
            bad_needles_verified=bad_needles_verified,
            total_needles_verified=total_needles_verified,
            relief_count_verified=relief_count_verified,
            cir_replaced=cir_replaced,
            scr_replaced=scr_replaced,
            cir_replacement_id=cir_replacement_id,
            scr_replacement_id=scr_replacement_id,
        )
        self.data_store.add_relief_count(self.case, relief_count)
        if cir_replaced and cir_replacement_id is not None:
            self.add_case_worker(user_id=cir_replacement_id, role="CIR")
        if scr_replaced and scr_replacement_id is not None:
            self.add_case_worker(user_id=scr_replacement_id, role="SCR")
        return True

    @parlay_command()
    def set_case_state(self, state: int):
        log_command("set_case_state", self.case, state)
        previous_state = self.case.state
        self.data_store.set_case_state(self.case, state)
        return {"previous_state": previous_state, "new_state": self.case.state}

    @parlay_command()
    def add_case_suture(
        self,
        fda_guid: str,
        product_code: str,
        nomenclature: str,
        needles_per_pack: int,
        suture_needle_use: str,
        suture_needle_category: str,
    ):
        log_command(
            "add_case_suture",
            self.case,
            {
                "fda_guid": fda_guid,
                "product_code": product_code,
                "nomenclature": nomenclature,
            },
        )
        case_suture = CaseSuture(
            fda_guid=fda_guid,
            num_packs=0,
            product_code=product_code,
            nomenclature=nomenclature,
            needles_per_pack=needles_per_pack,
            suture_needle_use=suture_needle_use,
            suture_needle_category=suture_needle_category,
        )
        self.data_store.add_case_suture(self.case, case_suture)
        return True

    @parlay_command()
    def add_adjudicated_image(
        self,
        image: str,
        one_complete_suture: bool,
        timestamp: str,
        reason: str = "",
        description: str = "",
    ):
        log_command(
            "add_adjudicated_image",
            self.case,
            {
                "image": image,
                "one_complete_suture": one_complete_suture,
                "timestamp": timestamp,
                "reason": reason,
                "description": description,
            },
        )
        adjudicated_image = AdjudicatedImage(
            image=image,
            one_complete_suture=one_complete_suture,
            timestamp=timestamp,
            reason=reason,
            description=description,
        )
        self.data_store.add_adjudicated_image(self.case, adjudicated_image)
        return True

    @parlay_command()
    def get_adjudicated_images(self):
        result = self.data_store.get_adjudicated_images()
        log_command("get_adjudicated_images", self.case, result)
        return result

    @parlay_command()
    def get_pending_adjudications(self):
        result = self.data_store.get_pending_adjudications()
        log_command("get_pending_adjudications", self.case, result)
        return result

    @parlay_command()
    def add_closing_count(
        self,
        when: str,
        cir_id: str,
        scr_id: str,
        remaining_count: int,
        bad_needles_count: int,
        all_loose_sutures_desposited: bool,
        unused_sutures_deposited: bool,
        pending_adjudications_cleared: bool,
        amount_closing_sutures_added: int,
        closing_sutures: list[CaseSuture] = None,
    ):
        log_command(
            "add_closing_count",
            self.case,
            {
                "when": when,
                "cir_id": cir_id,
                "scr_id": scr_id,
                "remaining_count": remaining_count,
                "bad_needles_count": bad_needles_count,
                "all_loose_sutures_desposited": all_loose_sutures_desposited,
                "unused_sutures_deposited": unused_sutures_deposited,
                "pending_adjudications_cleared": pending_adjudications_cleared,
                "amount_closing_sutures_added": amount_closing_sutures_added,
                "closing_sutures": closing_sutures if closing_sutures is not None else [],
            },
        )
        closing_count = ClosingCount(
            when=when,
            cir_id=cir_id,
            scr_id=scr_id,
            remaining_count=remaining_count,
            bad_needles_count=bad_needles_count,
            all_loose_sutures_desposited=all_loose_sutures_desposited,
            unused_sutures_deposited=unused_sutures_deposited,
            pending_adjudications_cleared=pending_adjudications_cleared,
            amount_closing_sutures_added=amount_closing_sutures_added,
            closing_sutures=closing_sutures if closing_sutures is not None else [],
        )
        self.data_store.add_closing_count(self.case, closing_count)
        return True

    @parlay_command()
    def get_surgeons(self):
        result = self.data_store.get_surgeons()
        log_command("get_surgeons", self.case, result)
        return result

    @parlay_command()
    def get_hayapp_users(self):
        result = self.data_store.get_hayapp_users()
        log_command("get_hayapp_users", self.case, result)
        return result

    @parlay_command()
    def get_hayapp_users_by_role(self, role=""):
        result = self.data_store.get_hayapp_users_by_role(role)
        log_command("get_hayapp_users_by_role", self.case, result)
        return result

    @parlay_command()
    def get_case_types(self):
        result = self.data_store.get_case_types()
        log_command("get_case_types", self.case, result)
        return result

    @parlay_command()
    def get_case_types_for_surgeon(self, surgeon_id: str):
        result = self.data_store.get_case_types_for_surgeon(surgeon_id)
        log_command("get_case_types_for_surgeon", self.case, result)
        return result

    @parlay_command()
    def get_surgeon_by_id(self, surgeon_id: str):
        result = self.data_store.get_surgeon_by_id(surgeon_id)
        log_command("get_surgeon_by_id", self.case, result)
        return result

    @parlay_command()
    def get_room_id(self):
        result = self.data_store.get_room_id()
        log_command("get_room_id", self.case, result)
        return result

    @parlay_command()
    def get_suture_pack_info(self, fda_guid: str):
        result = self.data_store.get_suture_pack_info(fda_guid)
        if result:
            # Enrich with suture_needle_use from selected sheets
            result = self._enrich_pack_info_with_sheet_data(result)
        log_command("get_suture_pack_info", self.case, result)
        return result

    @parlay_command()
    def get_suture_sheet(self, suture_sheet_id: str):
        result = self.data_store.get_suture_sheet(suture_sheet_id)
        log_command("get_suture_sheet", self.case, result)
        return result

    @parlay_command()
    def get_suture_sheets_for_surgeon(self, surgeon_id: str):
        result = self.data_store.get_suture_sheets_for_surgeon(surgeon_id)
        log_command("get_suture_sheets_for_surgeon", self.case, result)
        return result

    @parlay_command()
    def get_surgeons_pack_and_needle_totals(self):
        """
        Calculate total packs and needles from the currently selected surgeons stored in app_state.
        Reads from app_state.selected_surgeons_with_case_groups instead of taking parameters.

        Returns:
            {"total_packs": int, "total_needles": int}
        """
        total_packs = 0
        total_needles = 0

        # Read from stored state
        surgeons_data = self.app_state.selected_surgeons_with_case_groups

        if not surgeons_data:
            result = {"total_packs": 0, "total_needles": 0}
            log_command("get_surgeons_pack_and_needle_totals", self.case, result)
            logger.warning("[get_surgeons_pack_and_needle_totals] No surgeons data in " "app_state")
            return result

        for surgeon_entry in surgeons_data:
            surgeon_id = surgeon_entry.get("surgeon_id")

            # Get case_groups from stored data
            case_groups = surgeon_entry.get("case_groups", [])

            # Get all CPT codes for this surgeon
            cpt_codes = []
            for group in case_groups:
                primary = group.get("primary", {})
                add_ons = group.get("addOns", [])

                if primary.get("cpt_code"):
                    cpt_codes.append(primary["cpt_code"])

                for add_on in add_ons:
                    if add_on.get("cpt_code"):
                        cpt_codes.append(add_on["cpt_code"])

            # Get suture sheets for this surgeon
            sheets = self.data_store.get_suture_sheets_for_surgeon(surgeon_id)

            # Filter sheets to only those matching the surgeon's CPT codes
            relevant_sheets = [
                sheet
                for sheet in sheets
                if any(code in sheet.get("cpt_codes", []) for code in cpt_codes)
            ]

            # Process each sheet's items - sum across all surgeons (no deduplication)
            for sheet in relevant_sheets:
                for sheet_item in sheet.get("suture_sheet_items", []):
                    fda_gudid = sheet_item.get("fda_gudid")
                    num_packs = sheet_item.get("num_packs", 0)

                    total_packs += num_packs

                    # Get pack info to find needles per pack
                    pack_info = self.data_store.get_suture_pack_info(fda_gudid)
                    if pack_info:
                        needles_per_pack = pack_info.get("num_needles", 0)
                        total_needles += num_packs * needles_per_pack

        result = {"total_packs": total_packs, "total_needles": total_needles}
        log_command("get_surgeons_pack_and_needle_totals", self.case, result)
        return result

    @parlay_command()
    def surgeon_has_suture_sheet_for_cpt(self, surgeon_id: str, cpt_code: str):
        result = self.data_store.surgeon_has_suture_sheet_for_cpt(surgeon_id, cpt_code)
        log_command("surgeon_has_suture_sheet_for_cpt", self.case, result)
        return result

    @parlay_command()
    def set_selected_suture_sheets(self, sheet_ids: list[str]):
        """Track which suture sheets were selected for this case"""
        self.case.selected_suture_sheet_ids = sheet_ids
        self.data_store.save_case_model(self.case)
        log_command("set_selected_suture_sheets", self.case, {"sheet_ids": sheet_ids})
        return True

    @parlay_command()
    def get_selected_suture_sheets(self):
        """Get the suture sheets selected for this case"""
        sheet_ids = getattr(self.case, "selected_suture_sheet_ids", [])
        sheets = [self.data_store.get_suture_sheet(sid) for sid in sheet_ids]
        result = [s for s in sheets if s is not None]
        log_command("get_selected_suture_sheets", self.case, result)
        return result

    def on_stack_needle_event(self, msg):
        """
        Triggered when Haystack sends any event
        Filters for stack_needle events specifically
        """
        event_name = msg.get("CONTENTS", {}).get("EVENT")
        if event_name != "stack_needle":
            return

        event_data = msg.get("CONTENTS", {}).get("INFO", "{}")
        json_event = json.loads(event_data)
        event_type = json_event.get("event")

        if event_type == "deposit_ready":
            threading.Thread(target=self.on_deposit_ready, daemon=True).start()
        elif event_type == "imaging_ready":
            threading.Thread(target=self.on_imaging_ready, daemon=True).start()
        elif event_type == "moved_to_sharps":
            threading.Thread(target=self.on_moved_to_sharps, daemon=True).start()
        elif event_type == "deposit_no_tray":
            pass

    def on_stack_tray_event(self, msg):
        """
        Triggered when Haystack sends any event
        Filters for stack_tray events specifically
        """
        event_name = msg.get("CONTENTS", {}).get("EVENT")
        if event_name != "stack_tray":
            return

        event_data = msg.get("CONTENTS", {}).get("INFO", "{}")
        json_event = json.loads(event_data)
        event_type = json_event.get("event")

        if event_type == "inserted" and self.app_state.stage != 1:
            time.sleep(1)  # Wait for tray to settle
            threading.Thread(target=self.initialize_haystack, daemon=True).start()
        elif event_type == "removed":
            self.haystack.set_state(SetCommand.NOT_READY)

    @run_in_thread
    def _handle_haystack_connected(self):
        """
        Handle the event when Haystack is connected
        """
        try:
            self.camera.restart_camera()
        except VIRResponseError as e:
            if e.code == 503:
                # Hardware is disconnected
                pass
            else:
                raise
        retries = config.camera.connection_retries
        for i in range(retries):
            try:
                if self.camera.is_connected:
                    break
            except VIRResponseError as e:
                logger.warning(f"Camera status check failed (Code: {e.code}), still waiting...")
            attempt = i + 1
            logger.warning(
                f"Camera is not connected, waiting for connection... "
                f"(attempt {attempt}/{retries})"
            )
            if attempt == retries:
                logger.error("Camera is not connected after max retries")
                self.send_event(
                    **ErrorEvent(
                        title="Camera Connection Failed",
                        msg="The camera is not connected. "
                        "Please reconnect the USB-C cable to continue.",
                    ).to_event()
                )
                break
            time.sleep(config.camera.connection_retry_delay)
        try:
            self.camera.set_exposure()
        except VIRResponseError as e:
            logger.error(f"Failed to set exposure: {e.code}-{e}")
            self.send_event(
                **ErrorEvent(
                    title=f"Exposure Setting Failed (Code: {e.code})",
                    msg=f"Failed to set exposure: {e}",
                ).to_event()
            )
        self.haystack.set_post()
        self.fetch_haystack_calibration()
        self.reset_haystack()
        if self.app_state.stage == Stage.ACTIVE:
            self.haystack.set_drop_area_led(LedCommand.ON)
            if self.cap_btn_indicate_state:
                self.haystack.set_cap_btn_indicate(self.cap_btn_indicate_state)

    def on_stack_connection_event(self, event):
        """
        Triggered when Haystack sends any event
        Filters for stack_connection events specifically
        """
        if connection_event := HaystackConnectionEvent.from_event(event.get("CONTENTS", {})):
            if connection_event.connected:
                self._handle_haystack_connected()
            else:
                try:
                    self.camera.restart_camera()
                except VIRResponseError as e:
                    if e.code == 503:
                        # Hardware is disconnected
                        pass
                    else:
                        raise
                self.send_event(
                    **ErrorEvent(
                        title="HayStack Disconnected",
                        msg="The HayStack has been disconnected. "
                        "Please reconnect the USB-C cable to continue.",
                    ).to_event()
                )

    @parlay_command()
    def haytray_test(self):
        """
        Perform HayTray test to validate tray is properly inserted and empty
        """
        self.haystack.set_state(SetCommand.NOT_READY)
        self.haystack.set_illuminator(IlluminatorCommand.ON)
        if not self.take_reference_image_with_retry(check_empty=False):
            error = "Initial image capture failed, try reinserting the HayTray."
            self.send_event(**ErrorEvent(title="Imaging Error", msg=error).to_event())
            logger.error(error)
            self.haystack.set_state(SetCommand.NOT_READY)
            return False
        # Capture new image and verify the empty image is valid
        previous_max_image_retries = self.max_image_retries
        self.max_image_retries = 0
        if not self.take_reference_image_with_retry():
            # Tray validation failed
            error = "Initial image verification failed, try reinserting the HayTray."
            self.send_event(**ErrorEvent(title="Imaging Error", msg=error).to_event())
            logger.error(error)
            self.haystack.set_state(SetCommand.NOT_READY)
            return False
        self.max_image_retries = previous_max_image_retries
        return True

    @parlay_command()
    def initialize_haystack(self):
        """
        Run HayTray test and set Haystack to READY if successful
        """
        result = self.haytray_test()
        if result:
            self.haystack.set_drop_area_led(LedCommand.ON)
            self.haystack.set_state(SetCommand.READY)
            return True
        else:
            return False

    @parlay_command()
    def fetch_haystack_calibration(self):
        """
        Fetch the camera calibration from the Haystack
        and write it to the camera calibration file
        """
        logger.info("Fetching Haystack calibration")
        cal = self.haystack.get_camera_calibration()
        mtx = cal.get("camera_matrix")
        dist = cal.get("distortion_coefficients")
        if not mtx or not dist:
            error_msg = (
                "Haystack calibration data was missing. "
                "Default calibration values have been applied and saved to the device. "
                "This warning will only appear once per uncalibrated device."
            )
            logger.warning(
                "Haystack calibration data missing. "
                "Applying default calibration values to Haystack."
            )
            self.send_event(
                **ErrorEvent(
                    title="Camera Calibration Missing",
                    msg=error_msg,
                ).to_event()
            )
            default_mtx_str = ",".join(config.camera.calibration_default_matrix)
            default_dist_str = ",".join(config.camera.calibration_default_distortion)
            if not mtx:
                mtx = config.camera.calibration_default_matrix
                self.haystack.set_cam_mtx(default_mtx_str)
            if not dist:
                dist = config.camera.calibration_default_distortion
                self.haystack.set_cam_dist(default_dist_str)
            # Refetch calibration to get the actual values
            cal = self.haystack.get_camera_calibration()
            mtx = cal.get("camera_matrix")
            dist = cal.get("distortion_coefficients")
        self.camera.write_calibration_to_file(mtx, dist)
        return {"camera_matrix": mtx, "distortion_coefficients": dist}

    @parlay_command()
    def on_deposit_ready(self):
        """
        Triggered when Haystack is ready to receive a new needle
        """
        if self.app_state.stage != Stage.ACTIVE:
            return
        if not self._reference_image_event.wait(timeout=2):
            # TODO: Enable, but this buries the actual in the popup need better FE handling
            # error = "Timed out waiting for reference image to be processed."
            # self.send_event(**ErrorEvent(title="Reference Image Timeout", msg=error).to_event())
            logger.warning("Timed out waiting for reference image processing in on_deposit_ready")
            return
        if not self._reference_image_valid:
            # TODO: Enable, but this buries the actual in the popup need better FE handling
            # error = "Reference image is invalid. Please reinsert the HayTray and try again."
            # self.send_event(**ErrorEvent(title="Invalid Reference Image", msg=error).to_event())
            logger.warning("Skipping deposit ready - reference image decode was not valid")
            return
        self.haystack.set_state(SetCommand.READY)

    @parlay_command()
    def on_moved_to_sharps(self):
        """
        Triggered when Haystack is moved to sharps position
        Should happen after imaging is complete
        """
        # Send haystack to home position
        self.haystack.prepare_next_deposit()
        if self.new_reference_image:
            self._reference_image_event.clear()
            self.take_reference_image_with_retry()
        else:
            self._reference_image_valid = True
            self._reference_image_event.set()
            self._maybe_commit_pending_analyzed()

    def take_reference_image_with_retry(self, check_empty: bool = True) -> Optional[str]:
        """
        Take and set the reference image with retry logic.
        When check_empty=False (haytray_test first call), decode to establish pix_per_mm.
        When check_empty=True, skip decode and use stored pix_per_mm for analysis.
        """
        analyze_result = None
        new_image_path = None

        if not check_empty:
            image_path, decode_result = self.take_image_with_retry(is_reference=True)
            if not image_path or not decode_result.get("is_success", False):
                error = "Reference image decode failed. Please reinsert the HayTray and try again."
                self.send_event(
                    **ErrorEvent(title="Reference Image Capture Failed", msg=error).to_event()
                )
                logger.error(f"Reference image decode failed, result: {decode_result}")
                new_image_path = None
            else:
                new_image_path = image_path
        else:
            image_path = self.camera.take_image()
            if not image_path:
                error = "Camera failed to capture a reference image."
                self.send_event(
                    **ErrorEvent(title="Reference Image Capture Failed", msg=error).to_event()
                )
                logger.error("Reference image unable to be captured")
            elif self.last_pix_per_mm is None:
                error = (
                    "No calibration data available from prior decode. "
                    "Please reinsert the HayTray to recalibrate."
                )
                self.send_event(
                    **ErrorEvent(title="Reference Image Analysis Error", msg=error).to_event()
                )
                logger.error("No pix_per_mm available from prior decode")
            else:
                analyze_result = self.detector.analyze_reference_image(
                    image_path, self.last_pix_per_mm
                )
                if analyze_result.get("is_success", False):
                    new_image_path = image_path
                else:
                    logger.error(f"Reference image analysis failed, result: {analyze_result}")

        if new_image_path:
            self._reference_image_valid = new_image_path is not None
            self._reference_image_event.set()
            self.detector.set_reference_image(new_image_path)
        elif check_empty:
            self._reference_image_valid = False
            self._reference_image_event.set()
        self._maybe_commit_pending_analyzed()
        log_command(
            "take_reference_image_with_retry",
            self.case,
            {"image_path": new_image_path, **(analyze_result if analyze_result else {})},
        )
        return new_image_path

    def take_image_with_retry(
        self, is_reference: bool = False
    ) -> tuple[Optional[str], Optional[dict]]:
        """
        Take an image with retry logic
        :param is_reference: Whether the image is a reference image
        :return: Tuple of image path and decode result
        """
        output_image_path = None
        image_attempt = 0
        decode_result = None
        while not output_image_path and image_attempt <= self.max_image_retries:
            image_attempt += 1
            image_path = self.camera.take_image()
            decode_result = self.decoder.decode_mark(image_path, check_empty=is_reference)
            if decode_result.get("is_success", False):
                output_image_path = image_path
                self.last_pix_per_mm = decode_result.get("pix_per_mm")
            else:
                logger.error(f"Image decode failed, result: {decode_result}")
        if not output_image_path:
            self.send_event(
                **ErrorEvent(
                    title="Image Capture Failed",
                    msg=f"Image unable to be captured after {image_attempt} attempts",
                ).to_event()
            )
            logger.error(
                f"Image unable to be captured after {image_attempt} attempts"
            )  # TODO: Send to adjudication
        log_command(
            "take_image_with_retry",
            self.case,
            {"capture_attempts": image_attempt, **decode_result, "image_path": output_image_path},
        )
        return output_image_path, decode_result

    @parlay_command()
    def on_imaging_ready(self):
        """
        Triggered when Haystack is ready for imaging
        """
        with self._pending_analyzed_lock:
            self._pending_analyzed_result = None
        self._reference_image_event.clear()
        output_image_path, _decode_result = self.take_image_with_retry()
        self.haystack.imaging_complete()
        # Predict the upcoming analyzed_count
        next_image_number = self.detector.analyzed_count + 1
        self.send_event(
            **NeedleImageCapturedEvent(
                image_number=next_image_number,
                received_time=get_local_time_string(),
                image_filename_used=(
                    os.path.basename(output_image_path) if output_image_path else ""
                ),
            ).to_event()
        )

    def _maybe_commit_pending_analyzed(self) -> None:
        """
        Append buffered needle analysis to app state once the post-deposit reference
        image has been processed (or discard if the tray empty check failed).
        """
        with self._pending_analyzed_lock:
            pending = self._pending_analyzed_result
            if pending is None:
                return
            if not self._reference_image_event.is_set():
                return
            reference_ok = self._reference_image_valid
            if reference_ok:
                self.app_state.analyzed_needles.append(pending)
                self.app_state.latest_needle_result = pending
                log_command("on_analyzed_event", self.case, pending)
                self._pending_analyzed_result = None
            else:
                self._pending_analyzed_result = None

        if reference_ok:
            self.update_dashboards()
        else:
            self.send_event(
                **ErrorEvent(
                    title="Deposit Failed",
                    msg="The suture needle was not deposited into the HayTray. Remove the HayTray, "
                    "find the suture needle, and try depositing again.",
                ).to_event()
            )
            logger.warning("Discarded pending analyzed needle result: reference empty check failed")

    def on_analyzed_event(self, event: dict[str, dict[str, Any]]):
        """
        Handle an analyzed event from the detector adapter
        Note: imaging_complete() is now called immediately after imaging,
        so this handler only stores results (needle moves to sharps in parallel)
        """
        if (
            analyzed_event := ImageAnalyzedEvent.from_event(event.get("CONTENTS", {}))
        ) and analyzed_event is not None:
            result = analyzed_event.result
            if result["response_type"] == NeedleResponseType.SINGLE_NEEDLE:
                result["needle_state_machine"] = NeedleStateMachine()
            elif result["response_type"] == NeedleResponseType.NO_OBJECTS:
                self.app_state.latest_needle_result = result
                self.update_dashboards()
                log_command("on_analyzed_event", self.case, result)
                return
            elif result["response_type"] == NeedleResponseType.ERROR:
                error_detail = result.get("error", "Unknown analysis error.")
                self.send_event(
                    **ErrorEvent(
                        title="Image Analysis Error",
                        msg=f"The detector returned an error: {error_detail}",
                    ).to_event()
                )
                logger.error(f"Detector returned error response: {result}")
                result["needle_state_machine"] = NeedleStateMachine(
                    initial_state=NeedleState.ADJUDICATION
                )
            else:
                result["needle_state_machine"] = NeedleStateMachine(
                    initial_state=NeedleState.ADJUDICATION
                )
            self.app_state.haystack_analyzed_count += 1
            result["image_number"] = self.app_state.haystack_analyzed_count
            set_result_state_name(result)
            with self._pending_analyzed_lock:
                self._pending_analyzed_result = result
            self._maybe_commit_pending_analyzed()

    @parlay_command()
    def on_scrub_screen_event(self, scrub_screen: str):
        """
        Triggered when scrub screen is changed
        """
        scrub_screen_enum = find_in_enum(ScrubScreen, scrub_screen)
        if state := ScrubScreenToLedMapping.get(scrub_screen_enum):
            self.haystack.set_cap_btn_indicate(state)
            self.cap_btn_indicate_state = state
        log_command(
            "on_scrub_screen_event", self.case, {"scrub_screen": scrub_screen, "led_state": state}
        )
        return asdict(state) if state else None

    def _get_id_to_result(self):
        """
        Build a mapping from needle id to its result dictionary.
        Used for fast lookup of analyzed needle results by their unique ID.
        """
        id_to_result = {}
        for result in self.app_state.analyzed_needles:
            id = result.get("id")
            if id:
                id_to_result[id] = result
        return id_to_result

    def _serialize_result(self, result):
        """
        Return a copy of the result dictionary without the needle_state_machine object.
        This is necessary for serialization
        """
        result_copy = dict(result)
        if "needle_state_machine" in result_copy:
            del result_copy["needle_state_machine"]
        return result_copy

    def _filter_needles_by_state(self, state: NeedleState):
        """
        Filter analyzed needles by their current state.
        Returns a list of serialized needle results matching the given NeedleState.
        Includes CBI re-adjudication items when filtering for READJUDICATION state.
        """
        results = []
        for n in self.app_state.analyzed_needles:
            # Handle regular needles with state machines
            if n.get("needle_state_machine") and n["needle_state_machine"].get_state() == state:
                results.append(self._serialize_result(n))
            # Handle CBI re-adjudication items (they don't have state machines)
            elif (
                state == NeedleState.READJUDICATION
                and n.get("response_type") == "cbi_re_adjudication"
            ):
                logger.info(f"Found CBI re-adjudication item in filter: {n.get('id')}")
                results.append(self._serialize_result(n))

        if state == NeedleState.READJUDICATION:
            logger.info(f"READJUDICATION filter returned {len(results)} items")
        return results

    def update_dashboards(self):
        """
        Aggregate and send the latest dashboard data to the frontend.
        Also persists state to disk.
        """
        OTHER_SHARPS = ["blade", "k-wire", "hypo"]

        haystack = self.app_state.haystack_needles
        contaminated = self.case.cbi_contaminated_needle_count
        incompatible = self.case.cbi_incompatible_needle_count
        broken = self.case.cbi_broken_needle_count
        misplaced = self.app_state.misplaced_needles
        haystack_reason_counts = self.app_state.haystack_reason_counts
        haystack_broken = haystack_reason_counts.get("broken", 0)
        whole_misplaced = self.app_state.whole_misplaced_needles

        # Calculate other sharps count
        other_sharps_count = sum(haystack_reason_counts.get(sharp, 0) for sharp in OTHER_SHARPS)

        # Calculate confirmed count:
        # - haystack: complete needles
        # - broken pairs: all broken halves (CBI box + haystack + misplaced) counted together
        #   before integer division, so that e.g. 1 in CBI broken + 1 in misplaced = 1 pair
        # - CBI contaminated, incompatible
        # - whole misplaced needles found
        # - subtract other sharps
        confirmed = (
            haystack
            + (broken + haystack_broken + misplaced) // 2  # All broken halves together as pairs
            + contaminated
            + incompatible
            + whole_misplaced
            - other_sharps_count  # Subtract other sharps from confirmed total
        )

        # Send case_sutures directly to frontend
        case_sutures = [suture.to_dict() for suture in self.case.case_sutures]

        # Serialize latest_needle_result to remove needle_state_machine
        latest_needle_serialized = None
        if self.app_state.latest_needle_result:
            latest_needle_serialized = self._serialize_result(self.app_state.latest_needle_result)

        # Calculate surgeon count and first surgeon name
        surgeon_count = len(self.app_state.selected_surgeons_with_case_groups)
        first_surgeon_name = ""
        if surgeon_count == 1:
            surgeon_id = self.app_state.selected_surgeons_with_case_groups[0].get("surgeon_id", "")
            surgeon = next((s for s in self.surgeons if s.surgeon_id == surgeon_id), None)
            if surgeon:
                first_surgeon_name = f"{surgeon.first_name} {surgeon.last_name}".strip()
        elif surgeon_count > 1:
            first_surgeon_name = f"{surgeon_count} surgeons"

        result = {
            "haystack_needles": haystack - other_sharps_count,
            "haystack_reason_counts": haystack_reason_counts,
            "cir_verification": self._filter_needles_by_state(NeedleState.VERIFICATION),
            "cir_adjudication": self._filter_needles_by_state(NeedleState.ADJUDICATION),
            "scr_validation": self._filter_needles_by_state(NeedleState.VALIDATION),
            "cir_readjudication": self._filter_needles_by_state(NeedleState.READJUDICATION),
            "misplaced_needles": misplaced,
            "whole_misplaced_needles": whole_misplaced,
            "found_non_sterile_needles": self.app_state.found_non_sterile_needles,
            "added_needle_count": self.app_state.added_needle_count,
            "interim_added_needle_count": self.app_state.interim_added_needle_count,
            "starting_count": self.app_state.starting_count,
            "pending_cbi_validations": self.app_state.pending_cbi_validations,
            "incompatible_needle_count": incompatible,
            "contaminated_needle_count": contaminated,
            "broken_needle_count": broken,
            "confirmed": confirmed,
            "case_sutures": case_sutures,
            "stage": int(self.app_state.stage),
            "surgeon_id": self.app_state.surgeon_id,
            "cir_id": self.app_state.cir_id,
            "scr_id": self.app_state.scr_id,
            "latest_needle_result": latest_needle_serialized,
            "last_cbi_image": self.app_state.last_cbi_image,
            "last_cbi_images_by_type": self.app_state.last_cbi_images_by_type,
            "surgeon_count": surgeon_count,
            "first_surgeon_name": first_surgeon_name,
        }
        log_command("update_dashboards", self.case, result)

        # Sync staff IDs and save state to disk
        self._sync_staff_to_app_state()
        self.app_state.save()

        self.send_event(
            json.dumps(result), event="DASHBOARD_UPDATE", description="Updated Dashboard"
        )

    def transition_and_set(self, result, event: str):
        """
        Transition the needle's state machine using the given event and update its state string.
        Used to move needles through their lifecycle in
        response to verification/adjudication actions.
        """
        sm = result.get("needle_state_machine")
        if sm:
            sm.transition(event)
            result["needle_state"] = sm.get_state().name

    @parlay_command()
    def cir_verified_needles(
        self,
        complete_needles: list[str],
        not_complete_needles: list[str],
    ):
        """
        Handle CIR verification of needles.
        Transitions needles to 'complete' or 'adjudicate' state based on verification results,
        updates counts, logs the event, and refreshes dashboard data.
        """
        id_to_result = self._get_id_to_result()
        for id in complete_needles:
            result = id_to_result.get(id)
            if result:
                self.transition_and_set(result, "complete")
        for id in not_complete_needles:
            result = id_to_result.get(id)
            if result:
                self.transition_and_set(result, "adjudicate")
        self.app_state.haystack_needles += len(complete_needles)
        log_command(
            "cir_verified_needles",
            self.case,
            {
                "complete_needles": complete_needles,
                "not_complete_needles": not_complete_needles,
                "cir_verification_count": len(
                    self._filter_needles_by_state(NeedleState.VERIFICATION)
                ),
                "cir_adjudication_count": len(
                    self._filter_needles_by_state(NeedleState.ADJUDICATION)
                ),
                "haystack_needles": self.app_state.haystack_needles,
            },
        )
        self.update_dashboards()
        return True

    @parlay_command()
    def reset_closing_count_verification(self):
        """
        Undo all verification and adjudication decisions made during closing count.
        Resets every analyzed needle that is in COMPLETED, ADJUDICATION, or VALIDATION
        state back to VERIFICATION, decrements haystack_needles for each needle that
        was marked complete, and clears adjudication metadata.
        Called when CIR presses back from adjudication/CBI screens to re-verify.
        """
        reverted_complete = 0
        for result in self.app_state.analyzed_needles:
            sm = result.get("needle_state_machine")
            if not sm:
                continue
            current = sm.get_state()
            if current in (
                NeedleState.COMPLETED,
                NeedleState.ADJUDICATION,
                NeedleState.VALIDATION,
            ):
                if current == NeedleState.COMPLETED:
                    reverted_complete += 1
                sm.state = NeedleState.VERIFICATION
                result["needle_state"] = NeedleState.VERIFICATION.name
                result.pop("adjudication_reason", None)
                result.pop("hasOtherPiece", None)
                result.pop("other_custom_input", None)
        self.app_state.haystack_needles = max(
            0, self.app_state.haystack_needles - reverted_complete
        )
        self.app_state.save()
        self.update_dashboards()
        log_command(
            "reset_closing_count_verification",
            self.case,
            {
                "reverted_complete": reverted_complete,
                "haystack_needles": self.app_state.haystack_needles,
            },
        )
        return True

    @parlay_command()
    def reset_cbi_confirmations(self):
        """
        Undo all CIR-stage CBI confirmation and denial actions.
        - Strips cir_confirmed from any approved items in pending_cbi_validations
        - Moves denied items (cbi_re_adjudication in analyzed_needles) back to
          pending_cbi_validations by reversing the _build_cbi_readjudication_item transform
        Called when CIR presses back from CBI screens to re-confirm.
        """
        # 1. Clear cir_confirmed on approved items still in pending
        for cbi_item in self.app_state.pending_cbi_validations:
            cbi_item.pop("cir_confirmed", None)

        # 2. Move denied items back from analyzed_needles to pending
        restored = []
        remaining_analyzed = []
        for entry in self.app_state.analyzed_needles:
            if entry.get("response_type") == "cbi_re_adjudication":
                cbi = entry.get("cbi_data", {})
                restored.append(
                    {
                        "id": entry["id"],
                        "image_filename": entry.get("image_filename"),
                        "image_number": entry.get("image_number"),
                        "received_time": entry.get("received_time"),
                        "type": cbi.get("type"),
                        "count": cbi.get("count", 0),
                        "markers": cbi.get("markers", []),
                        "imageNaturalWidth": cbi.get("imageNaturalWidth", 900),
                        "imageNaturalHeight": cbi.get("imageNaturalHeight", 875),
                        "misplaced": cbi.get("misplaced", False),
                        "cir_confirmed": False,
                    }
                )
            else:
                remaining_analyzed.append(entry)
        self.app_state.analyzed_needles = remaining_analyzed
        self.app_state.pending_cbi_validations.extend(restored)

        self.app_state.save()
        self.update_dashboards()
        log_command(
            "reset_cbi_confirmations",
            self.case,
            {
                "cleared_confirmed": len(self.app_state.pending_cbi_validations),
                "restored_denied": len(restored),
            },
        )
        return True

    @parlay_command()
    def cir_adjudicated_needles(self, adjudicated_needles: list, source: str):
        """
        Handle CIR adjudication of needles.
        Sets adjudication reason, stores hasOtherPiece for broken needles,
        transitions needles to 'validate' state, logs the event, and updates dashboard data.
        """
        id_to_result = self._get_id_to_result()
        for entry in adjudicated_needles:
            id = entry.get("id")
            reason = entry.get("reason")
            has_other_piece = entry.get("hasOtherPiece", None)
            other_custom_input = entry.get("other_custom_input", None)
            needle_count = entry.get("needle_count", None)
            result = id_to_result.get(id)
            if result:
                result["adjudication_reason"] = reason
                if reason == AdjudicationReason.Broken and has_other_piece is not None:
                    result["hasOtherPiece"] = has_other_piece
                if reason == AdjudicationReason.Other and other_custom_input is not None:
                    result["other_custom_input"] = other_custom_input
                if reason == AdjudicationReason.Multiple and needle_count is not None:
                    result["adjudicated_needle_count"] = needle_count
                self.transition_and_set(result, "validate")
        log_command(
            "cir_adjudicated_needles",
            self.case,
            {
                "source": source,
                "adjudicated_needles": adjudicated_needles,
                "scr_validation_count": len(self._filter_needles_by_state(NeedleState.VALIDATION)),
                "cir_adjudication_count": len(
                    self._filter_needles_by_state(NeedleState.ADJUDICATION)
                ),
                "cir_readjudication_count": len(
                    self._filter_needles_by_state(NeedleState.READJUDICATION)
                ),
            },
        )
        self.update_dashboards()
        return True

    def _increment_haystack_reason(self, reason, count=1):
        """
        Increment the count for a specific adjudication reason and update total haystack needles.
        """
        if reason not in self.app_state.haystack_reason_counts:
            self.app_state.haystack_reason_counts[reason] = 0
        self.app_state.haystack_reason_counts[reason] += count
        self.app_state.haystack_needles += count

    @parlay_command()
    def scr_validated_needles(self, validated_needles: list):
        """
        Handle SCR validation of needles based on CIR Adjudication.
        Transitions needles based on validation and adjudication reason,
        updates misplaced needles and reason counts, logs the event, and refreshes dashboard data.
        """
        id_to_result = self._get_id_to_result()
        for needle in validated_needles:
            id = needle.get("id")
            reason = (needle.get("reason") or "").lower()
            validation = needle.get("validation")
            result = id_to_result.get(id)
            if (
                reason == ""
                or reason == AdjudicationReason.Blade
                or reason == AdjudicationReason.KWire
                or reason == AdjudicationReason.Hypo
            ):
                if validation == "yes":
                    self.transition_and_set(result, "complete")
                    self._increment_haystack_reason(reason, 1)
                else:
                    self.transition_and_set(result, "readjudicate")
            elif reason == AdjudicationReason.Broken:
                if validation == "yes":
                    self.transition_and_set(result, "complete")
                    # Track broken in reason counts (frontend will display this with half icon)
                    if reason not in self.app_state.haystack_reason_counts:
                        self.app_state.haystack_reason_counts[reason] = 0
                    self.app_state.haystack_reason_counts[reason] += 1
                    # Recompute broken ghost halves from source counters.
                    # Each broken needle contributes 1 half to haystack and 1 to CBI (or missing).
                    # misplaced = haystack_broken - cbi_broken when cbi <= haystack (one ghost per
                    # unmatched haystack half); or (cbi - haystack) % 2 when cbi > haystack (excess
                    # CBI halves form pairs among themselves; odd excess needs 1 ghost).
                    haystack_broken = self.app_state.haystack_reason_counts.get("broken", 0)
                    cbi_broken = self.case.cbi_broken_needle_count
                    if cbi_broken <= haystack_broken:
                        self.app_state.misplaced_needles = haystack_broken - cbi_broken
                    else:
                        self.app_state.misplaced_needles = (cbi_broken - haystack_broken) % 2
                else:
                    self.transition_and_set(result, "readjudicate")
            elif reason == AdjudicationReason.Multiple:
                if validation == "yes":
                    self.transition_and_set(result, "complete")
                    count = (
                        result.get("adjudicated_needle_count", 2) if result else 2
                    )  # Not sure what to default here, 0 maybe?
                    self._increment_haystack_reason(reason, count)
                else:
                    self.transition_and_set(result, "readjudicate")
            elif reason == AdjudicationReason.Other:
                if validation == "no":
                    self.transition_and_set(result, "readjudicate")
                else:
                    self.transition_and_set(result, "complete")

        log_command(
            "scr_validated_needles",
            self.case,
            {
                "validated_needles": validated_needles,
                "scr_validation_remaining": len(
                    self._filter_needles_by_state(NeedleState.VALIDATION)
                ),
                "cir_readjudication_count": len(
                    self._filter_needles_by_state(NeedleState.READJUDICATION)
                ),
                "haystack_reason_counts": self.app_state.haystack_reason_counts,
                "misplaced_needles": self.app_state.misplaced_needles,
            },
        )
        self.update_dashboards()
        return True

    @parlay_command()
    def scr_confirm_suture_pack(self, suture_pack_info: dict):
        """
        Store pending pack info and emit event to SCR for confirmation.
        The needle will be added when SCR confirms via scr_confirmed_answer.
        """
        # Store the pending pack info in app state
        self.app_state.pending_needle_confirmation = suture_pack_info
        self.app_state.save()

        self.send_event(json.dumps(suture_pack_info), "SCR_CONFIRM_SUTURE_PACK", None)
        log_command("scr_confirm_suture_pack", self.case, suture_pack_info)
        return True

    @parlay_command()
    def scr_confirmed_answer(self, suture_pack_info: dict, confirmed: bool):
        """
        Handle SCR's response to added needle confirmation.
        If confirmed, add the needle and send confirmation event.
        If denied, just send denial event.
        """
        if confirmed:
            # Add the needle NOW (backend-controlled)
            fda_guid = suture_pack_info.get("fda_guid")
            num_needles = suture_pack_info.get("num_needles", 1)

            # Add to case sutures
            self._add_scanned_pack_to_case(fda_guid, suture_pack_info)

            # Increment added needle count
            self.app_state.added_needle_count += num_needles

            # Clear pending confirmation
            self.app_state.pending_needle_confirmation = None
            self.app_state.save()

            # Update dashboards BEFORE sending confirmation event
            # This ensures CIR sees the updated count when it receives confirmation
            self.update_dashboards()

            # Now send confirmation event to CIR
            self.send_event("confirmed", "SCR_CONFIRMED_ADDED", None)
            self.data_store.confirmed_added(self.case, suture_pack_info)
            log_command(
                "confirmed_added",
                self.case,
                {
                    "suture_pack_info": suture_pack_info,
                    "added_needle_count": self.app_state.added_needle_count,
                },
            )
        else:
            # Clear pending confirmation
            self.app_state.pending_needle_confirmation = None
            self.app_state.save()

            # Send denial event to CIR
            self.send_event("denied", "SCR_CONFIRMED_ADDED", None)
            log_command(
                "denied_added",
                self.case,
                {
                    "suture_pack_info": suture_pack_info,
                    "added_needle_count": self.app_state.added_needle_count,
                },
            )
        return True

    @parlay_command()
    def set_current_confirming_pack(self, case_suture: dict):
        """
        Set the current pack being confirmed by CIR.
        This is used to update the SCR CountTypes screen with the pack info.
        """
        self.app_state.current_confirming_pack = case_suture
        self.app_state.save()

        # Send event to update SCR screen
        self.send_event(json.dumps(case_suture), "CURRENT_CONFIRMING_PACK_UPDATED", None)
        return True

    @parlay_command()
    def cir_count_mismatch(self, case_suture: dict):
        """
        CIR reported count mismatch. Navigate SCR to mismatch screen.
        """
        log_command("cir_count_mismatch", self.case, case_suture)

        # Update current confirming pack and notify SCR
        self.set_current_confirming_pack(case_suture)

        # Navigate SCR to mismatch screen
        self.set_current_scr_screen(SCRScreen.SetupMismatch)
        return True

    @parlay_command()
    def cir_confirmed_field_count(
        self, case_suture: dict, field_count: int, current_index: int = 0
    ):
        """
        CIR confirmed the field count. Store it and notify SCR to show confirmation screen.
        Also store the current_index so we know which pack the CIR is on.
        """
        log_command(
            "cir_confirmed_field_count",
            self.case,
            {
                "case_suture": case_suture,
                "field_count": field_count,
                "current_index": current_index,
            },
        )

        # Update current confirming pack and notify SCR
        self.set_current_confirming_pack(case_suture)

        # Store field count and current index
        self.app_state.field_count = field_count
        self.app_state.current_confirming_index = current_index
        self.app_state.save()

        # Navigate SCR to mismatch confirm screen
        self.set_current_scr_screen(SCRScreen.SetupMismatchConfirm)
        return True

    @parlay_command()
    def scr_confirmed_field_count(self, confirmed: bool):
        """
        SCR confirmed (or rejected) the field count.
        Navigate both CIR and SCR based on whether there are more packs & whether it was confirmed.
        Uses the current_confirming_index from app_state to know which pack in CIR's array we're on.
        """
        log_command("scr_confirmed_field_count", self.case, {"confirmed": confirmed})

        # Get current confirming pack and index from CIR's perspective
        current_pack = self.app_state.current_confirming_pack
        if not current_pack:
            logger.error("No current confirming pack found")
            return False

        current_index = getattr(self.app_state, "current_confirming_index", 0)

        # Determine next action based on confirmed status
        if confirmed:
            # SCR confirmed - move to next pack or total
            next_index = current_index + 1
            if next_index < len(self.case.case_sutures):
                # More packs to count - set next pack and navigate to count screens
                next_pack = self.case.case_sutures[next_index]
                self.set_current_confirming_pack(next_pack.to_dict())

                # Navigate CIR to next pack in confirm count
                self.send_event(**ScrConfirmedFieldCountEvent(action="next").to_event())

                # Navigate SCR to count types for the new pack
                self.set_current_scr_screen(SCRScreen.SetupCountTypes)
            else:
                # No more packs - navigate both to total screens
                self.send_event(**ScrConfirmedFieldCountEvent(action="complete").to_event())
                self.set_current_cir_screen(CIRScreen.SetupTotal)
                self.set_current_scr_screen(SCRScreen.SetupTotal)
        else:
            # SCR did not confirm - stay on same pack and navigate back to count screens
            # CIR goes back to confirm count on the same (mismatched) pack
            self.send_event(**ScrConfirmedFieldCountEvent(action="retry").to_event())

            # SCR goes to count types for the same pack
            self.set_current_scr_screen(SCRScreen.SetupCountTypes)

        return True

    @parlay_command()
    def get_field_count(self):
        """
        Get the field count that was confirmed by CIR.
        """
        return self.app_state.field_count

    @parlay_command()
    def get_added_needles(self):
        result = self.data_store.get_added_needles(self.case)
        log_command("get_added_needles", self.case, result)
        return result

    @parlay_command()
    def set_starting_count(self, starting_count: int):
        """Set the starting count (used by skip button for demo/testing)."""
        log_command("set_starting_count", self.case, starting_count)
        self.app_state.starting_count = starting_count
        # Also set confirmed_total to match so complete_setup doesn't override it
        self.app_state.confirmed_total = starting_count
        self.update_dashboards()
        return True

    @parlay_command()
    def set_haystack_count(self, haystack_count: int):
        log_command("set_haystack_count", self.case, haystack_count)
        self.app_state.haystack_needles = haystack_count
        self.update_dashboards()
        return True

    @parlay_command()
    def clear_latest_needle_result(self):
        """Clear the latest needle result (used to reset NO_OBJECTS state)"""
        log_command("clear_latest_needle_result", self.case)
        self.app_state.latest_needle_result = None
        self.update_dashboards()
        return True

    @parlay_command()
    def clear_cbi_image(self):
        """Clear the last CBI image (called when user exits the CBI flow without completing)"""
        log_command("clear_cbi_image", self.case)
        self.app_state.last_cbi_image = None
        self.app_state.save()
        self.update_dashboards()
        return True

    @parlay_command()
    def cbi_needles_counted(
        self,
        type: str,
        count: int,
        image: str,
        image_number: int = 0,
        image_time: str = "",
        misplaced: bool = False,
        markers: list = None,
        image_natural_width: int = 0,
        image_natural_height: int = 0,
        cir_confirmed: bool = False,
        extra: bool = False,
        from_found_non_sterile: bool = False,
    ):
        if markers is None:
            markers = []

        filename = image

        if filename:
            validation_item = {
                "id": f"cbi_{get_utc_iso_timestamp()}_{type}",
                "image_filename": filename,
                "type": type,
                "count": count,
                "source": "cbi",
                "received_time": image_time,
                "image_number": image_number,
                "misplaced": misplaced,
                "extra": extra,
                "from_found_non_sterile": from_found_non_sterile,
                "markers": markers,
                "imageNaturalWidth": image_natural_width,
                "imageNaturalHeight": image_natural_height,
                "cir_confirmed": cir_confirmed,
            }
            self.app_state.pending_cbi_validations.append(validation_item)
            # Track the last confirmed image per type for the Remove From CBI compare screen
            self.app_state.last_cbi_images_by_type[type] = {
                "image_filename": filename,
                "markers": markers,
                "imageNaturalWidth": image_natural_width,
                "imageNaturalHeight": image_natural_height,
                "image_number": image_number,
                "received_time": image_time,
            }
            if not from_found_non_sterile:
                if misplaced:
                    self.app_state.cbi_confirmed_counts[validation_item["id"]] = 0
                    # Decrement the misplaced notification by 1 (CIR processed one item)
                    current_misplaced = self.app_state.cbi_notification_counts.misplaced
                    self.app_state.cbi_notification_counts.misplaced = max(0, current_misplaced - 1)
                    self.send_cbi_notifications_event()
                # Decrement the notification count by 1 when CIR processes one item
                elif type in ["contaminated", "incompatible", "broken"]:
                    current_count = getattr(self.app_state.cbi_notification_counts, type, 0)
                    setattr(self.app_state.cbi_notification_counts, type, max(0, current_count - 1))
                    self.send_cbi_notifications_event()
            # Clear the stored CBI image so the next flow starts fresh
            self.app_state.last_cbi_image = None
            self.app_state.save()
            self.update_dashboards()

        self.data_store.cbi_needles_counted(self.case, type, count, image)
        log_command(
            "cbi_needles_counted",
            self.case,
            {
                "type": type,
                "count": count,
                "image_filename": filename,
                "misplaced": misplaced,
                "extra": extra,
                "markers": markers,
            },
        )
        return True

    def _apply_confirmed_cbi_counts(self, confirmed_item):
        """Finalize counter adjustments for a single SCR-confirmed CBI item."""
        needle_type = confirmed_item.get("type")
        count = confirmed_item.get("count", 0)
        is_misplaced = confirmed_item.get("misplaced", False)

        if is_misplaced and needle_type == "broken":
            # Misplaced flow: CIR found a broken fragment.
            # This resolves a previous broken needle's missing half,
            # so decrement misplaced_needles (the half icon).
            # Do NOT touch whole_misplaced — this wasn't a whole needle.
            if self.app_state.misplaced_needles > 0:
                self.app_state.misplaced_needles -= 1
        elif is_misplaced:
            # Misplaced flow: CIR found a whole needle (contaminated/incompatible/etc).
            # Decrement whole_misplaced only. Do NOT touch misplaced_needles.
            if self.app_state.whole_misplaced_needles > 0:
                self.app_state.whole_misplaced_needles -= 1

        # Handle extra needle items (Section 10 → Section 6 CBI flow)
        is_extra = confirmed_item.get("extra", False)
        if is_extra:
            if self.app_state.added_needle_count > 0:
                self.app_state.added_needle_count -= 1

        if needle_type:
            self.data_store.add_confirmed_cbi_needles(self.case, needle_type, count)

    @parlay_command()
    def cbi_removed_confirmed(
        self,
        type: str,
        new_image: str,
        new_image_number: int = 0,
        new_image_time: str = "",
        new_markers: list = None,
        new_image_natural_width: int = 0,
        new_image_natural_height: int = 0,
        previous_image: str = "",
        previous_image_number: int = 0,
        previous_image_time: str = "",
        previous_markers: list = None,
        previous_image_natural_width: int = 0,
        previous_image_natural_height: int = 0,
        what_is_it: str = "",
        other_input: str = "",
    ):
        """CIR has confirmed removal of an item from the CBI box. Creates a pending
        validation entry for SCR to witness, carrying both the new and previous images."""
        if new_markers is None:
            new_markers = []
        if previous_markers is None:
            previous_markers = []

        validation_item = {
            "id": f"cbi_removed_{get_utc_iso_timestamp()}_{type}",
            "image_filename": new_image,
            "type": type,
            "count": len(new_markers),
            "source": "cbi_removed",
            "received_time": new_image_time,
            "image_number": new_image_number,
            "markers": new_markers,
            "imageNaturalWidth": new_image_natural_width,
            "imageNaturalHeight": new_image_natural_height,
            "previous_image_filename": previous_image,
            "previous_image_number": previous_image_number,
            "previous_received_time": previous_image_time,
            "previous_markers": previous_markers,
            "previousImageNaturalWidth": previous_image_natural_width,
            "previousImageNaturalHeight": previous_image_natural_height,
            "what_is_it": what_is_it,
            "other_input": other_input,
            "cir_confirmed": True,
            "misplaced": False,
        }
        self.app_state.pending_cbi_validations.append(validation_item)
        # Clear the stored CBI image so the next normal CBI flow starts fresh
        self.app_state.last_cbi_image = None

        self.app_state.save()
        self.update_dashboards()
        log_command(
            "cbi_removed_confirmed",
            self.case,
            {"type": type, "new_image": new_image, "previous_image": previous_image},
        )
        return True

    @parlay_command()
    def cbi_removed_dismissed(self, id: str):
        """Remove a cbi_removed validation item from pending without affecting counts."""
        self.app_state.pending_cbi_validations = [
            item for item in self.app_state.pending_cbi_validations if item["id"] != id
        ]
        self.app_state.save()
        self.update_dashboards()
        log_command("cbi_removed_dismissed", self.case, {"id": id})
        return True

    def _update_misplaced_counts(self, confirmed_item):
        needle_type = confirmed_item.get("type")
        is_misplaced = confirmed_item.get("misplaced", False)
        if is_misplaced and needle_type != "broken":
            # Whole misplaced needle resolved (contaminated/incompatible/etc found and placed back).
            if self.app_state.whole_misplaced_needles > 0:
                self.app_state.whole_misplaced_needles -= 1
        elif needle_type == "broken":
            # Recompute broken ghost halves from source counters.
            # count is the new cbi_broken total (add_confirmed_cbi_needles SETs it afterwards).
            # Formula: each broken needle has 1 half in haystack and 1 in CBI or missing.
            #   cbi <= haystack: (haystack - cbi) halves have no CBI partner yet → that many ghosts.
            #   cbi >  haystack: excess CBI halves pair among themselves; odd excess needs 1 ghost.
            count = confirmed_item.get("count", 0)
            haystack_broken = self.app_state.haystack_reason_counts.get("broken", 0)
            if count <= haystack_broken:
                self.app_state.misplaced_needles = haystack_broken - count
            else:
                self.app_state.misplaced_needles = (count - haystack_broken) % 2

    def _apply_extra_needle_adjustment(self, confirmed_item):
        """Decrement added_needle_count when an extra needle CBI item is confirmed."""
        if confirmed_item.get("extra", False):
            if self.app_state.added_needle_count > 0:
                self.app_state.added_needle_count -= 1

    def _handle_scr_confirmed(self, confirmed_items):
        for confirmed_item in confirmed_items:
            needle_type = confirmed_item.get("type")
            count = confirmed_item.get("count", 0)
            self._update_misplaced_counts(confirmed_item)
            self._apply_extra_needle_adjustment(confirmed_item)
            if needle_type:
                self.data_store.add_confirmed_cbi_needles(self.case, needle_type, count)
                self.app_state.last_cbi_images_by_type[needle_type] = {
                    "image_filename": confirmed_item.get("image_filename"),
                    "markers": confirmed_item.get("markers", []),
                    "imageNaturalWidth": confirmed_item.get("imageNaturalWidth", 900),
                    "imageNaturalHeight": confirmed_item.get("imageNaturalHeight", 875),
                    "image_number": confirmed_item.get("image_number"),
                    "received_time": confirmed_item.get("received_time"),
                }

    def _build_cbi_readjudication_item(self, cbi_item, cbi_data=None):
        if cbi_data is None:
            cbi_data = {
                "type": cbi_item.get("type"),
                "count": cbi_item.get("count", 0),
                "markers": cbi_item.get("markers", []),
                "imageNaturalWidth": cbi_item.get("imageNaturalWidth", 900),
                "imageNaturalHeight": cbi_item.get("imageNaturalHeight", 875),
                "misplaced": cbi_item.get("misplaced", False),
            }
        return {
            "id": cbi_item["id"],
            "image_filename": cbi_item["image_filename"],
            "image_number": cbi_item.get("image_number"),
            "received_time": cbi_item.get("received_time"),
            "response_type": "cbi_re_adjudication",
            "adjudication_reason": cbi_item.get("type"),
            "cbi_data": cbi_data,
        }

    def _build_scr_denied_cbi_data(self, cbi_item):
        cbi_data = {
            "type": cbi_item.get("type"),
            "count": cbi_item.get("count", 0),
            "markers": cbi_item.get("markers", []),
            "imageNaturalWidth": cbi_item.get("imageNaturalWidth", 900),
            "imageNaturalHeight": cbi_item.get("imageNaturalHeight", 875),
            "misplaced": cbi_item.get("misplaced", False),
        }
        if cbi_item.get("source") == "cbi_removed":
            cbi_data["was_cbi_removed"] = True
            cbi_data["previous_image_filename"] = cbi_item.get("previous_image_filename", "")
            cbi_data["previous_image_number"] = cbi_item.get("previous_image_number")
            cbi_data["previous_received_time"] = cbi_item.get("previous_received_time", "")
            cbi_data["previous_markers"] = cbi_item.get("previous_markers", [])
            cbi_data["previousImageNaturalWidth"] = cbi_item.get("previousImageNaturalWidth", 900)
            cbi_data["previousImageNaturalHeight"] = cbi_item.get("previousImageNaturalHeight", 875)
        return cbi_data

    def _handle_scr_denied(self, confirmed_items):
        for cbi_item in confirmed_items:
            cbi_data = self._build_scr_denied_cbi_data(cbi_item)
            adjudication_item = self._build_cbi_readjudication_item(cbi_item, cbi_data)
            self.app_state.analyzed_needles.append(adjudication_item)

    def _handle_cir_denied(self, confirmed_items, ids):
        self.app_state.pending_cbi_validations = [
            v for v in self.app_state.pending_cbi_validations if v["id"] not in ids
        ]
        for cbi_item in confirmed_items:
            adjudication_item = self._build_cbi_readjudication_item(cbi_item)
            self.app_state.analyzed_needles.append(adjudication_item)

    @parlay_command()
    def cbi_needles_confirmed(self, ids: list, confirmed: bool):
        confirmed_items = [
            item for item in self.app_state.pending_cbi_validations if item["id"] in ids
        ]

        # Dual confirmation: items with cir_confirmed or from re-adjudication
        # are being validated by SCR (second confirmation). All others are CIR
        # confirming for the first time.
        is_scr_validation = confirmed_items and all(
            item.get("cir_confirmed") or item.get("source") == "cbi_re_adjudication"
            for item in confirmed_items
        )

        if is_scr_validation:
            self.app_state.pending_cbi_validations = [
                item for item in self.app_state.pending_cbi_validations if item["id"] not in ids
            ]
            if confirmed:
                self._handle_scr_confirmed(confirmed_items)
            else:
                self._handle_scr_denied(confirmed_items)
        else:
            if confirmed:
                for confirmed_item in confirmed_items:
                    confirmed_item["cir_confirmed"] = True
            else:
                self._handle_cir_denied(confirmed_items, ids)

        self.update_dashboards()
        log_command(
            "cbi_needles_confirmed",
            self.case,
            {"ids": ids, "confirmed": confirmed},
        )
        return True

    @parlay_command()
    def cbi_needles_re_adjudicated(
        self,
        needle_id: str,
        needle_type: str,
        count: int,
        image_filename: str,
        image_number: int,
        received_time: str,
        misplaced: bool,
        markers: list,
        imageNaturalWidth: int,
        imageNaturalHeight: int,
        extra: bool = False,
    ):
        """
        Handle CBI needles that have been re-adjudicated by CIR.
        Remove from analyzed_needles and add back to pending_cbi_validations for SCR validation.
        """
        # Find the original item before removing it (needed to restore cbi_removed state)
        original_item = next(
            (n for n in self.app_state.analyzed_needles if n.get("id") == needle_id), None
        )
        original_cbi_data = original_item.get("cbi_data", {}) if original_item else {}
        was_cbi_removed = original_cbi_data.get("was_cbi_removed", False)

        # Remove from analyzed_needles
        self.app_state.analyzed_needles = [
            n for n in self.app_state.analyzed_needles if n.get("id") != needle_id
        ]

        # Add back to pending_cbi_validations with updated data
        pending_item = {
            "id": needle_id,
            "image_filename": image_filename,
            "type": needle_type,
            "count": count,
            "source": "cbi_removed" if was_cbi_removed else "cbi_re_adjudication",
            "received_time": received_time,
            "image_number": image_number,
            "misplaced": misplaced,
            "extra": extra,
            "markers": markers,
            "imageNaturalWidth": imageNaturalWidth,
            "imageNaturalHeight": imageNaturalHeight,
            "cir_confirmed": True,
        }
        # Restore previous image data when this was originally a cbi_removed item
        if was_cbi_removed:
            pending_item["previous_image_filename"] = original_cbi_data.get(
                "previous_image_filename", ""
            )
            pending_item["previous_image_number"] = original_cbi_data.get("previous_image_number")
            pending_item["previous_received_time"] = original_cbi_data.get(
                "previous_received_time", ""
            )
            pending_item["previous_markers"] = original_cbi_data.get("previous_markers", [])
            pending_item["previousImageNaturalWidth"] = original_cbi_data.get(
                "previousImageNaturalWidth", 900
            )
            pending_item["previousImageNaturalHeight"] = original_cbi_data.get(
                "previousImageNaturalHeight", 875
            )
        self.app_state.pending_cbi_validations.append(pending_item)

        self.update_dashboards()
        log_command(
            "cbi_needles_re_adjudicated",
            self.case,
            {"id": needle_id, "type": needle_type, "count": count},
        )
        return True

    def _enrich_pack_info_with_sheet_data(self, pack_info: dict) -> dict:
        """
        Enrich pack info with suture_needle_use and suture_needle_category
        from selected suture sheets.
        Returns a copy of pack_info with added fields.
        """
        enriched_info = dict(pack_info)

        # Initialize fields to empty defaults
        enriched_info["suture_needle_use"] = []
        enriched_info["suture_needle_category"] = ""

        # Get selected suture sheet IDs
        sheet_ids = getattr(self.case, "selected_suture_sheet_ids", [])
        pack_fda_guid = pack_info.get("fda_guid")

        if not sheet_ids:
            return enriched_info

        # Look through selected sheets for matching fda_gudid
        for sheet_id in sheet_ids:
            sheet = self.data_store.get_suture_sheet(sheet_id)
            if not sheet:
                continue

            # Check suture_sheet_items for matching fda_gudid
            items = sheet.get("suture_sheet_items", [])

            for sheet_item in items:
                item_fda_gudid = sheet_item.get("fda_gudid")

                # Match by fda_gudid
                if item_fda_gudid == pack_fda_guid:
                    suture_use = sheet_item.get("suture_needle_use", "")
                    suture_cat = sheet_item.get("suture_needle_category", "")

                    enriched_info["suture_needle_use"] = suture_use
                    enriched_info["suture_needle_category"] = suture_cat
                    return enriched_info

        return enriched_info

    def _handle_scan_result_event(self, event_data: dict):
        """Handle scan_result events from the scanner."""
        code_type = event_data.get("code_type")
        code_data = event_data.get("code_data")
        if not (code_type and code_type.upper() == "DATAMATRIX" and code_data):
            # Forward non-DataMatrix scan results (e.g. iTrace) to the frontend
            if code_type and code_type.upper() == "ITRACE" and code_data:
                self.send_event(
                    json.dumps({"code_type": code_type, "code_data": code_data}),
                    event="ITRACE_SCAN_RESULT",
                    description="iTrace scan result",
                )
            return

        # Extract GTIN (AI 01) from GS1 DataMatrix code
        match = re.search(r"01(\d{14})", code_data)
        gtin = int(match.group(1)) if match else None

        if not gtin:
            return

        suture_pack_info = self.data_store.get_suture_pack_info(gtin)
        if not suture_pack_info:
            return

        # Enrich pack info with suture_needle_use from selected sheets
        enriched_pack_info = self._enrich_pack_info_with_sheet_data(suture_pack_info)

        # Add to case sutures (for tracking all scanned packs)
        self._add_scanned_pack_to_case(gtin, enriched_pack_info)

        # Emit event for frontend with enriched data
        self.send_event(
            json.dumps(enriched_pack_info),
            event="SUTURE_PACK_SCANNED",
            description="Suture pack scanned",
        )

        log_command(
            "scanner_datamatrix_code",
            self.case,
            {"code_data": code_data, "gtin": gtin},
        )

    def _handle_camera_result_event(self, event_data: dict):
        """Handle camera_result events from the scanner."""
        screen_type = event_data.get("screen_type")
        image = event_data.get("image_base64")
        if not (screen_type and screen_type.upper() == "CAMERA" and image):
            return

        filename = None
        try:
            # Remove data URL prefix if present
            if image.startswith("data:image/"):
                image = image.split(",", 1)[1]
            img_bytes = base64.b64decode(image)
            filename = f"scanner_camera_{int(time.time() * 1000)}.png"
            output_dir = HAYSCAN_IMAGE_PATH
            file_path = os.path.join(output_dir, filename)
            with open(file_path, "wb") as f:
                f.write(img_bytes)
        except Exception as e:
            logger.error(f"Error saving scanner camera image: {e}")
            filename = None

        result = {
            "received_time": get_local_time_string(),
            "image_number": self.app_state.hayscan_count + 1,
            "image_filename": filename if filename else "",
        }
        self.app_state.hayscan_count += 1
        self.app_state.last_cbi_image = result
        self.app_state.save()
        self.send_event(
            json.dumps(result),
            "SCANNER_CAMERA_RESULT",
            "Scanner Camera Result Image",
        )
        log_command("scanner_camera_result", self.case, {"image_name": filename})

    def on_scanner_event(self, msg):
        """
        Triggered when HayScanner sends any event.
        Delegates to specific handlers based on event type.
        """
        event_name = msg.get("CONTENTS", {}).get("EVENT")
        event_data = msg.get("CONTENTS", {}).get("INFO", {})

        if isinstance(event_data, str):
            try:
                event_data = json.loads(event_data)
            except json.JSONDecodeError:
                event_data = {}

        if event_name == "scan_result":
            self._handle_scan_result_event(event_data)
        elif event_name == "camera_result":
            self._handle_camera_result_event(event_data)

        if event_name == "nfc_uid_result":
            uid = event_data.get("uid", "")
            if uid:
                try:
                    # Look up user first to determine role
                    user = next((u for u in self.hayapp_users if u.badge == uid), None)

                    if user:
                        if not self.app_state.expected_login_role:
                            login_result = {
                                "success": False,
                                "uid": uid,
                                "error": "Badge authentication requires explicit role selection",
                            }
                            self.send_event(
                                json.dumps(login_result), "NFC_UID_SCANNED", "NFC UID Scanned"
                            )
                            return

                        logged_in_role = self.app_state.expected_login_role
                        login_success = self.verify_login(badge=uid, role=logged_in_role)

                        if login_success:
                            # Clear expected role only on successful login
                            self.app_state.expected_login_role = ""
                            self.app_state.save()

                            # Get user info for response
                            user_dict = self.data_store.get_user_by_badge(uid)
                            if user_dict:
                                login_result = {
                                    "success": True,
                                    "user": {
                                        "user_id": user_dict.get("user_id"),
                                        "first_name": user_dict.get("first_name"),
                                        "last_name": user_dict.get("last_name"),
                                        "roles": user_dict.get("roles", []),
                                    },
                                    "logged_in_role": logged_in_role,
                                    "uid": uid,
                                }
                            else:
                                login_result = {
                                    "success": False,
                                    "uid": uid,
                                    "error": "User data not found",
                                }
                        else:
                            login_result = {
                                "success": False,
                                "uid": uid,
                                "error": "Incorrect badge for selected role",
                            }
                    else:
                        login_result = {"success": False, "uid": uid, "error": "Badge not found"}

                    self.send_event(json.dumps(login_result), "NFC_UID_SCANNED", "NFC UID Scanned")
                except Exception as e:
                    logger.error(f"Error processing NFC UID scan: {e}")
                    login_result = {
                        "success": False,
                        "uid": uid,
                        "error": "Internal error processing badge",
                    }
                    self.send_event(json.dumps(login_result), "NFC_UID_SCANNED", "NFC UID Scanned")

    @parlay_command()
    def mock_datamatrix_scan_event(self, fdagudid=10705031018662):
        """
        Mocks a DataMatrix scan event for testing purposes.
        """
        fdagudid = int(fdagudid)
        suture_pack = self.data_store.get_suture_pack_info(fdagudid)

        if suture_pack:
            # Enrich pack info with suture_needle_use from selected sheets
            enriched_pack = self._enrich_pack_info_with_sheet_data(suture_pack)
            self._add_scanned_pack_to_case(fdagudid, enriched_pack)
            self.send_event(json.dumps(enriched_pack), "SUTURE_PACK_SCANNED", "Suture Pack Scanned")

        log_command("mock_scanner_datamatrix_code", self.case, {"fdagudid": fdagudid})
        return True

    @parlay_command()
    def mock_camera_capture_event(self):
        self.app_state.hayscan_count += 1
        result = {
            "image_filename": "CBIBox.png",
            "received_time": get_local_time_string(),
            "image_number": self.app_state.hayscan_count,
        }
        self.app_state.last_cbi_image = result
        self.app_state.save()
        self.send_event(json.dumps(result), "SCANNER_CAMERA_RESULT", "Scanner Camera Result Image")
        log_command("mock_scanner_camera_result", self.case, {"image_name": "CBIBox.png"})
        return True

    @parlay_command()
    def mock_needle_scan_event(self):
        """
        Mocks a HayScan needle detection event for testing purposes.
        Creates a single synthetic verification needle, simulating what
        the physical scanner produces when it detects a needle on the
        sterile field. Used during Closing Count Sections 3 and 5 where
        the nurse places a needle and the scanner would normally detect it.

        Does NOT increment haystack_needles — cir_verified_needles()
        handles that when CIR confirms the verification.
        """
        import uuid

        needle_id = str(uuid.uuid4())
        result = {
            "id": needle_id,
            "needle_count": 1,
            "not_a_needle_count": 0,
            "object_count": 1,
            "error_string": None,
            "response_type": "SINGLE_NEEDLE",
            "results": [
                {
                    "image_filename_used": "HayStackSingleNeedlePostDistortion.bmp",
                    "needle_count": 1,
                }
            ],
            "received_time": get_local_time_string(),
            "image_number": self.app_state.hayscan_count + 1,
            "needle_state_machine": NeedleStateMachine(initial_state=NeedleState.VERIFICATION),
        }
        set_result_state_name(result)
        self.app_state.hayscan_count += 1
        self.app_state.analyzed_needles.append(result)
        self.app_state.save()
        self.update_dashboards()
        log_command("mock_needle_scan_event", self.case, {"needle_id": needle_id})
        return True

    @parlay_command()
    def undo_needle_scan(self):
        """
        Removes the most recently added VERIFICATION-state needle from
        analyzed_needles and decrements hayscan_count. Called when CIR
        presses back on the verification screen in Sections 3/5 to undo
        the needle created by mock_needle_scan_event (or a real scan).
        """
        # Find the last VERIFICATION-state needle (most recently appended)
        for i in range(len(self.app_state.analyzed_needles) - 1, -1, -1):
            needle = self.app_state.analyzed_needles[i]
            sm = needle.get("needle_state_machine")
            if sm and sm.state == NeedleState.VERIFICATION:
                removed = self.app_state.analyzed_needles.pop(i)
                if self.app_state.hayscan_count > 0:
                    self.app_state.hayscan_count -= 1
                self.app_state.save()
                self.update_dashboards()
                log_command("undo_needle_scan", self.case, {"needle_id": removed.get("id")})
                return True

        logger.warning("undo_needle_scan: no VERIFICATION-state needle found to remove")
        return False

    @parlay_command()
    def mock_nfc_uid_scan_event(self, uid="041B8952D61F90"):
        """
        Mocks an NFC UID scan event for testing badge login without a physical scanner.
        Default UID is for the Badge User example.
        """
        log_command("mock_nfc_uid_scan_event", self.case, {"uid": uid})

        if uid:
            try:
                # Look up user first to determine role
                user = next((u for u in self.hayapp_users if u.badge == uid), None)

                if user:
                    if not self.app_state.expected_login_role:
                        # Badge authentication requires explicit role - no defaulting
                        login_result = {
                            "success": False,
                            "uid": uid,
                            "error": "Badge authentication requires explicit role selection",
                        }
                        self.send_event(
                            json.dumps(login_result), "NFC_UID_SCANNED", "NFC UID Scanned"
                        )
                        return login_result

                    logged_in_role = self.app_state.expected_login_role
                    login_success = self.verify_login(badge=uid, role=logged_in_role)

                    if login_success:
                        # Clear expected role only on successful login
                        self.app_state.expected_login_role = ""
                        self.app_state.save()

                        # Get user info for response
                        user_dict = self.data_store.get_user_by_badge(uid)
                        if user_dict:
                            login_result = {
                                "success": True,
                                "user": {
                                    "user_id": user_dict.get("user_id"),
                                    "first_name": user_dict.get("first_name"),
                                    "last_name": user_dict.get("last_name"),
                                    "email": user_dict.get("email", ""),
                                    "roles": user_dict.get("roles", []),
                                },
                                "logged_in_role": logged_in_role,
                                "uid": uid,
                            }
                        else:
                            login_result = {
                                "success": False,
                                "uid": uid,
                                "error": "User data not found",
                            }
                    else:
                        login_result = {
                            "success": False,
                            "uid": uid,
                            "error": "Incorrect badge for selected role",
                        }
                else:
                    login_result = {"success": False, "uid": uid, "error": "Badge not found"}

                self.send_event(json.dumps(login_result), "NFC_UID_SCANNED", "NFC UID Scanned")
                return login_result
            except Exception as e:
                logger.error(f"Error processing mock NFC UID scan: {e}")
                import traceback

                traceback.print_exc()
                login_result = {
                    "success": False,
                    "uid": uid,
                    "error": "Internal error processing badge",
                }
                self.send_event(json.dumps(login_result), "NFC_UID_SCANNED", "NFC UID Scanned")
                return login_result

        return {"success": False, "error": "No UID provided"}

    @parlay_command()
    def remove_scanned_suture_pack(self, fda_guid: int):
        """
        Remove one instance of a scanned suture pack and update the case.
        Returns True if successful, False if pack not found.
        """
        if not fda_guid:
            return False

        # Get suture pack info to know how many needles per pack
        suture_pack_info = self.data_store.get_suture_pack_info(fda_guid)
        if not suture_pack_info:
            return False

        num_needles = suture_pack_info.get("num_needles", 1)

        # Find and remove one pack from case.case_sutures
        pack_removed = False
        for i, suture in enumerate(self.case.case_sutures):
            if suture.fda_guid == fda_guid:
                # Decrement pack count
                if suture.num_packs > 0:
                    suture.num_packs -= 1

                    # If count reaches 0, remove the suture entry
                    if suture.num_packs == 0:
                        self.case.case_sutures.pop(i)

                    pack_removed = True
                    break

        if pack_removed:
            self.data_store.save_case(self.case)
            log_command(
                "remove_scanned_suture_pack",
                self.case,
                {"fda_guid": fda_guid, "num_needles_removed": num_needles},
            )
            # Trigger dashboard update to sync frontend
            self.update_dashboards()
            return True

        return False

    def _add_scanned_pack_to_case(self, fda_guid: int, suture_pack_info: dict):
        """
        Add a scanned suture pack to the case or increment count if it already exists.
        Populates embedded display fields from suture_pack_info for UI performance.
        """
        num_needles = suture_pack_info.get("num_needles", 1)

        # Check if this pack already exists in case.case_sutures
        existing_suture = None
        for suture in self.case.case_sutures:
            if suture.fda_guid == fda_guid:
                existing_suture = suture
                break

        if existing_suture:
            # Increment the pack count
            existing_suture.num_packs += 1
        else:
            # Create new entry with embedded display fields
            nomenclature_data = self._extract_nomenclature_from_pack_info(
                suture_pack_info, fda_guid
            )
            nomenclature = nomenclature_data["nomenclature"]

            new_suture = CaseSuture(
                fda_guid=fda_guid,
                num_packs=1,
                product_code=suture_pack_info.get("product_code", ""),
                nomenclature=nomenclature,
                needles_per_pack=num_needles,
                suture_needle_use=suture_pack_info.get("suture_needle_use", []),
                suture_needle_category=suture_pack_info.get("suture_needle_category", ""),
            )
            self.case.case_sutures.append(new_suture)

        self.data_store.save_case(self.case)
        log_command(
            "add_scanned_suture_pack", self.case, {"fda_guid": fda_guid, "num_needles": num_needles}
        )

        # Trigger dashboard update to sync frontend
        self.update_dashboards()

    @parlay_command()
    def set_cbi_notifications(
        self, contaminated: int = 0, incompatible: int = 0, broken: int = 0, misplaced: int = 0
    ):
        """
        Set the CBI notification counts and notify the frontend.
        """
        self.app_state.cbi_notification_counts = CBINotificationCounts(
            contaminated=contaminated,
            incompatible=incompatible,
            broken=broken,
            misplaced=misplaced,
        )
        self.app_state.save()
        self.send_cbi_notifications_event()
        return self.app_state.cbi_notification_counts.model_dump()

    def send_cbi_notifications_event(self):
        """
        Send the current CBI notification counts to the frontend.
        """
        counts = self.app_state.cbi_notification_counts.model_dump()
        self.send_event(
            json.dumps(counts),
            event="CBI_NOTIFICATION_UPDATE",
            description="CBI Notification Counts Updated",
        )
        return True

    @parlay_command()
    def set_current_cir_screen(self, screen: str | CIRScreen):
        log_command("set_current_cir_screen", self.case, screen)
        self.app_state.current_cir_screen = str(screen)

        # Reset counts when entering setup to ensure clean state
        if str(screen) == CIRScreen.SetupScreen:
            if self.app_state.added_needle_count > 0 or self.app_state.starting_count > 0:
                self.app_state.added_needle_count = 0
                self.app_state.starting_count = 0
                self.app_state.confirmed_total = 0

            # Check if scanner is already authenticated and notify frontend.
            # TODO: Needed to add this so the demo can start on the scan screen. Can remove later.
            if self.scanner.is_authenticated:
                self.scanner.send_event(
                    json.dumps({"challenge_response": "already_authenticated"}),
                    "handshake_response",
                    "Scanner Already Authenticated",
                )

        self.app_state.save()

        # Update dashboards to sync staff across both renderers before screen change
        self.update_dashboards()

        # Emit event to notify CIR frontend of screen change
        self.send_event(
            json.dumps({"screen": str(screen)}),
            event="CIR_SCREEN_CHANGED",
            description="CIR Screen Changed",
        )
        return True

    @parlay_command()
    def set_current_scr_screen(self, screen: str | SCRScreen, set_led: bool = True):
        log_command("set_current_scr_screen", self.case, screen)
        self.app_state.current_scr_screen = str(screen)

        # Reset counts when entering setup to ensure clean state
        if str(screen) == SCRScreen.SetupScreen:
            if self.app_state.added_needle_count > 0 or self.app_state.starting_count > 0:
                self.app_state.added_needle_count = 0
                self.app_state.starting_count = 0
                self.app_state.confirmed_total = 0

        self.app_state.save()
        if set_led:
            self.on_scrub_screen_event(str(screen))

        # Update dashboards to sync staff across both renderers before screen change
        self.update_dashboards()

        # Emit event to notify SCR frontend of screen change
        self.send_event(
            json.dumps({"screen": str(screen)}),
            event="SCR_SCREEN_CHANGED",
            description="SCR Screen Changed",
        )
        return True

    @parlay_command()
    def notify_scr_surgeon_editing_started(self):
        """Notify SCR that CIR has started editing surgeons."""
        log_command("notify_scr_surgeon_editing_started", self.case, {})
        self.send_event(
            json.dumps({"editing": True}),
            event="SURGEON_EDITING_STATUS_CHANGED",
            description="Surgeon Editing Started",
        )
        return True

    @parlay_command()
    def notify_scr_surgeon_editing_ended(self):
        """Notify SCR that CIR has finished editing surgeons."""
        log_command("notify_scr_surgeon_editing_ended", self.case, {})
        self.send_event(
            json.dumps({"editing": False}),
            event="SURGEON_EDITING_STATUS_CHANGED",
            description="Surgeon Editing Ended",
        )
        return True

    @parlay_command()
    def get_restored_state(self):
        """
        Returns the current state for frontend restoration.
        Restores from file, triggers dashboard update, and returns state dict.
        Called by frontend when it connects and needs to restore state.
        """
        self._restore_from_app_state()
        self.update_dashboards()
        self.send_cbi_notifications_event()
        return self.app_state.to_restored_state_dict()

    @parlay_command()
    def haystack_post_test(self):
        """
        Fetch the status of the haystack POST (Power-On Self Test).
        Haystack adapter will emit the result event.
        """
        return self.haystack.post_status

    @parlay_command()
    def clear_case(self):
        log_command("clear_case", self.case)
        self.case = Case()
        self.data_store.clear_case()
        self.data_store.save_case(self.case)

        # Clear app state
        self.app_state.clear()
        self.haystack.set_drop_area_led(LedCommand.OFF)

        # Update dashboards after clearing to send empty state
        self.update_dashboards()

        # Send case cleared event to all renderers
        self.send_event(json.dumps({}), event="CASE_CLEARED", description="Case Cleared")

        return True

    @parlay_command()
    def clear_surgeon(self):
        """Clear the surgeon selection from the case."""
        log_command("clear_surgeon", self.case)
        if self.case.surgeon:
            self.case.surgeon = None
            self.data_store.save_case(self.case)
            self.app_state.surgeon_id = ""
            self.app_state.save()
        return True

    @parlay_command()
    def clear_case_types(self):
        """Clear all selected case types from the case."""
        log_command("clear_case_types", self.case)
        self.case.case_types = []
        self.data_store.save_case(self.case)
        return True

    @parlay_command()
    def clear_suture_sheets(self):
        """Clear selected suture sheets from the case."""
        log_command("clear_suture_sheets", self.case)
        self.case.selected_suture_sheet_ids = []
        self.data_store.save_case(self.case)
        # Also clear cached enriched summary items and redundancy adjustments
        self.app_state.enriched_summary_items = []
        self.app_state.redundant_adjustments = []
        self.app_state.save()
        return True

    @parlay_command()
    def start_interim_count(self):
        """Notify SCR to start interim count process."""
        log_command("start_interim_count", self.case)
        self.send_event("true", "INTERIM_COUNT_STARTED", "Interim count started")
        return True

    @parlay_command()
    def set_confirmed_total(self, total: int):
        """
        Set the confirmed total count from CIR.
        This will be displayed on the SCR screen for confirmation.
        """
        self.app_state.confirmed_total = total
        self.app_state.save()
        return True

    @parlay_command()
    def complete_setup(self, skip: bool = False):
        """
        Called when both CIR and SCR have completed setup and confirmed the total count.
        Triggers navigation to dashboards for both roles.
        """
        self.app_state.starting_count = self.app_state.confirmed_total

        if self.app_state.added_needle_count > 0:
            self.app_state.added_needle_count = 0

        # TODO: remove when we remove skipping to stage 2 logic
        if skip:
            self.app_state.stage = Stage.ACTIVE

        if self.haystack.status_tray:
            self.initialize_haystack()

        if not skip:
            self.app_state.stage = Stage.ACTIVE

        self.app_state.save()
        self.update_dashboards()

        self.send_event(
            json.dumps({"starting_count": self.app_state.starting_count}),
            event="NAVIGATE_TO_DASHBOARD",
            description="Navigate to dashboard",
        )

        return True

    @parlay_command()
    def get_confirmed_total(self):
        """
        Get the confirmed total count to display on SCR.
        """
        return self.app_state.confirmed_total

    @parlay_command()
    def get_total_scanned_needles(self):
        """
        Calculate the total number of needles from all scanned packs.
        Returns: Total count of needles (needles_per_pack * num_packs for all packs)
        """
        total = sum(suture.needles_per_pack * suture.num_packs for suture in self.case.case_sutures)
        return total

    @parlay_command()
    def scr_confirm_total(self, confirmed: bool):
        """
        Handle SCR's confirmation or rejection of the total count.
        - If confirmed=True, checks if total matches scanned needles
        - If confirmed=False, sends false to frontend signaling mismatch

        Sends events to CIR with confirmation status.
        """

        validation_status = TotalValidationStatus.INCORRECT

        if confirmed:
            confirmed_total = self.app_state.confirmed_total
            scanned_total = self.get_total_scanned_needles()

            if confirmed_total < scanned_total:
                validation_status = TotalValidationStatus.TOO_LOW
            elif confirmed_total > scanned_total:
                validation_status = TotalValidationStatus.TOO_HIGH
            else:
                validation_status = TotalValidationStatus.CORRECT

        self.send_event(
            **ScrTotalConfirmationEvent(
                confirmed=confirmed, validation_status=validation_status
            ).to_event()
        )

        return True

    @parlay_command()
    def clear_error_event(self):
        """
        Clear the error event and notify all clients.
        """
        self.send_event("{}", event="ERROR_CLEARED", description="Error dismissed")
        return True

    @parlay_command()
    def set_enriched_summary_items(self, items: list):
        """
        Cache the enriched summary sheet items (with full nomenclature) in AppState.
        Called after calculate_summary_sheet_with_redundancy to store for future use.

        Args:
            items: List of EnrichedSutureSheetItems with full nomenclature fields
        """
        self.app_state.enriched_summary_items = items
        self.app_state.save()
        return True

    @parlay_command()
    def get_enriched_summary_items(self):
        """
        Retrieve cached enriched summary sheet items from AppState.
        Returns empty list if not yet calculated.
        """
        return self.app_state.enriched_summary_items

    @parlay_command()
    def set_redundant_adjustments(self, adjustments: list):
        """
        Store redundancy adjustments from the REVIEW_REDUNDANT_NEEDLES step.
        These are persisted so new surgeons added later can be merged correctly.
        """
        self.app_state.redundant_adjustments = adjustments
        self.app_state.save()
        return True

    @parlay_command()
    def append_sheets_to_enriched_summary(self, new_sheet_ids: list):
        """
        Add new sheet IDs to the selected sheets and recalculate the enriched
        summary using the stored redundancy adjustments. Called when a new
        surgeon or case type is added after the initial setup.
        """
        # Merge new sheet IDs with existing ones (deduplicated, preserve order)
        existing = list(getattr(self.case, "selected_suture_sheet_ids", []))
        for sid in new_sheet_ids:
            if sid not in existing:
                existing.append(sid)
        self.case.selected_suture_sheet_ids = existing
        self.data_store.save_case_model(self.case)

        # Recalculate using ALL sheets + stored redundancy adjustments
        items = self.calculate_summary_sheet_with_redundancy(
            existing, self.app_state.redundant_adjustments
        )

        self.app_state.enriched_summary_items = items
        self.app_state.save()
        log_command(
            "append_sheets_to_enriched_summary", self.case, {"new_sheet_ids": new_sheet_ids}
        )
        return items

    def _build_pack_info_cache(self, suture_sheet_ids: list) -> dict:
        """Build cache of SuturePackInfo for all unique FDA GUIDs."""
        unique_fda_gudids = set()
        for sheet_id in suture_sheet_ids:
            sheet = self.data_store.get_suture_sheet(sheet_id)
            if sheet:
                for sheet_item in sheet.get("suture_sheet_items", []):
                    unique_fda_gudids.add(sheet_item.get("fda_gudid"))

        pack_info_cache = {}
        for fda_gudid in unique_fda_gudids:
            pack_info = self.data_store.get_suture_pack_info(fda_gudid)
            if pack_info:
                pack_info_cache[fda_gudid] = pack_info
        return pack_info_cache

    def _extract_nomenclature_from_pack_info(self, pack_info: dict, fda_gudid: int) -> dict:
        """Extract nomenclature components from SuturePackInfo."""
        if pack_info:
            product_code = pack_info.get("product_code", str(fda_gudid))
            raw_needle_name = pack_info.get("needle_name", "")
            # Use only the first needle name if comma-separated; skip if N/A or empty
            first_needle = raw_needle_name.split(",")[0].strip()
            needle_name = first_needle if first_needle and first_needle.upper() != "N/A" else ""
            suture_gauge = pack_info.get("suture_gauge", "")
            suture_type = pack_info.get("suture_type", "")
            needles_per_pack = pack_info.get("num_needles", 1)

            nomenclature_parts = []
            if suture_gauge:
                nomenclature_parts.append(suture_gauge)
            if suture_type:
                nomenclature_parts.append(suture_type)
            if needle_name:
                nomenclature_parts.append(needle_name)
            nomenclature = (
                " ".join(nomenclature_parts) if nomenclature_parts else f"Unknown ({fda_gudid})"
            )
        else:
            product_code = str(fda_gudid)
            needle_name = ""
            suture_gauge = ""
            suture_type = ""
            needles_per_pack = 1
            nomenclature = f"Unknown ({fda_gudid})"

        return {
            "product_code": product_code,
            "needle_name": needle_name,
            "suture_gauge": suture_gauge,
            "suture_type": suture_type,
            "needles_per_pack": needles_per_pack,
            "nomenclature": nomenclature,
        }

    @staticmethod
    def _normalize_needle_use(suture_needle_use) -> str:
        """Normalize suture_needle_use value for consistent key comparisons."""
        if isinstance(suture_needle_use, list):
            normalized = sorted(item.lower() for item in suture_needle_use)
            return ",".join(normalized)
        return str(suture_needle_use).lower()

    def _add_original_items(
        self,
        result_items: list,
        suture_sheet_ids: list,
        pack_info_cache: dict,
    ):
        """Add original items from each sheet with CPT codes."""
        for sheet_id in suture_sheet_ids:
            sheet = self.data_store.get_suture_sheet(sheet_id)
            if not sheet:
                continue

            primary_cpt_code = sheet.get("cpt_codes", [])[0] if sheet.get("cpt_codes") else None

            for sheet_item in sheet.get("suture_sheet_items", []):
                fda_gudid = sheet_item.get("fda_gudid")
                pack_info = pack_info_cache.get(fda_gudid)
                nomenclature_data = self._extract_nomenclature_from_pack_info(pack_info, fda_gudid)

                result_items.append(
                    {
                        "id": f"{sheet_id}_{fda_gudid}",
                        "fda_gudid": fda_gudid,
                        "product_code": nomenclature_data["product_code"],
                        "nomenclature": nomenclature_data["nomenclature"],
                        "needle_name": nomenclature_data["needle_name"],
                        "suture_gauge": nomenclature_data["suture_gauge"],
                        "suture_type": nomenclature_data["suture_type"],
                        "needles_per_pack": nomenclature_data["needles_per_pack"],
                        "suture_needle_use": sheet_item.get("suture_needle_use", ""),
                        "suture_needle_category": sheet_item.get("suture_needle_category", "Open"),
                        "num_packs": sheet_item.get("num_packs", 0),
                        "cptCode": primary_cpt_code,
                    }
                )

    def _build_aggregation_map(self, suture_sheet_ids: list, pack_info_cache: dict) -> dict:
        """Build aggregation map from all sheets."""
        aggregation_map = {}

        for sheet_id in suture_sheet_ids:
            sheet = self.data_store.get_suture_sheet(sheet_id)
            if not sheet:
                continue

            for sheet_item in sheet.get("suture_sheet_items", []):
                fda_gudid = sheet_item.get("fda_gudid")
                pack_info = pack_info_cache.get(fda_gudid)
                nomenclature_data = self._extract_nomenclature_from_pack_info(pack_info, fda_gudid)

                suture_needle_use = sheet_item.get("suture_needle_use", "")
                num_packs = sheet_item.get("num_packs", 0)
                normalized_use = self._normalize_needle_use(suture_needle_use)
                key = f"{nomenclature_data['product_code']}_{normalized_use}"

                if key in aggregation_map:
                    aggregation_map[key]["total_packs"] += num_packs
                else:
                    aggregation_map[key] = {
                        "fda_gudid": fda_gudid,
                        "product_code": nomenclature_data["product_code"],
                        "nomenclature": nomenclature_data["nomenclature"],
                        "needle_name": nomenclature_data["needle_name"],
                        "suture_gauge": nomenclature_data["suture_gauge"],
                        "suture_type": nomenclature_data["suture_type"],
                        "needles_per_pack": nomenclature_data["needles_per_pack"],
                        "suture_needle_use": suture_needle_use,
                        "suture_needle_category": sheet_item.get("suture_needle_category", "Open"),
                        "total_packs": num_packs,
                    }

        return aggregation_map

    def _add_aggregated_items(
        self, result_items: list, aggregation_map: dict, redundancy_map: dict
    ):
        """Add aggregated items with redundancy applied."""
        for key, agg_item in aggregation_map.items():
            redundant_packs = redundancy_map.get(key, 0)
            total_packs = agg_item["total_packs"]
            remaining_packs = total_packs - redundant_packs

            # Add aggregated non-redundant item
            if remaining_packs > 0:
                result_items.append(
                    {
                        "id": f"combined_{key}",
                        "fda_gudid": agg_item["fda_gudid"],
                        "product_code": agg_item["product_code"],
                        "nomenclature": agg_item["nomenclature"],
                        "needle_name": agg_item["needle_name"],
                        "suture_gauge": agg_item["suture_gauge"],
                        "suture_type": agg_item["suture_type"],
                        "needles_per_pack": agg_item["needles_per_pack"],
                        "suture_needle_use": agg_item["suture_needle_use"],
                        "suture_needle_category": agg_item["suture_needle_category"],
                        "num_packs": remaining_packs,
                        "cptCode": None,
                    }
                )

            # Add JIT item for redundant packs
            if redundant_packs > 0:
                result_items.append(
                    {
                        "id": f"jit_{key}",
                        "fda_gudid": agg_item["fda_gudid"],
                        "product_code": agg_item["product_code"],
                        "nomenclature": agg_item["nomenclature"],
                        "needle_name": agg_item["needle_name"],
                        "suture_gauge": agg_item["suture_gauge"],
                        "suture_type": agg_item["suture_type"],
                        "needles_per_pack": agg_item["needles_per_pack"],
                        "suture_needle_use": agg_item["suture_needle_use"],
                        "suture_needle_category": "JIT",
                        "num_packs": redundant_packs,
                        "cptCode": None,
                    }
                )

    @parlay_command()
    def calculate_summary_sheet_with_redundancy(
        self, suture_sheet_ids: list, redundant_adjustments: list
    ):
        """
        Calculate final summary sheet items with redundancy adjustments applied.
        Returns BOTH original items (for individual case type views) AND
        aggregated items (for combined view). Each item includes full
        nomenclature (suture_gauge + suture_type + needle_name) from
        SuturePackInfo.

        Args:
            suture_sheet_ids: List of suture sheet IDs to include
            redundant_adjustments: List of dicts with structure:
                [
                    {
                        "product_code": str,
                        "suture_needle_use": str,
                        "redundant_packs": int
                    },
                    ...
                ]

        Returns:
            List of EnrichedSutureSheetItems with:
            - Original items from each sheet (with cptCode set) for
              individual views
            - Aggregated items with redundancy applied (with cptCode=None
              for "combined" marker) for combined view
            - Full nomenclature fields: suture_gauge, suture_type,
              needle_name, nomenclature
        """
        # Build pack info cache for all unique FDA GUIDs
        pack_info_cache = self._build_pack_info_cache(suture_sheet_ids)

        # Build redundancy map from adjustments
        redundancy_map = {}
        for adj in redundant_adjustments:
            key = f"{adj['product_code']}_{self._normalize_needle_use(adj['suture_needle_use'])}"
            redundancy_map[key] = adj.get("redundant_packs", 0)

        result_items = []

        # Add original items from each sheet
        self._add_original_items(result_items, suture_sheet_ids, pack_info_cache)

        # Build aggregation map and add aggregated items
        aggregation_map = self._build_aggregation_map(suture_sheet_ids, pack_info_cache)
        self._add_aggregated_items(result_items, aggregation_map, redundancy_map)

        return result_items

    @parlay_command()
    def get_redundant_needle_items(self, case_groups: list):
        """
        Get aggregated redundant needle items for Review Redundant Needles screen.
        Returns items ready for display with all necessary fields populated.

        Calculates potential_redundant_pack as the minimum pack count across different
        case groups. Each case group represents a primary case type + its add-ons.

        Args:
            case_groups: List of case groups, where each group is a list of sheet IDs.
                        Example: [["sheet1", "sheet2"], ["sheet3"]] means:
                        - Case Group 1: sheet1 (primary) + sheet2 (add-on)
                        - Case Group 2: sheet3 (primary)

        Returns:
            List of dicts with structure matching RedundantNeedleItem:
            {
                "id": str,
                "nomenclature": str (formatted: "3-0 PROLENE SH"),
                "product_code": str,
                "needles_per_pack": int,
                "packs_to_open": int (total num_packs),
                "suture_needle_use": str,
                "suture_needle_category": str,
                "potential_redundant_pack": int (min packs across case groups),
                "fda_gudid": int,
                "image": str (pack image filename),
                "manufacturer": str,
                "suture_length": str,
                "suture_color": str,
                "suture_style": str,
                "needle_size": str,
                "needle_arc": str,
                "needle_tip": str,
                "num_sutures": int (number of sutures per pack)
            }
        """
        # Flatten to get all unique sheet IDs
        all_sheet_ids = [sheet_id for group in case_groups for sheet_id in group]

        # Build pack info cache
        pack_info_cache = self._build_pack_info_cache(all_sheet_ids)

        # Build enhanced aggregation map that tracks per-case-group pack counts
        aggregation_map = {}

        for group_index, sheet_ids_in_group in enumerate(case_groups):
            for sheet_id in sheet_ids_in_group:
                sheet = self.data_store.get_suture_sheet(sheet_id)
                if not sheet:
                    continue

                for sheet_item in sheet.get("suture_sheet_items", []):
                    fda_gudid = sheet_item.get("fda_gudid")
                    pack_info = pack_info_cache.get(fda_gudid)
                    nomenclature_data = self._extract_nomenclature_from_pack_info(
                        pack_info, fda_gudid
                    )

                    suture_needle_use = sheet_item.get("suture_needle_use", "")
                    num_packs = sheet_item.get("num_packs", 0)
                    normalized_use = self._normalize_needle_use(suture_needle_use)
                    key = f"{nomenclature_data['product_code']}_{normalized_use}"

                    if key in aggregation_map:
                        aggregation_map[key]["total_packs"] += num_packs
                        # Track pack counts per case group (sum all sheets in the group)
                        if group_index in aggregation_map[key]["packs_by_group"]:
                            aggregation_map[key]["packs_by_group"][group_index] += num_packs
                        else:
                            aggregation_map[key]["packs_by_group"][group_index] = num_packs
                    else:
                        # Initialize with pack counts for this case group
                        # Extract additional fields from pack_info for detailed display
                        aggregation_map[key] = {
                            "fda_gudid": fda_gudid,
                            "product_code": nomenclature_data["product_code"],
                            "nomenclature": nomenclature_data["nomenclature"],
                            "needles_per_pack": nomenclature_data["needles_per_pack"],
                            "suture_needle_use": suture_needle_use,
                            "suture_needle_category": sheet_item.get(
                                "suture_needle_category", "Open"
                            ),
                            "total_packs": num_packs,
                            "packs_by_group": {group_index: num_packs},
                            # Additional fields from SuturePackInfo for detailed display
                            "image": pack_info.get("image", "") if pack_info else "",
                            "manufacturer": pack_info.get("manufacturer", "") if pack_info else "",
                            "suture_length": (
                                pack_info.get("suture_length", "") if pack_info else ""
                            ),
                            "suture_color": pack_info.get("suture_color", "") if pack_info else "",
                            "suture_style": pack_info.get("suture_style", "") if pack_info else "",
                            "needle_size": pack_info.get("needle_size", "") if pack_info else "",
                            "needle_arc": pack_info.get("needle_arc", "") if pack_info else "",
                            "needle_tip": pack_info.get("needle_tip", "") if pack_info else "",
                            "num_sutures": pack_info.get("num_sutures", 1) if pack_info else 1,
                        }

        # Convert aggregation map to RedundantNeedleItem format
        items = []
        for key, agg_data in aggregation_map.items():
            # Calculate potential redundant pack:
            # If item appears in multiple case groups, use minimum pack count across groups
            # Otherwise, redundant pack = 0
            packs_by_group = agg_data["packs_by_group"]
            if len(packs_by_group) > 1:
                potential_redundant_pack = min(packs_by_group.values())
            else:
                potential_redundant_pack = 0

            items.append(
                {
                    "id": key,
                    "nomenclature": agg_data["nomenclature"],
                    "product_code": agg_data["product_code"],
                    "needles_per_pack": agg_data["needles_per_pack"],
                    "packs_to_open": agg_data["total_packs"],
                    "suture_needle_use": agg_data["suture_needle_use"],
                    "suture_needle_category": agg_data["suture_needle_category"],
                    "potential_redundant_pack": potential_redundant_pack,
                    "fda_gudid": agg_data.get("fda_gudid", 0),
                    # Additional fields from SuturePackInfo
                    "image": agg_data.get("image", ""),
                    "manufacturer": agg_data.get("manufacturer", ""),
                    "suture_length": agg_data.get("suture_length", ""),
                    "suture_color": agg_data.get("suture_color", ""),
                    "suture_style": agg_data.get("suture_style", ""),
                    "needle_size": agg_data.get("needle_size", ""),
                    "needle_arc": agg_data.get("needle_arc", ""),
                    "needle_tip": agg_data.get("needle_tip", ""),
                    "num_sutures": agg_data.get("num_sutures", 1),
                }
            )

        # Sort by category: Open (1), Closing (2), JIT (3)
        category_order = {"Open": 1, "Closing": 2, "JIT": 3}
        items.sort(key=lambda x: category_order.get(x["suture_needle_category"], 999))

        return items

    @parlay_command()
    def misplaced_needle_placed(self):
        """
        Called by SCR when the nurse confirms a misplaced needle has been
        placed on the sterile field (Closing Count Section 3).

        Decrements whole_misplaced_needles by 1. The frontend's "Not Found"
        paths call increment_misplaced_needles() which increments
        whole_misplaced_needles, so this must decrement the same counter.

        Note: misplaced_needles (without "whole_") is a separate counter for
        broken halves — set by scanner verification, contributes as
        misplaced // 2 to confirmed. whole_misplaced_needles contributes
        as whole_misplaced (1:1, not divided).

        Does NOT create verification items or increment haystack_needles.
        In production, the scanner generates the verification item.
        In mock/dev, the frontend calls mock_needle_scan_event() separately.
        When CIR confirms the verification, cir_verified_needles() handles
        the haystack increment.
        """
        self.app_state.whole_misplaced_needles = max(0, self.app_state.whole_misplaced_needles - 1)
        self.app_state.save()
        self.update_dashboards()
        return True

    @parlay_command()
    def decrement_added_needle_count(self):
        """
        Called when an extra needle is found and placed on the sterile field
        (Closing Count Section 10 → Section 5 flow).

        Decrements added_needle_count by 1 so the Section 10 loop terminates
        when all extra needles have been accounted for. Mirrors
        misplaced_needle_placed() which decrements whole_misplaced_needles
        for Section 3.
        """
        self.app_state.added_needle_count = max(0, self.app_state.added_needle_count - 1)
        self.app_state.save()
        self.update_dashboards()
        return True

    @parlay_command()
    def increment_added_needle_count(self, count: int = 1, from_interim: bool = False):
        """
        Register extra needles discovered during Closing Count Section 1.
        When confirmed count exceeds starting + added, and the nurse confirms
        CBI box and wrappers are correct, the overcount is registered as extra
        so Decision Node 9 routes to Section 10 for physical resolution.
        """
        self.app_state.added_needle_count += count
        if from_interim:
            self.app_state.interim_added_needle_count += count
        self.app_state.save()
        self.update_dashboards()
        return True

    @parlay_command()
    def increment_misplaced_needles(self, count: int = 1):
        """
        Increment the count of misplaced needles in the app state and notify frontend.
        """
        self.app_state.whole_misplaced_needles += count
        self.app_state.save()
        self.update_dashboards()
        return True

    @parlay_command()
    def decrement_misplaced_needles(self, count: int = 1):
        """
        Undo increment_misplaced_needles when user navigates back
        from a NeedleRegistered screen.
        """
        self.app_state.whole_misplaced_needles = max(
            0, self.app_state.whole_misplaced_needles - count
        )
        self.app_state.save()
        self.update_dashboards()
        return True

    @parlay_command()
    def increment_found_non_sterile(self, count: int = 1):
        """
        Increment the count of needles found in the non-sterile field and notify frontend.
        """
        self.app_state.found_non_sterile_needles += count
        self.app_state.whole_misplaced_needles += count
        self.app_state.save()
        self.update_dashboards()
        return True

    @parlay_command()
    def decrement_found_non_sterile(self, count: int = 1):
        """
        Decrement the count of needles found in the non-sterile field and notify frontend.
        """
        actual = min(count, self.app_state.found_non_sterile_needles)
        self.app_state.found_non_sterile_needles -= actual
        self.app_state.whole_misplaced_needles = max(
            0, self.app_state.whole_misplaced_needles - actual
        )
        self.app_state.save()
        self.update_dashboards()
        return True

    @parlay_command()
    def skip_to_stage_2(self):
        """
        Development helper to skip setup and go directly to stage 2.
        Automatically selects first CIR, SCR, and surgeon from available staff.
        """
        # Get first CIR user
        cir_users = [u for u in self.hayapp_users if HayAppRole.Circulator in u.roles]
        scr_users = [u for u in self.hayapp_users if HayAppRole.Scrub in u.roles]

        if not cir_users or not scr_users or not self.surgeons:
            return {
                "success": False,
                "error": (
                    f"Missing staff: CIR={bool(cir_users)}, "
                    f"SCR={bool(scr_users)}, Surgeons={bool(self.surgeons)}"
                ),
            }

        cir = cir_users[0]
        scr = scr_users[0]
        surgeon = self.surgeons[0]

        # Set staff
        self.add_case_worker(cir.user_id, "CIR")
        self.add_case_worker(scr.user_id, "SCR")
        self.add_surgeon(surgeon.surgeon_id)

        # Set starting count
        self.app_state.starting_count = 70
        self.app_state.confirmed_total = 70

        # Complete setup and transition to stage 2
        self.complete_setup(skip=True)

        # Set screens (after complete_setup to ensure stage is already ACTIVE)
        # These calls will send events that trigger frontend navigation
        self.set_current_cir_screen(CIRScreen.Dashboard)
        self.set_current_scr_screen(SCRScreen.ScrDashboardValidateInactive)

        return {
            "success": True,
            "cir_name": f"{cir.first_name} {cir.last_name}",
            "scr_name": f"{scr.first_name} {scr.last_name}",
            "surgeon_name": f"{surgeon.first_name} {surgeon.last_name}",
        }

    def _populate_mock_scenario(
        self,
        starting_count: int,
        haystack_needles: int,
        contaminated: int = 0,
        broken: int = 0,
        incompatible: int = 0,
        misplaced: int = 0,
        whole_misplaced: int = 0,
        verification_count: int = 6,
        adjudication_count: int = 1,
        readjudication_count: int = 0,
        extra_needles: int = 0,
    ):
        """
        Shared helper for mock scenario setup. Resets state, creates mock needles
        and CBI items, then triggers a dashboard update.

        Confirmed formula (from update_dashboards):
          confirmed = haystack + contaminated + incompatible + broken//2
                      + misplaced//2 + haystack_broken//2 + whole_misplaced
                      - other_sharps
        Remaining = starting_count - confirmed
        """
        import uuid

        def create_mock_needle(
            state: NeedleState, image_filename: str, response_type: str = "SINGLE_NEEDLE"
        ):
            needle_id = str(uuid.uuid4())
            result = {
                "id": needle_id,
                "needle_count": 1,
                "not_a_needle_count": 0,
                "object_count": 1,
                "error_string": None,
                "response_type": response_type,
                "results": [
                    {
                        "image_filename_used": image_filename,
                        "needle_count": 1,
                    }
                ],
                "received_time": get_local_time_string(),
                "image_number": self.app_state.hayscan_count + 1,
                "needle_state_machine": NeedleStateMachine(initial_state=state),
            }
            set_result_state_name(result)
            self.app_state.hayscan_count += 1
            return result

        # Full reset so dashboard starts clean regardless of prior state
        self.app_state.clear()

        self.app_state.starting_count = starting_count
        self.app_state.confirmed_total = starting_count
        self.app_state.haystack_needles = haystack_needles
        self.app_state.misplaced_needles = misplaced
        self.app_state.whole_misplaced_needles = whole_misplaced
        self.app_state.added_needle_count = extra_needles

        # Create verification needles
        for _ in range(verification_count):
            needle = create_mock_needle(
                NeedleState.VERIFICATION, "HayStackSingleNeedlePostDistortion.bmp"
            )
            self.app_state.analyzed_needles.append(needle)

        # Create adjudication needles
        for _ in range(adjudication_count):
            needle = create_mock_needle(
                NeedleState.ADJUDICATION,
                "HayStackSingleNeedlePostDistortion.bmp",
                "MULTIPLE_NEEDLES",
            )
            self.app_state.analyzed_needles.append(needle)

        # Create re-adjudication needles (pre-existing from Stage 2)
        for _ in range(readjudication_count):
            needle = create_mock_needle(
                NeedleState.READJUDICATION,
                "HayStackSingleNeedlePostDistortion.bmp",
                "MULTIPLE_NEEDLES",
            )
            self.app_state.analyzed_needles.append(needle)

        # Always pre-set CBI counts on the case model. In the real flow,
        # Stage 2 sets these before closing count starts. SET behavior in
        # add_confirmed_cbi_needles re-confirms the same values on SCR
        # acceptance (no change to formula).
        self.case.cbi_contaminated_needle_count = contaminated
        self.case.cbi_broken_needle_count = broken
        self.case.cbi_incompatible_needle_count = incompatible
        self.data_store.save_case(self.case)

        # Add CBI items to pending_cbi_validations for display
        self.app_state.pending_cbi_validations = []
        if contaminated > 0:
            self.app_state.pending_cbi_validations.append(
                {
                    "id": str(uuid.uuid4()),
                    "image_filename": "CBIBox.png",
                    "type": "contaminated",
                    "count": contaminated,
                    "source": "cbi",
                    "received_time": get_local_time_string(),
                    "image_number": self.app_state.hayscan_count + 1,
                }
            )
            self.app_state.hayscan_count += 1

        if broken > 0:
            self.app_state.pending_cbi_validations.append(
                {
                    "id": str(uuid.uuid4()),
                    "image_filename": "CBIBox.png",
                    "type": "broken",
                    "count": broken,
                    "source": "cbi",
                    "received_time": get_local_time_string(),
                    "image_number": self.app_state.hayscan_count + 1,
                }
            )
            self.app_state.hayscan_count += 1

        if incompatible > 0:
            self.app_state.pending_cbi_validations.append(
                {
                    "id": str(uuid.uuid4()),
                    "image_filename": "CBIBox.png",
                    "type": "incompatible",
                    "count": incompatible,
                    "source": "cbi",
                    "received_time": get_local_time_string(),
                    "image_number": self.app_state.hayscan_count + 1,
                }
            )
            self.app_state.hayscan_count += 1

        # Persist CBI image info so the frontend cbiImage listenable is populated
        # via update_dashboards. Without this, NeedleTapScreen shows no image and
        # cbi_needles_counted skips creating validation items (empty filename).
        if contaminated > 0 or broken > 0 or incompatible > 0:
            self.app_state.last_cbi_image = {
                "image_filename": "CBIBox.png",
                "received_time": get_local_time_string(),
                "image_number": self.app_state.hayscan_count,
            }

        self.app_state.save()
        self.update_dashboards()

        return {
            "success": True,
            "starting_count": starting_count,
            "haystack_needles": haystack_needles,
            "verification": verification_count,
            "adjudication": adjudication_count,
            "contaminated": contaminated,
            "broken": broken,
            "incompatible": incompatible,
            "misplaced": misplaced,
            "whole_misplaced": whole_misplaced,
        }

    @parlay_command()
    def closingcount_mock(
        self,
        starting_count: int = 10,
        haystack_needles: int = 7,
        contaminated: int = 1,
        broken: int = 2,
        incompatible: int = 1,
        misplaced: int = 0,
        whole_misplaced: int = 0,
        verification_count: int = 6,
        adjudication_count: int = 1,
        readjudication_count: int = 0,
        extra_needles: int = 0,
    ):
        """
        Single parameterized mock scenario for closing count testing.
        See MOCK_SCENARIOS.md for preset parameter combinations.

        Args:
            starting_count: Initial needle count for the case
            haystack_needles: Pre-scanned needles already in haystack
            contaminated: Number of contaminated CBI needles
            broken: Number of broken CBI needles
            incompatible: Number of incompatible CBI needles
            misplaced: Number of misplaced needles (contributes as misplaced//2)
            whole_misplaced: Number of whole misplaced needles (contributes as-is)
            verification_count: Number of mock verification items to create
            adjudication_count: Number of mock adjudication items to create
            readjudication_count: Number of mock re-adjudication items
                to create (pre-existing from Stage 2)
            extra_needles: Number of extra suture needles registered
        """
        # ParlayUI sends all parameters as strings — cast to correct types
        starting_count = int(starting_count)
        haystack_needles = int(haystack_needles)
        contaminated = int(contaminated)
        broken = int(broken)
        incompatible = int(incompatible)
        misplaced = int(misplaced)
        whole_misplaced = int(whole_misplaced)
        verification_count = int(verification_count)
        adjudication_count = int(adjudication_count)
        readjudication_count = int(readjudication_count)
        extra_needles = int(extra_needles)

        return self._populate_mock_scenario(
            starting_count=starting_count,
            haystack_needles=haystack_needles,
            contaminated=contaminated,
            broken=broken,
            incompatible=incompatible,
            misplaced=misplaced,
            whole_misplaced=whole_misplaced,
            verification_count=verification_count,
            adjudication_count=adjudication_count,
            readjudication_count=readjudication_count,
            extra_needles=extra_needles,
        )
