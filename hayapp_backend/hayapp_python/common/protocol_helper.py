# protocol_helper.py

import json
from datetime import datetime, timezone
from enum import Enum


class StrEnum(str, Enum):
    pass


class ScanMode(StrEnum):
    CONTINUOUS = "continuous"
    SINGLE = "single"


class CommandName(StrEnum):
    """The string representation of a server-to-client command."""

    SYNCHRONIZE_STATE = "SYNCHRONIZE_STATE"
    OPEN_SCANNING_SCREEN = "OPEN_SCANNING_SCREEN"
    CLOSE_ACTIVE_SCREEN = "CLOSE_ACTIVE_SCREEN"
    OPEN_ITRACE_SCANNING_SCREEN = "OPEN_ITRACE_SCANNING_SCREEN"
    OPEN_CAMERA_SCREEN = "OPEN_CAMERA_SCREEN"
    REQUEST_SYSTEM_INFO = "REQUEST_SYSTEM_INFO"
    DISASTER_RECOVERY = "DISASTER_RECOVERY"
    INSTALL_UPDATE = "INSTALL_UPDATE"
    AUTHENTICATE_HAYSCAN = "AUTHENTICATE_HAYSCAN"


class CommandId(int, Enum):
    """The numeric ID of a server-to-client command."""

    SYNCHRONIZE_STATE = 101
    OPEN_SCANNING_SCREEN = 102
    CLOSE_ACTIVE_SCREEN = 103
    OPEN_ITRACE_SCANNING_SCREEN = 104
    OPEN_CAMERA_SCREEN = 105
    REQUEST_SYSTEM_INFO = 106
    DISASTER_RECOVERY = 107
    INSTALL_UPDATE = 108
    AUTHENTICATE_HAYSCAN = 109


class ProtocolHelper:
    """
    A helper class to construct and validate protocol messages based on the
    HayScan Communication Protocol v1.1.
    """

    PROTOCOL_VERSION = "1.1"

    def _get_iso_timestamp(self) -> str:
        """Returns the current time in ISO 8601 format with Z-suffix."""
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    def _create_command(
        self, command_id: CommandId, payload: dict = None, fallback_counts: dict = None
    ) -> dict:
        """Creates the base dictionary for any message."""
        command_name = CommandName(command_id.name)

        if payload is None:
            payload = {}

        message = {
            "protocol_version": self.PROTOCOL_VERSION,
            "status_code": command_id,
            "command": command_name,
            "payload": payload,
            "timestamp": self._get_iso_timestamp(),
        }

        if fallback_counts is not None:
            message["fallback_counts"] = fallback_counts

        return message

    def to_json(self, message: dict) -> bytes:
        """Converts a message dictionary to a JSON byte string for sending over the socket."""
        return (json.dumps(message) + "\n").encode("utf-8")

    # --- Command Creation Methods (Server -> Zebra) ---

    def synchronize_state(self, fallback_counts: dict) -> bytes:
        """Creates a 101 SYNCHRONIZE_STATE command."""
        command = self._create_command(
            command_id=CommandId.SYNCHRONIZE_STATE, fallback_counts=fallback_counts
        )
        return self.to_json(command)

    def open_scanning_screen(self, mode: ScanMode, timeout: int) -> bytes:
        """Creates a 102 OPEN_SCANNING_SCREEN command."""
        payload = {"mode": mode, "timeout": timeout}
        command = self._create_command(command_id=CommandId.OPEN_SCANNING_SCREEN, payload=payload)
        return self.to_json(command)

    def close_active_screen(self) -> bytes:
        """Creates a 103 CLOSE_ACTIVE_SCREEN command."""
        command = self._create_command(
            command_id=CommandId.CLOSE_ACTIVE_SCREEN,
        )
        return self.to_json(command)

    def open_itrace_scanning_screen(self, mode: ScanMode, timeout: int) -> bytes:
        """Creates a 104 OPEN_ITRACE_SCANNING_SCREEN command."""
        payload = {"mode": mode, "timeout": timeout}
        command = self._create_command(
            command_id=CommandId.OPEN_ITRACE_SCANNING_SCREEN, payload=payload
        )
        return self.to_json(command)

    def open_camera_screen(self, timeout: int) -> bytes:
        """Creates a 105 OPEN_CAMERA_SCREEN command."""
        payload = {"timeout": timeout}

        command = self._create_command(command_id=CommandId.OPEN_CAMERA_SCREEN, payload=payload)
        return self.to_json(command)

    def request_system_info(self) -> bytes:
        """Creates a 106 REQUEST_SYSTEM_INFO command."""
        command = self._create_command(
            command_id=CommandId.REQUEST_SYSTEM_INFO,
        )
        return self.to_json(command)

    def request_disaster_recovery(self) -> bytes:
        """Creates a 107 REQUEST_DISASTER_RECOVERY command."""
        command = self._create_command(
            command_id=CommandId.DISASTER_RECOVERY,
        )
        return self.to_json(command)

    def install_update(self) -> bytes:
        """Creates a 108 INSTALL_UPDATE command."""
        command = self._create_command(
            command_id=CommandId.INSTALL_UPDATE,
        )
        return self.to_json(command)

    def authenticate_hayscan(self, challenge: str) -> bytes:
        """Creates a 109 AUTHENTICATE_HAYSCAN command."""

        payload = {"challenge": challenge}

        command = self._create_command(command_id=CommandId.AUTHENTICATE_HAYSCAN, payload=payload)
        return self.to_json(command)
