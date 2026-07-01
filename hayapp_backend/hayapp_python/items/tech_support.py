# -*- coding: utf-8 -*-
import asyncio
import json
import logging

import httpx
import keyring
from parlay import ParlayCommandItem, ParlayProperty, local_item, parlay_command
from pydantic import BaseModel

from hayapp_python.common.config_manager import (
    config,
    store_hayscan_auth_key_in_keyring,
)
from hayapp_python.common.defs import TechSupport_item as item
from hayapp_python.items.all_in_one import AllInOneAdapter
from hayapp_python.items.case import CaseManager
from hayapp_python.items.data_store import DataStore

logger = logging.getLogger("hayapp")


# Pydantic models for response structures
class SuccessResponse(BaseModel):
    success: bool = True


class ErrorResponse(BaseModel):
    success: bool = False
    error: str


class LoginSuccessResponse(SuccessResponse):
    access_token: str


class ProvisionSuccessResponse(SuccessResponse):
    api_key: str


class SerialNumberResponse(BaseModel):
    serial_number: str


class IsProvisionedResponse(BaseModel):
    is_provisioned: bool
    has_api_key: bool
    has_group_id: bool
    group_data_access_denied: bool = False


@local_item()
class TechSupport(ParlayCommandItem):
    """
    Tech Support item for handling tech support login and device provisioning
    """

    __version__: str = "0.0.1"
    sync_progress = ParlayProperty(
        default='{"active": false, "stage": "", "message": "", "percent": null}',
        val_type=str,
        read_only=True,
    )

    def __init__(
        self,
        item_id=item.id,
        item_name=item.name,
        all_in_one: AllInOneAdapter = None,
        data_store: DataStore = None,
        case_manager: CaseManager = None,
    ):
        ParlayCommandItem.__init__(self, item_id=item_id, name=item_name)
        self.access_token = None
        self.base_url = config.cloud.middleware_url
        self.all_in_one = all_in_one
        self._data_store = data_store
        self._case_manager = case_manager

    def _set_sync_progress(
        self,
        *,
        active: bool,
        stage: str = "",
        message: str = "",
        percent: int | None = None,
    ) -> None:
        self.sync_progress = json.dumps(
            {
                "active": active,
                "stage": stage,
                "message": message,
                "percent": percent,
            }
        )

    @parlay_command()
    def version(self):
        return self.__version__

    def _extract_error_message(self, response: httpx.Response) -> str:
        """
        Extract a clean error message from an HTTP error response.
        Tries multiple common error response formats.

        :param response: The httpx Response object
        :return: A clean error message string
        """
        error_message = None
        try:
            error_data = response.json()

            if isinstance(error_data, dict):
                # Format: {"error": {"message": "..."}}
                if "error" in error_data:
                    error_obj = error_data["error"]
                    if isinstance(error_obj, dict) and "message" in error_obj:
                        error_message = error_obj["message"]
                    elif isinstance(error_obj, str):
                        error_message = error_obj
                # Format: {"message": "..."}
                elif "message" in error_data:
                    error_message = error_data["message"]
                # Format: {"detail": "..."}
                elif "detail" in error_data:
                    error_message = error_data["detail"]
        except Exception as e:
            logger.debug(f"Error response is not JSON: {e}")

        # Fallback to status code description if no message found
        if not error_message:
            status_descriptions = {
                401: "Unauthorized",
                403: "Forbidden",
                404: "Not Found",
                500: "Internal Server Error",
            }
            error_message = status_descriptions.get(response.status_code, "Request failed")

        return error_message

    def _handle_http_error(self, e: httpx.HTTPStatusError, operation: str) -> dict:
        """
        Handle HTTP status errors consistently across operations.

        :param e: The HTTPStatusError exception
        :param operation: Description of the operation (e.g., "login", "provision")
        :return: Error response dictionary
        """
        error_msg = f"{operation} failed with status {e.response.status_code}"
        logger.error(error_msg)
        logger.error(f"Response URL: {e.request.url}")

        error_message = self._extract_error_message(e.response)
        result = ErrorResponse(error=f"{e.response.status_code}: {error_message}")
        return result.model_dump()

    def _handle_request_error(self, e: httpx.RequestError, operation: str) -> dict:
        """
        Handle HTTP request errors consistently across operations.

        :param e: The RequestError exception
        :param operation: Description of the operation (e.g., "login", "provision")
        :return: Error response dictionary
        """
        logger.error(f"{operation} request error: {e}")
        logger.error(f"Request URL: {getattr(e.request, 'url', 'N/A')}")
        logger.error(f"Error type: {type(e).__name__}")
        result = ErrorResponse(error=f"Connection error: {str(e)}")
        return result.model_dump()

    def _handle_unexpected_error(self, e: Exception, operation: str) -> dict:
        """
        Handle unexpected errors consistently across operations.

        :param e: The exception
        :param operation: Description of the operation (e.g., "login", "provision")
        :return: Error response dictionary
        """
        logger.error(f"{operation} unexpected error: {e}", exc_info=True)
        logger.error(f"Error type: {type(e).__name__}")
        result = ErrorResponse(error=f"Unexpected error: {str(e)}")
        return result.model_dump()

    @parlay_command()
    def get_device_serial_number(self) -> dict:
        """
        Get the device serial number from BIOS.
        :return: Dict with serial_number string
        """
        logger.info("get_device_serial_number command received")
        serial_number = self.all_in_one.serial_number
        result = SerialNumberResponse(serial_number=serial_number)
        logger.info(f"get_device_serial_number returning: {result.model_dump()}")
        return result.model_dump()

    @parlay_command()
    def sync_group_data(self) -> dict:
        """
        Force cloud sync of group data after provisioning.

        Uses the broker's shared DataStore when available so the same TinyDB handles and
        migration path as startup (API key + group id) are used; then refreshes CaseManager's
        cached staff lists.
        """
        logger.info("sync_group_data command received")
        self._set_sync_progress(active=True, stage="sync_start", message="Starting cloud sync...")
        api_key = config.cloud.api_key
        group_id = config.cloud.group_id
        if not api_key or not group_id:
            self._set_sync_progress(
                active=False,
                stage="error",
                message="Device is not provisioned. Missing API key or group ID.",
            )
            return {
                "success": False,
                "error": "Device is not provisioned. Missing API key or group ID.",
            }
        data_store = (
            self._data_store if self._data_store is not None else DataStore(auto_migrate=False)
        )

        def _progress_cb(update: dict):
            stage = str(update.get("stage", "sync"))
            message = str(update.get("message", "Sync in progress..."))
            percent = None
            current_bytes = update.get("current_bytes")
            total_bytes = update.get("total_bytes")
            if isinstance(current_bytes, int) and isinstance(total_bytes, int) and total_bytes > 0:
                percent = max(0, min(100, int((current_bytes * 100) / total_bytes)))
            self._set_sync_progress(active=True, stage=stage, message=message, percent=percent)

        try:
            result = asyncio.run(data_store.sync_group_data(progress_cb=_progress_cb))
            if result.get("success") and self._case_manager is not None:
                self._case_manager.reload_reference_staff_from_store()
                self._set_sync_progress(
                    active=False, stage="done", message="Cloud sync completed", percent=100
                )
            elif not result.get("success"):
                self._set_sync_progress(
                    active=False,
                    stage="error",
                    message=result.get("error", "Cloud sync failed"),
                )
            return result
        except Exception as e:
            self._set_sync_progress(active=False, stage="error", message=str(e))
            raise

    @parlay_command()
    def is_provisioned(self) -> dict:
        """
        Check if the device has been provisioned (API key exists and is not placeholder).
        :return: Dict with is_provisioned boolean
        """
        logger.info("is_provisioned command received")

        # Use config.cloud to read API key and group ID
        api_key = config.cloud.api_key
        group_id = config.cloud.group_id

        # Check if API key exists and is not a placeholder
        has_api_key = api_key is not None
        has_group_id = group_id is not None

        group_denied = bool(
            self._data_store is not None
            and getattr(self._data_store, "group_data_access_denied", False)
        )
        is_provisioned = bool(has_api_key and has_group_id and not group_denied)

        logger.info(
            f"Provisioning check - has_api_key: {has_api_key}, "
            f"has_group_id: {has_group_id}, "
            f"group_data_access_denied: {group_denied}, "
            f"api_key length: {len(api_key) if api_key else 0}"
        )

        result = IsProvisionedResponse(
            is_provisioned=is_provisioned,
            has_api_key=has_api_key,
            has_group_id=has_group_id,
            group_data_access_denied=group_denied,
        )
        logger.info(f"is_provisioned returning: {result.model_dump()}")
        return result.model_dump()

    @parlay_command()
    def tech_support_login(self, username: str, password: str) -> dict:
        """
        Login to middleware with tech support credentials
        :param username: Tech support username
        :param password: Tech support password
        :return: Dict with success, access_token, and error fields
        """
        login_url = f"{self.base_url}/v2/auth/token"
        logger.info(f"Tech support login attempt - URL: {login_url}")

        try:
            # Make login request to middleware using synchronous httpx
            # OAuth2 token endpoints typically expect form-encoded data, not JSON
            with httpx.Client(base_url=self.base_url, timeout=30.0) as client:
                payload = {
                    "client_id": config.cloud.tech_support_oauth_client_id,
                    "password": password,
                    "grant_type": "password",
                    "username": username,
                }

                # OAuth2 token endpoints typically expect form-encoded data
                response = client.post(
                    "/v2/auth/token",
                    data=payload,
                )

                logger.info(f"Login response status: {response.status_code}")

                response.raise_for_status()
                data = response.json()

            if "access_token" in data:
                self.access_token = data["access_token"]
                logger.info("Tech support login successful")
                result = LoginSuccessResponse(access_token=self.access_token)
                return result.model_dump()
            else:
                logger.error("Login response missing access_token.")
                result = ErrorResponse(error="Invalid response from middleware")
                return result.model_dump()

        except httpx.HTTPStatusError as e:
            return self._handle_http_error(e, "Tech support login")
        except httpx.RequestError as e:
            return self._handle_request_error(e, "Tech support login")
        except Exception as e:
            return self._handle_unexpected_error(e, "Tech support login")

    @parlay_command()
    def provision_device(self, serial_number: str) -> dict:
        """
        Provision a device with the middleware
        :param serial_number: Device serial number
        :return: Dict with success, api_token, and error fields
        """
        if not self.access_token:
            logger.warning("Provision attempt without access token")
            result = ErrorResponse(error="Not authenticated. Please login first.")
            return result.model_dump()

        provision_url = f"{self.base_url}/devices/provision"
        logger.info(f"Provisioning device - URL: {provision_url}, Serial: {serial_number}")

        try:
            # Make provision request to middleware using synchronous httpx
            with httpx.Client(base_url=self.base_url, timeout=30.0) as client:
                response = client.post(
                    provision_url,
                    json={"serial_number": serial_number},
                    headers={"Authorization": f"Bearer {self.access_token}"},
                )

                logger.info(f"Provision response status: {response.status_code}")

                response.raise_for_status()
                data = response.json()

            group_id = data.get("group_id")
            if not group_id:
                logger.error("Provision response missing group_id.")
                result = ErrorResponse(error="Invalid response from middleware: missing group_id")
                return result.model_dump()

            # New devices get api_key; re-provision after a move may omit it (same cloud device).
            api_key = data.get("api_key")
            if api_key:
                keyring.set_password("hayapp", "api_key", api_key)
                logger.info(f"API token stored in keyring (length: {len(api_key)})")
            else:
                logger.info(
                    "Provision response had no api_key (e.g. re-provision after move); "
                    "keeping existing keyring API key unchanged."
                )

            keyring.set_password("hayapp", "group_id", group_id)
            logger.info("Group ID stored in keyring.")

            hayscan_auth_key = data.get("hayscan_auth_key")
            if hayscan_auth_key:
                store_hayscan_auth_key_in_keyring(hayscan_auth_key)
                logger.info(f"HayScan auth key stored in keyring (length: {len(hayscan_auth_key)})")

            effective_api_key = api_key or keyring.get_password("hayapp", "api_key") or ""
            if not effective_api_key:
                logger.warning(
                    "No API key in provision response and none in keyring; "
                    "run a full provision or configure credentials before sync."
                )

            logger.info(f"Device {serial_number} provisioned successfully (group updated).")
            result = ProvisionSuccessResponse(api_key=effective_api_key)
            return result.model_dump()

        except httpx.HTTPStatusError as e:
            return self._handle_http_error(e, "Device provisioning")
        except httpx.RequestError as e:
            return self._handle_request_error(e, "Device provisioning")
        except Exception as e:
            return self._handle_unexpected_error(e, "Device provisioning")
