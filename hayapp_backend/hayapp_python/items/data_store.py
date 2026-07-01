# -*- coding: utf-8 -*-
import asyncio
import logging
import os
import uuid
from threading import Lock
from typing import Callable

from parlay import ParlayCommandItem, local_item, parlay_command
from tinydb import TinyDB, where

from hayapp_python.common.config_manager import config
from hayapp_python.common.defs import DataStore_item as item
from hayapp_python.common.enums import CBIType, HayAppRole
from hayapp_python.common.utils import get_utc_iso_timestamp
from hayapp_python.items.cloud_store import CloudStore
from hayapp_python.items.models import (
    BadNeedle,
    Case,
    CaseType,
    CaseWorker,
    CBINeedles,
    HayAppUser,
    PrettyJSONStorage,
    Surgeon,
    SuturePack,
)

logger = logging.getLogger("hayapp")


@local_item()
class DataStore(ParlayCommandItem):
    __version__: str = "0.0.1"

    # Class-level lock shared across ALL DataStore instances to prevent corruption
    # when multiple Parlay clients (from different Electron renderers) access simultaneously
    _db_lock = Lock()

    def __init__(
        self,
        cloud: CloudStore = None,
        item_id=item.id,
        name="DataStore",
        auto_migrate: bool = True,
    ):
        self.cloud = cloud if cloud else CloudStore()
        reference_db_path = str(config.paths.database_path / "reference_data.json")
        timestamp = get_utc_iso_timestamp().replace(":", "")
        unique_id = uuid.uuid4().hex[:8]
        case_db_filename = f"case_data_{timestamp}_{unique_id}.json"
        case_db_path = str(config.paths.database_cases_path / case_db_filename)
        suture_pack_db_path = str(config.paths.database_path / "suture_wrapper_data.json")

        ParlayCommandItem.__init__(self, item_id=item.id, name=item.name)
        self.test_images_dir = os.path.join(os.path.dirname(__file__), "test_images")

        # Reference tables (downloaded from cloud at app start)
        self.reference_db = TinyDB(reference_db_path, storage=PrettyJSONStorage)
        self.surgeon_table = self.reference_db.table("surgeons")
        self.hayapp_user_table = self.reference_db.table("hayapp_users")
        self.case_types_table = self.reference_db.table("case_types")
        self.suture_table = self.reference_db.table("sutures")
        self.suture_sheet_table = self.reference_db.table("suture_sheets")

        # Suture pack db is the needle database
        self.suture_pack_db = TinyDB(suture_pack_db_path, storage=PrettyJSONStorage)
        self.suture_pack_table = self.suture_pack_db.table("suture_wrappers")

        # Case data (uploaded to cloud at end of case)
        self.case_db = TinyDB(case_db_path, storage=PrettyJSONStorage)
        self.case_table = self.case_db.table("case")
        self.pendings_table = self.case_db.table("pending_adjudication")
        # Set True when cloud returns 401/403, or group-scoped reference calls indicate the
        # stored group/org is invalid: always on 404/422; on 500/502/503 only during startup
        # migration (see CloudStore.strict_group_reference_denial_for_5xx).
        self.group_data_access_denied = False

        # Only run migration if valid credentials are stored (not placeholder values)
        api_key = config.cloud.api_key
        group_id = config.cloud.group_id
        if auto_migrate and api_key and group_id:
            asyncio.run(self._first_time_migration(strict_group_reference_denial_for_5xx=True))
        else:
            logger.info(
                "Skipping data migration - device not yet provisioned (missing API key or group ID)"
            )

    def get_user_by_login(self, login: str):
        return self.hayapp_user_table.get(where("login") == login)

    def get_case_model(self):
        case_doc = self.case_table.get(doc_id=1)
        if not case_doc or case_doc == {}:
            return None
        return Case.from_dict(case_doc)

    def save_case_model(self, case: Case):
        self.case_table.upsert(case.to_dict(), where("case_id") == case.case_id)

    # TODO: these may be useful when hooked up to cloud for syncing data
    # def validate_reference_data(self, data: dict) -> bool:
    #     required_tables = ['staff', 'hayapp_users', 'surgeon_case_types', 'case_types']
    #     for table in required_tables:
    #         if table not in data or not isinstance(data[table], list):
    #             print(f"Reference data missing or invalid table: {table}")
    #             return False
    #     return True

    # def validate_case_data(self, case_dict: dict) -> bool:
    #     required_fields = ['case_id', 'staff', 'state',
    #     'case_types', 'bad_needles', 'interim_counts', 'relief_counts', 'login_events']
    #     for field in required_fields:
    #         if field not in case_dict:
    #             print(f"Case data missing field: {field}")
    #             return False
    #     return True

    # TODO: Remove/update when hooked up to cloud
    #  (download_from_cloud/upload_to_cloud methods needed)
    # Async so we can make multiple cloud calls simultaneously
    async def _first_time_migration(
        self,
        strict_group_reference_denial_for_5xx: bool = False,
        progress_cb: Callable[[dict], None] | None = None,
    ):
        self.cloud.reset_sync_status()
        self.cloud.strict_group_reference_denial_for_5xx = strict_group_reference_denial_for_5xx
        try:
            self.cloud.replace_async_client_for_new_event_loop()
            self.group_data_access_denied = False
            await self._run_reference_migration_tasks(progress_cb=progress_cb)
        finally:
            self.cloud.strict_group_reference_denial_for_5xx = False

    async def _run_reference_migration_tasks(
        self, progress_cb: Callable[[dict], None] | None = None
    ):
        if progress_cb:
            progress_cb({"stage": "reference_fetch_start", "message": "Fetching facility data..."})
        async with asyncio.TaskGroup() as tg:
            fetch_surgeons_task = tg.create_task(self.cloud.fetch_surgeons())
            fetch_hayapp_users_task = tg.create_task(self.cloud.fetch_hayapp_users())
            fetch_case_types_task = tg.create_task(self.cloud.fetch_case_types())
            fetch_suture_sheets_task = tg.create_task(self.cloud.fetch_suture_sheets())
            tg.create_task(self.cloud.update_needle_db(progress_cb=progress_cb))
            tg.create_task(self.cloud.update_suture_pack_images(progress_cb=progress_cb))

        surgeons = fetch_surgeons_task.result()
        hayapp_users = fetch_hayapp_users_task.result()
        case_types = fetch_case_types_task.result()
        suture_sheets = fetch_suture_sheets_task.result()

        if self.cloud.last_sync_auth_error or self.cloud.last_sync_group_access_denied:
            self.group_data_access_denied = True
            if self.cloud.last_sync_auth_error:
                logger.error(
                    "Cloud rejected this API key for the configured group (HTTP 401/403). "
                    "Reprovision the device to obtain a valid group ID for this key."
                )
            else:
                logger.error(
                    "Cloud or middleware could not load reference data for the configured "
                    "group ID (missing facility/org, wrong environment, or unacceptable HTTP "
                    "status on startup). Reprovision the device or fix the stored group ID."
                )
            return

        if self.cloud.last_sync_error:
            logger.warning(
                "Cloud sync encountered errors - tables with no data returned will "
                "preserve existing cached data for offline operation."
            )

        if len(surgeons) > 0:
            logger.info("Fetched surgeons from cloud")
            with DataStore._db_lock:
                self.surgeon_table.truncate()
            self.surgeon_table.insert_multiple(surgeons)
        else:
            logger.warning("No surgeons returned from cloud - preserving existing cached surgeons.")

        # Update user table only when cloud returned data; otherwise keep existing cache
        if len(hayapp_users) > 0:
            logger.info("Fetched hayapp users from cloud")
            with DataStore._db_lock:
                self.hayapp_user_table.truncate()
            self.hayapp_user_table.insert_multiple(hayapp_users)
        else:
            logger.warning(
                "No hayapp users returned from cloud - preserving existing cached users."
            )
        if len(case_types) > 0:
            logger.info("Fetched case types from cloud")
            with DataStore._db_lock:
                self.case_types_table.truncate()
            self.case_types_table.insert_multiple(case_types)
        else:
            logger.warning(
                "No case types returned from cloud - preserving existing cached case types."
            )

        if len(suture_sheets) > 0:
            logger.info("Fetched suture sheets from cloud")
            with DataStore._db_lock:
                self.suture_sheet_table.truncate()
            self.suture_sheet_table.insert_multiple(suture_sheets)
        else:
            logger.warning(
                "No suture sheets returned from cloud - preserving existing cached suture sheets."
            )

    async def sync_group_data(self, progress_cb: Callable[[dict], None] | None = None) -> dict:
        """
        Force a cloud sync of reference data and return a concise result payload.
        """
        try:
            if progress_cb:
                progress_cb({"stage": "sync_start", "message": "Starting cloud sync..."})
            await self._first_time_migration(progress_cb=progress_cb)
            if self.cloud.last_sync_auth_error:
                return {
                    "success": False,
                    "error": "Cloud sync failed: unauthorized API key/group access (401/403).",
                }
            if self.cloud.last_sync_group_access_denied:
                return {
                    "success": False,
                    "error": (
                        "Cloud sync failed: facility/group reference data is missing or "
                        "unreachable (e.g. invalid group ID or Cyphermed org not found). "
                        "Reprovision or correct the environment."
                    ),
                }
            if self.cloud.last_sync_error:
                return {
                    "success": False,
                    "error": f"Cloud sync failed: {self.cloud.last_sync_error}",
                }
            return {
                "success": True,
                "surgeons": len(self.surgeon_table),
                "hayapp_users": len(self.hayapp_user_table),
                "case_types": len(self.case_types_table),
                "suture_sheets": len(self.suture_sheet_table),
                "suture_packs": len(self.suture_pack_table),
            }
        except Exception as e:
            logger.error(f"sync_group_data failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
            }

    def get_hayapp_users_objects(self):
        with DataStore._db_lock:
            return [HayAppUser.from_dict(u) for u in self.hayapp_user_table.all()]

    def get_surgeons_objects(self):
        with DataStore._db_lock:
            return [Surgeon.from_dict(s) for s in self.surgeon_table.all()]

    @parlay_command()
    def get_hayapp_users(self):
        with self._db_lock:
            return self.hayapp_user_table.all()

    @parlay_command()
    def get_surgeons(self):
        with self._db_lock:
            return self.surgeon_table.all()

    @parlay_command()
    def get_case_types(self):
        with self._db_lock:
            return self.case_types_table.all()

    @parlay_command()
    def get_hayapp_users_by_role(self, role=""):
        with self._db_lock:
            if not role:
                return self.hayapp_user_table.all()
            return [user for user in self.hayapp_user_table.all() if role in user.get("roles", [])]

    @parlay_command()
    def get_surgeon_by_id(self, surgeon_id: str):
        with self._db_lock:
            return self.surgeon_table.get(where("surgeon_id") == surgeon_id)

    @parlay_command()
    def get_case_types_for_surgeon(self, surgeon_id: str):
        with self._db_lock:
            return [ct for ct in self.case_types_table.all() if ct.get("surgeon_id") == surgeon_id]

    @parlay_command()
    def get_room_id(self):
        return "OR-W03-R002"

    # Case data methods
    @parlay_command()
    def get_case(self):
        case = self.get_case_model()
        return case.to_dict() if case else None

    def save_case(self, case):
        self.save_case_model(case)

    def clear_case(self):
        self.case_table.truncate()

    def clear_reference_data(self):
        self.surgeon_table.truncate()
        self.hayapp_user_table.truncate()
        self.case_types_table.truncate()
        self.suture_sheet_table.truncate()
        self.suture_table.truncate()
        self.suture_pack_table.truncate()

    @parlay_command()
    def add_surgeon(self, case, surgeon_id):
        case.staff.surgeon.append(Surgeon.from_dict(self.get_surgeon_by_id(surgeon_id)))
        self.save_case_model(case)
        return True

    @parlay_command()
    def set_case_types(self, case, case_types_list):
        logger.info(f"Setting case types: {case_types_list}")
        new_case_types = []
        for ct in case_types_list:
            ref_ct = self.case_types_table.get(where("case_type_id") == ct["case_type_id"])
            if ref_ct:
                new_case_types.append(CaseType.from_dict(ref_ct))
        case.case_types = new_case_types
        self.save_case_model(case)
        return True

    @parlay_command()
    def remove_case_type(self, case, case_type_id):
        case.case_types = [ct for ct in case.case_types if ct.case_type_id != case_type_id]
        self.save_case_model(case)
        return True

    @parlay_command()
    def add_case_worker(self, case, user_id, role):
        hayapp_role = HayAppRole(role)
        existing_worker = next(
            (
                cw
                for cw in case.staff.cir + case.staff.scr
                if cw.user_id == user_id
                and cw.role == hayapp_role
                and getattr(cw, "signout", None) is None
            ),
            None,
        )
        if existing_worker:
            return False
        now = get_utc_iso_timestamp()
        case_worker = CaseWorker(user_id=user_id, role=hayapp_role, signin=now, signout=None)
        if hayapp_role == HayAppRole.Circulator:
            case.staff.cir.append(case_worker)
        elif hayapp_role == HayAppRole.Scrub:
            case.staff.scr.append(case_worker)
        self.save_case_model(case)
        return True

    @parlay_command()
    def add_bad_needle(self, case, image, amount, verified):
        case.bad_needles.append(BadNeedle(image=image, amount=amount, verified=verified))
        self.save_case_model(case)
        return True

    @parlay_command()
    def get_bad_needles(self):
        case = self.get_case_model()
        if not case:
            return []
        return [
            {"image": bn.image, "amount": bn.amount, "verified": bn.verified}
            for bn in case.bad_needles
        ]

    @parlay_command()
    def add_interim_count(self, case, interim_count):
        case.interim_counts.append(interim_count)
        self.save_case_model(case)
        return True

    @parlay_command()
    def add_relief_count(self, case, relief_count):
        case.relief_counts.append(relief_count)
        self.save_case_model(case)
        return True

    @parlay_command()
    def set_case_state(self, case, state):
        case.state = state
        self.save_case_model(case)
        return

    @parlay_command()
    def save_login_event(self, case, event):
        case.login_events.append(event)
        self.save_case_model(case)
        return True

    @parlay_command()
    def set_case_suture(self, case, case_suture):
        case.case_sutures.append(case_suture)
        self.save_case(case)
        return True

    @parlay_command()
    def get_suture_pack_info(self, fda_guid: int):
        logger.info(f"Fetching suture pack info for FDA GUID: {fda_guid}")
        pack = self.suture_pack_table.get(where("fda_guid") == fda_guid)
        if not pack:
            return None
        logger.info(f"Retrieved suture pack: {pack}")
        return pack

    @parlay_command()
    def add_case_suture(self, case, case_suture):
        case.case_sutures.append(case_suture)
        self.save_case_model(case)
        return True

    @parlay_command()
    def add_adjudicated_image(self, case, adjudicated_image):
        case.adjudicated_images.append(adjudicated_image)
        self.remove_pending_adjudication(adjudicated_image.image)
        self.save_case_model(case)
        return True

    @parlay_command()
    def get_adjudicated_images(self):
        return self.case_table.get(doc_id=1).get("adjudicated_images", [])

    def add_closing_count(self, case, closing_count):
        case.closing_counts.append(closing_count)
        self.save_case_model(case)
        return True

    @parlay_command()
    def get_suture_sheet(self, suture_sheet_id: str):
        logger.info(f"Fetching suture sheet with ID: {suture_sheet_id}")
        return self.suture_sheet_table.get(where("suture_sheet_id") == suture_sheet_id)

    @parlay_command()
    def get_suture_sheets_for_surgeon(self, surgeon_id: str):
        """Get all suture sheets for a specific surgeon"""
        logger.info(f"Fetching suture sheets for surgeon ID: {surgeon_id}")
        sheets = self.suture_sheet_table.search(where("surgeon_id") == surgeon_id)
        return sheets if sheets else []

    @parlay_command()
    def surgeon_has_suture_sheet_for_cpt(self, surgeon_id: str, cpt_code: str):
        """Check if a surgeon has a suture sheet for a specific CPT code"""
        logger.info(f"Checking if surgeon {surgeon_id} has sheet for CPT {cpt_code}")
        sheets = self.suture_sheet_table.search(where("surgeon_id") == surgeon_id)
        for sheet in sheets:
            if cpt_code in sheet.get("cpt_codes", []):
                return True
        return False

    def get_user_by_id(self, user_id: str):
        return self.hayapp_user_table.get(where("user_id") == user_id)

    def confirmed_added(self, case, suture_pack_info: dict):
        case.added_needles.append(SuturePack.from_dict(suture_pack_info))
        self.save_case_model(case)
        return True

    def cbi_needles_counted(self, case, type: str, count: int, image: str):
        case.cbi_needles.append(CBINeedles(type=type, count=count, image=image))
        self.save_case_model(case)
        return True

    def get_added_needles(self, case):
        return [an.to_dict() for an in case.added_needles]

    def add_confirmed_cbi_needles(self, case, needle_type: str, count: int):
        """
        Set the confirmed CBI needle count for the given type.
        Called on final SCR acceptance. Uses SET because the NeedleTapScreen
        shows the full CBI box photo — the nurse taps ALL visible needles
        of that type, so count is the new total (not a delta).
        """
        try:
            cbi_type = CBIType(needle_type)
        except ValueError:
            return False

        if cbi_type == CBIType.Contaminated:
            case.cbi_contaminated_needle_count = count
        elif cbi_type == CBIType.Incompatible:
            case.cbi_incompatible_needle_count = count
        elif cbi_type == CBIType.Broken:
            case.cbi_broken_needle_count = count
        else:
            return False

        self.save_case_model(case)
        return True

    @parlay_command()
    def get_user_by_badge(self, badge: str):
        """
        Look up a hayapp user by their badge UID
        Returns the user dict if found, None otherwise
        """
        return self.hayapp_user_table.get(where("badge") == badge)

    @parlay_command()
    def version(self):
        return DataStore.__version__
