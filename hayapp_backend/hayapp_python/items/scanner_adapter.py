# scanner_adapter.py

import json
import logging
import socket
from typing import Optional

from parlay import ParlayCommandItem, local_item, parlay_command
from pydantic import BaseModel, Field, ValidationError

# Import the definition file and the protocol helper
from hayapp_python.common.defs import HayScanner_item as item
from hayapp_python.common.protocol_helper import ProtocolHelper, ScanMode

# Configure logging
logger = logging.getLogger(__name__)

# --- Pydantic Models for Command Parameters ---


class ScannerParams(BaseModel):
    mode: ScanMode
    timeout: int


class CameraParams(BaseModel):
    timeout: int


class SyncStateParams(BaseModel):
    """
    This model represents the 'fallback_counts' dictionary expected by the
    protocol_helper's synchronize_state method. It includes all known
    countable items in the HayStack system state.
    """

    # Relief Counts
    scr_relief_count: int = Field(..., description="Scrub relief count")
    scr_relief_timestamp: str = Field(..., description="Timestamp of last scrub relief")
    cir_relief_count: int = Field(..., description="Circulator relief count")
    cir_relief_timestamp: str = Field(..., description="Timestamp of last circulator relief")

    # Anomaly Counts
    contaminated_count: int = Field(..., description="Number of contaminated needles")
    broken_count: int = Field(..., description="Number of broken needles")
    incompatible_count: int = Field(..., description="Number of incompatible needles")
    misplaced_count: int = Field(..., description="Number of misplaced needles")

    # Inventory Counts
    starting_count: int = Field(..., description="Initial number of needles at surgery start")
    added_during_surgery_count: int = Field(..., description="Count of additional needles added")
    remaining_count: int = Field(
        ..., description="Remaining needles (starting + added - confirmed)"
    )
    confirmed_count: int = Field(..., description="Needles already confirmed in HayStack")

    # Verification/Adjudication Counts
    cir_verification_count: int = Field(
        ..., description="Count of items needing circulator verification"
    )
    cir_adjudication_count: int = Field(
        ..., description="Count of items under circulator adjudication"
    )
    cir_readjudication_count: int = Field(
        ..., description="Count of items requiring re-adjudication"
    )
    scr_validation_count: int = Field(..., description="Count of scrub validations")


@local_item()
class HayScanner(ParlayCommandItem):
    """
    Implements the HayScanner Parlay interface.
    This class acts as the bridge between the high-level backend services (calling
    Parlay commands) and the low-level TCP protocol managed by ProtocolHelper.
    """

    __version__: str = "1.3.0"  # Version bump for new sync model

    def __init__(self, item_id=item.id, name=item.name):
        ParlayCommandItem.__init__(self, item_id=item_id, name=item.name)
        logger.info("HayScanner adapter initialized.")

        self.protocol_helper = ProtocolHelper()
        self.tcp_connection: Optional[socket.socket] = None
        self.is_authenticated: bool = False

    def _send_command(self, command_bytes: bytes, command_name: str):
        """
        Private helper to send pre-formatted command bytes over the active TCP connection.
        """
        if not self.tcp_connection:
            logger.error(f"Cannot send command '{command_name}': No active TCP connection.")
            return

        try:
            logger.info(f"Sending command '{command_name}' to Android device.")
            self.tcp_connection.sendall(command_bytes)
        except Exception as e:
            logger.error(f"Failed to send command '{command_name}' over TCP: {e}", exc_info=True)

    # --- Parlay Command Implementations ---
    @parlay_command()
    def open_data_matrix_scanner(self, timeout=50000, mode="single"):
        """Commands the Android app to open the Data Matrix scanner screen."""
        print("open_data_matrix_scanner called with timeout:", timeout, "mode:", mode)
        try:
            validated_params = ScannerParams(mode=mode, timeout=timeout)
        except ValidationError as e:
            logger.error(f"Invalid parameters for open data matrix: {e}")
            return

        command_bytes = self.protocol_helper.open_scanning_screen(
            mode=validated_params.mode, timeout=validated_params.timeout
        )
        self._send_command(command_bytes, "OPEN_SCANNING_SCREEN")

    @parlay_command()
    def open_itrace_scanner(self, timeout=50000, mode="continuous"):
        """Commands the Android app to open the iTrace (1D) scanner screen."""
        try:
            validated_params = ScannerParams(mode=mode, timeout=timeout)
        except ValidationError as e:
            logger.error(f"Invalid parameters for open iTrace: {e}")
            return

        command_bytes = self.protocol_helper.open_itrace_scanning_screen(
            mode=validated_params.mode, timeout=validated_params.timeout
        )
        self._send_command(command_bytes, "OPEN_ITRACE_SCANNING_SCREEN")

    @parlay_command()
    def open_camera(self, timeout=50000):
        """Commands the Android app to open the camera screen."""
        try:
            validated_params = CameraParams(timeout=timeout)
        except ValidationError as e:
            logger.error(f"Invalid parameters for open camera: {e}")
            return

        command_bytes = self.protocol_helper.open_camera_screen(
            timeout=validated_params.timeout,
        )
        self._send_command(command_bytes, "OPEN_CAMERA_SCREEN")

    @parlay_command()
    def close_active_screen(self):
        """Commands the Android app to close the currently active screen."""
        command_bytes = self.protocol_helper.close_active_screen()
        self._send_command(command_bytes, "CLOSE_ACTIVE_SCREEN")

    @parlay_command()
    def synchronize_state(self, params: str):
        """Sends synchronization data to the Android app."""
        try:
            data = json.loads(params)
            validated_params = SyncStateParams(**data)
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Invalid parameters for synchronize: {e}")
            return

        command_bytes = self.protocol_helper.synchronize_state(
            fallback_counts=validated_params.dict()
        )
        self._send_command(command_bytes, "SYNCHRONIZE_STATE")

    @parlay_command()
    def request_system_info(self):
        """Requests the Android app to send back its system and version information."""
        command_bytes = self.protocol_helper.request_system_info()
        self._send_command(command_bytes, "REQUEST_SYSTEM_INFO")

    @parlay_command()
    def request_disaster_recovery(self):
        """Requests the Android app to send back its disaster recovery info from sync command."""
        command_bytes = self.protocol_helper.request_disaster_recovery()
        self._send_command(command_bytes, "REQUEST_DISASTER_RECOVERY")

    @parlay_command()
    def install_update(self):
        """Tells the Android App to install the available update"""
        command_bytes = self.protocol_helper.install_update()
        self._send_command(command_bytes, "INSTALL_UPDATE")
