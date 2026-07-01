import logging
import os
import zipfile
from pathlib import Path
from typing import Callable, List

import httpx
from parlay import ParlayCommandItem, ParlayProperty, local_item, parlay_command
from tinydb import TinyDB, where

from hayapp_python.common.cloud_config import ENDPOINTS
from hayapp_python.common.config_manager import config
from hayapp_python.common.defs import CloudStore_item
from hayapp_python.common.utils import calculate_md5
from hayapp_python.items.models import (
    Case,
    FileUploadData,
    JsonUploadData,
    PrettyJSONStorage,
    UploadItem,
)

logger = logging.getLogger("hayapp")


async def download_to_file(
    url: str,
    file_path: str,
    progress_cb: Callable[[int | None], None] | None = None,
) -> bool:
    success = False
    try:
        Path(file_path).parent.mkdir(parents=True, exist_ok=True)
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", url) as response:
                if response.is_success:
                    total_bytes = response.headers.get("content-length")
                    total = int(total_bytes) if total_bytes and total_bytes.isdigit() else None
                    downloaded = 0
                    if progress_cb:
                        progress_cb(total)
                    with open(file_path, "wb") as file:
                        async for chunk in response.aiter_bytes(chunk_size=8192):
                            file.write(chunk)
                            downloaded += len(chunk)
                            if progress_cb:
                                progress_cb(downloaded)
                    success = True
                else:
                    logger.error(f"Failed to download file, status code: {response.status_code}")
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
    finally:
        return success


@local_item()
class CloudStore(ParlayCommandItem):
    __version__: str = "0.0.1"

    is_online = ParlayProperty(default=False, val_type=bool, read_only=True)
    currently_uploading_pending = ParlayProperty(default=False, val_type=bool, read_only=True)

    def __init__(self, item_id=CloudStore_item.id, item_name=CloudStore_item.name):
        ParlayCommandItem.__init__(self, item_id=item_id, name=item_name)
        self.base_url = config.cloud.middleware_url
        # Only set API key header if it exists
        api_key = config.cloud.api_key
        headers = {}
        if api_key:
            headers["X-API-Key"] = api_key
        self.client = httpx.AsyncClient(base_url=self.base_url, headers=headers)
        self.last_sync_auth_error = False
        self.last_sync_group_access_denied = False
        self.last_sync_error: str | None = None
        # When True, group-scoped reference 5xx also set last_sync_group_access_denied (startup
        # migration only). Manual sync_group_data leaves this False so transient 500s do not
        # force reprovision.
        self.strict_group_reference_denial_for_5xx = False

        # Locations for
        self.suture_db_file = config.paths.database_path / "suture_wrapper_data.json"
        self.images_zip_file = config.paths.image_path / "suture_wrapper_images.zip"
        self.images_path = config.paths.image_path / "suture_wrapper_images"

        # Case data (uploaded to cloud at end of case)
        uploads_db_path = config.paths.database_path / "upload_items.json"
        self.uploads_db = TinyDB(uploads_db_path, storage=PrettyJSONStorage)
        self.pending_uploads = self.uploads_db.table("pending_uploads")
        self._check_connection()

    def replace_async_client_for_new_event_loop(self) -> None:
        """
        Each asyncio.run(...) creates a loop and closes it when done. httpx.AsyncClient
        must not be reused across those cycles or requests fail with 'Event loop is closed'.
        Call this at the start of any coroutine run via asyncio.run() that uses self.client.
        """
        self.client = httpx.AsyncClient(base_url=self.base_url, headers={})
        self._refresh_auth_headers()

    def reset_sync_status(self) -> None:
        self.last_sync_auth_error = False
        self.last_sync_group_access_denied = False
        self.last_sync_error = None

    def _refresh_auth_headers(self) -> None:
        """
        Ensure AsyncClient headers reflect the latest API key from keyring.
        This is required because provisioning can happen after CloudStore is instantiated.
        """
        api_key = config.cloud.api_key
        if api_key:
            self.client.headers["X-API-Key"] = api_key
        else:
            self.client.headers.pop("X-API-Key", None)

    def _record_sync_http_failure(self, status_code: int, endpoint_name: str) -> None:
        self.last_sync_error = f"{endpoint_name} returned status {status_code}"
        if status_code in (401, 403):
            self.last_sync_auth_error = True

    def _maybe_flag_group_reference_inaccessible(self, status_code: int) -> None:
        """
        Group-scoped reference fetches (surgeons, hayapp users, suture sheets).

        404/422 always imply a bad or unknown group/org → reprovision path.

        500/502/503 are ambiguous (wrong env like CmOrg.DoesNotExist vs transient outage). They
        set last_sync_group_access_denied only when strict_group_reference_denial_for_5xx is
        True (broker startup migration). Manual sync_group_data keeps that False so a random
        500 does not mark the device unprovisioned.
        """
        if status_code in (401, 403):
            return
        if status_code in (404, 422):
            self.last_sync_group_access_denied = True
            return
        if status_code in (500, 502, 503) and self.strict_group_reference_denial_for_5xx:
            self.last_sync_group_access_denied = True

    def _record_sync_exception(self, endpoint_name: str, error: Exception) -> None:
        self.last_sync_error = f"{endpoint_name} request failed: {type(error).__name__}"

    async def _check_connection(self):
        """
        Updates self.is_online to True if the middleware health endpoint returns success
        self.is_online will be set to False in all other cases
        """
        self._refresh_auth_headers()
        try:
            response = await self.client.get("health", timeout=1.0)
            self.is_online = response.is_success
        except httpx.RequestError:
            self.is_online = False

    @parlay_command()
    def version(self):
        return self.__version__

    async def fetch_hayapp_users(self) -> List[dict]:
        """
        Returns hayapp users from the cloud or empty list if any error occurs
        """
        self._refresh_auth_headers()
        try:
            response = await self.client.get(
                ENDPOINTS.HAYAPP_USERS, params={"group_id": config.cloud.group_id}
            )
            if response.is_success:
                return response.json()
            else:
                # For debugging purposes, log the status code
                logger.error(f"Failed to fetch hayapp users, status code: {response.status_code}")
                self._record_sync_http_failure(response.status_code, "hayapp users")
                self._maybe_flag_group_reference_inaccessible(response.status_code)
        except Exception as e:
            logger.error(f"Error fetching hayapp users: {e}")
            self._record_sync_exception("hayapp users", e)
        # Whatever error occurs, return empty list
        return []

    async def fetch_surgeons(self) -> List[dict]:
        """
        Returns surgeons from the cloud or empty list if any error occurs
        """
        self._refresh_auth_headers()
        try:
            response = await self.client.get(
                ENDPOINTS.SURGEONS, params={"group_id": config.cloud.group_id}
            )
            if response.is_success:
                return response.json()
            else:
                # For debugging purposes, log the status code
                logger.error(
                    f"Failed to fetch hayapp surgeons, status code: {response.status_code}"
                )
                self._record_sync_http_failure(response.status_code, "surgeons")
                self._maybe_flag_group_reference_inaccessible(response.status_code)
        except Exception as e:
            logger.error(f"Error fetching hayapp surgeons: {e}")
            self._record_sync_exception("surgeons", e)
        # Whatever error occurs, return empty list
        return []

    async def fetch_case_types(self) -> List[dict]:
        """
        Returns case types from the cloud or empty list if any error occurs
        """
        self._refresh_auth_headers()
        try:
            response = await self.client.get(ENDPOINTS.CASE_TYPES)
            if response.is_success:
                return response.json()
            else:
                # For debugging purposes, log the status code
                logger.error(f"Failed to fetch case types, status code: {response.status_code}")
                self._record_sync_http_failure(response.status_code, "case types")
        except Exception as e:
            logger.error(f"Error fetching case types: {e}")
            self._record_sync_exception("case types", e)
        # Whatever error occurs, return empty list
        return []

    async def fetch_suture_sheets(self) -> List[dict]:
        """
        Returns suture sheets from the cloud or empty list if any error occurs
        """
        self._refresh_auth_headers()
        try:
            response = await self.client.get(
                ENDPOINTS.SUTURE_SHEETS, params={"group_id": config.cloud.group_id}
            )
            if response.is_success:
                return response.json()
            else:
                # For debugging purposes, log the status code
                logger.error(f"Failed to fetch suture sheets, status code: {response.status_code}")
                self._record_sync_http_failure(response.status_code, "suture sheets")
                self._maybe_flag_group_reference_inaccessible(response.status_code)
        except Exception as e:
            logger.error(f"Error fetching suture sheets: {e}")
            self._record_sync_exception("suture sheets", e)
        # Whatever error occurs, return empty list
        return []

    async def update_needle_db(self, progress_cb: Callable[[dict], None] | None = None) -> bool:
        """
        1. Get needle database file data from the cloud (URL + md5 checksum)
        2. Compare cloud md5 with md5 of local database
        3. Download and replace if no md5 match
        """
        self._refresh_auth_headers()
        try:
            response = await self.client.get(ENDPOINTS.NEEDLES_DATABASE)
            if response.is_success:
                md5_local = calculate_md5(self.suture_db_file)
                response_data = response.json()
                if response_data["etag"] == md5_local:
                    logger.info("No update needed for Needle Database")
                    return False
                else:
                    success = await download_to_file(response_data["url"], self.suture_db_file)
                    if success:
                        logger.info("Needle Database updated successfully")
                        if progress_cb:
                            progress_cb(
                                {
                                    "stage": "needle_db_download_complete",
                                    "message": "Needle database download complete",
                                }
                            )
                    return success
            else:
                # For debugging purposes, log the status code
                logger.error(f"Failed to fetch Needle DB, status code: {response.status_code}")
                self._record_sync_http_failure(response.status_code, "needle database")
        except Exception as e:
            logger.error(f"Error fetching Needle DB: {e}")
            self._record_sync_exception("needle database", e)

    async def update_suture_pack_images(
        self, progress_cb: Callable[[dict], None] | None = None
    ) -> bool:
        """
        1. Get suture wrapper images file data from the cloud (URL + md5 checksum)
        2. Compare cloud md5 with md5 of local zipfile
        3. Download and replace if no md5 match
        """
        self._refresh_auth_headers()
        try:
            response = await self.client.get(ENDPOINTS.NEEDLES_IMAGES)
            zip_local = self.images_zip_file
            unzip_path = self.images_path
            if response.is_success:
                md5_local = calculate_md5(zip_local)
                response_data = response.json()
                if response_data["etag"] == md5_local:
                    logger.info("No update needed for Suture Wrapper Images")
                    return False
                else:
                    # Create suture_wrapper_images directory if it doesn't exist
                    unzip_path.mkdir(parents=True, exist_ok=True)
                    total_bytes_holder: dict[str, int | None] = {"total": None}

                    def _download_progress(value: int | None) -> None:
                        if value is None:
                            return
                        if total_bytes_holder["total"] is None:
                            total_bytes_holder["total"] = value
                            if progress_cb:
                                progress_cb(
                                    {
                                        "stage": "image_download",
                                        "message": "Downloading suture wrapper images...",
                                        "current_bytes": 0,
                                        "total_bytes": value,
                                    }
                                )
                            return
                        if progress_cb:
                            progress_cb(
                                {
                                    "stage": "image_download",
                                    "message": "Downloading suture wrapper images...",
                                    "current_bytes": value,
                                    "total_bytes": total_bytes_holder["total"],
                                }
                            )

                    success = await download_to_file(
                        response_data["url"], zip_local, progress_cb=_download_progress
                    )
                    if success:
                        if progress_cb:
                            progress_cb(
                                {
                                    "stage": "image_extract",
                                    "message": "Extracting suture wrapper images...",
                                }
                            )
                        # Unzip the file
                        with zipfile.ZipFile(zip_local, "r") as zip_ref:
                            zip_ref.extractall(unzip_path)
                        logger.info("Suture Wrapper Images updated successfully")
                        if progress_cb:
                            progress_cb(
                                {
                                    "stage": "image_download_complete",
                                    "message": "Suture wrapper images updated successfully",
                                }
                            )
                    return success
            else:
                # For debugging purposes, log the status code
                logger.error(
                    f"Failed to fetch Suture Wrapper Images, status code: {response.status_code}"
                )
                self._record_sync_http_failure(response.status_code, "suture wrapper images")
        except Exception as e:
            logger.error(f"Error fetching Suture Wrapper Images: {e}")
            self._record_sync_exception("suture wrapper images", e)

    async def upload_log_file(self, path_to_logfile: Path, timestamp, case_id: str | None = None):
        """
        Creates and upload item for the log file and sends it to self._upload
        """
        file_upload_data = FileUploadData(
            filepath=path_to_logfile,
            content_type="text/plain",
            extra_form_fields={"timestamp": timestamp, "case_id": case_id},
            delete_after_upload=True,
        )

        item = UploadItem(
            method="PUT",
            endpoint=ENDPOINTS.LOG_FILES,
            query_params={"group_id": config.cloud.group_id},
            data=file_upload_data,
        )
        await self._upload(item)

    async def upload_case(self, case: Case):
        """
        Creates and upload item for the case and sends it to self._upload
        """
        upload_data = JsonUploadData(body=case.to_dict())
        item = UploadItem(
            method="POST",
            endpoint=ENDPOINTS.CASE_REPORTS,
            query_params={"group_id": config.cloud.group_id},
            data=upload_data,
        )
        await self._upload(item)

    async def _upload(self, item: UploadItem):
        """
        Item (either json or file) will be uploaded to the cloud.
        For any failures, the item will be stored in a local database (updated if present).
        For success, the item will be removed from the local database if present.
        """

        data = item.data
        try:

            if isinstance(data, FileUploadData):
                with open(data.filepath, "rb") as f:
                    files = {  # (filename, file object, MIME type)
                        "file": (data.filepath.name, f, data.content_type),
                    }
                    response = await self.client.request(
                        method=item.method,
                        url=item.endpoint,
                        params=item.query_params,
                        files=files,
                        data=data.extra_form_fields,
                    )
                    response.raise_for_status()
                if data.delete_after_upload:
                    try:
                        os.remove(data.filepath)
                    except PermissionError:
                        logger.error(f"Permission denied: unable to delete {data.filepath}.")
                    except OSError as exc:
                        logger.error(f"OSError: unable to delete {data.filepath} : {exc}")

            elif isinstance(data, JsonUploadData):
                response = await self.client.request(
                    method=item.method, url=item.endpoint, params=item.query_params, json=data.body
                )
                response.raise_for_status()

        except httpx.HTTPStatusError as exc:
            item.last_error = f"Error response {exc.response.status_code} on {exc.request.url}."
            logger.error(item.last_error)

        except httpx.RequestError as exc:
            item.last_error = f"An error occurred on {exc.request.url}: {exc}"
            logger.error(item.last_error)

        except FileNotFoundError:
            item.last_error = None  # So item will be removed from the pending list

        else:  # No error occurred
            item.last_error = None

        finally:
            await self._update_upload_db(item)

    async def _update_upload_db(self, item: UploadItem):
        """
        Updates the database of pending uploads with the item
        1. Removal if there was no error
        2. Replace or insert if there was an upload error
        """
        if item.last_error is None:  # Indicates successful upload
            self.pending_uploads.remove(where("id") == str(item.id))  # Does nothing if Id not found
        else:
            self.pending_uploads.upsert(item.model_dump(mode="json"), where("id") == str(item.id))

    async def upload_pending_items(self):
        """
        Gets all items from the pending database
        Starts uploading 1 by 1 until, from oldest to newest
        """
        await self._check_connection()
        if (
            self.is_online and not self.currently_uploading_pending
        ):  # Don't start if already running
            self.currently_uploading_pending = True
            # Get all items from the upload database
            upload_items = [UploadItem(**i) for i in self.pending_uploads.all()]
            upload_items = sorted(upload_items, key=lambda i: i.created_date)  # Oldest first
            for item in upload_items:
                await self._upload(item)  # Upload
            self.currently_uploading_pending = False

    async def close(self):
        await self.client.aclose()
