"""
Firmware updater core orchestration logic.

Coordinates the entire firmware upgrade process including bootloader entry,
flashing, and reconnection.
"""

import logging
import time
from pathlib import Path
from typing import Callable, Optional

from hayapp_python.common.config_manager import config
from hayapp_python.items.haystack.base_transport import BaseTransport
from hayapp_python.items.haystack.firmware_progress import (
    FirmwareStage,
    FirmwareUpgradeProgress,
    ProgressTracker,
)
from hayapp_python.items.haystack.stm32_flasher import STM32Flasher, STM32FlasherError

MAX_RETRIES = config.haystack.firmware_max_retries
RECONNECT_TIMEOUT = config.haystack.firmware_reconnect_timeout


class FirmwareUpdateError(Exception):
    """Error during firmware update operation."""

    pass


class FirmwareUpdater:
    """Core firmware update orchestration class."""

    def __init__(
        self,
        transport: BaseTransport,
        progress_callback: Optional[Callable[[FirmwareUpgradeProgress], None]] = None,
    ):
        """
        Initialize firmware updater.

        Args:
            transport: Transport layer instance (UsbTransport or SimTransport)
            progress_callback: Optional callback for progress updates
        """
        self.logger = logging.getLogger(__name__)
        self.transport = transport
        self.progress_tracker = ProgressTracker(progress_callback)
        self.flasher: Optional[STM32Flasher] = None
        self.original_port: Optional[str] = None
        self._flash_interrupted = False
        self._last_flash_error: Optional[str] = None

    def upgrade_firmware(
        self,
        firmware_path: str,
        start_address: str = "0x08005000",
        go_address: str = "0x08005000",
        max_retries: Optional[int] = None,
    ) -> bool:
        """
        Perform firmware upgrade.

        Args:
            firmware_path: Path to .bin firmware file
            start_address: Flash start address
            go_address: Go/jump address after flashing
            max_retries: Maximum number of retry attempts (defaults to config value)

        Returns:
            True if upgrade successful, False otherwise

        Raises:
            FirmwareUpdateError: If upgrade fails after retries
        """
        # Use provided max_retries or fall back to config value
        retries = max_retries if max_retries is not None else MAX_RETRIES

        # Validate firmware file
        fw_path = Path(firmware_path)
        if not fw_path.exists():
            error_msg = f"Firmware file not found: {firmware_path}"
            self.logger.error(error_msg)
            self.progress_tracker.update(FirmwareStage.FAILED, error_msg)
            raise FirmwareUpdateError(error_msg)

        if not fw_path.suffix == ".bin":
            error_msg = f"Firmware file must be a .bin file: {firmware_path}"
            self.logger.error(error_msg)
            self.progress_tracker.update(FirmwareStage.FAILED, error_msg)
            raise FirmwareUpdateError(error_msg)

        # Attempt upgrade with retries
        for attempt in range(retries + 1):
            try:
                if attempt > 0:
                    self.logger.info(f"Retry attempt {attempt}/{retries}")
                    self.progress_tracker.update(
                        FirmwareStage.ENTERING_BOOTLOADER,
                        f"Retry attempt {attempt}/{retries}",
                    )
                    time.sleep(2)  # Brief delay before retry

                success = self._perform_upgrade(
                    firmware_path=firmware_path,
                    start_address=start_address,
                    go_address=go_address,
                )

                if success:
                    self.progress_tracker.update(
                        FirmwareStage.COMPLETE,
                        "Firmware upgrade completed successfully",
                    )
                    return True

            except Exception as e:
                self.logger.error(f"Firmware upgrade attempt {attempt + 1} failed: {e}")
                if attempt < retries:
                    continue
                else:
                    # Final failure - if a mid-flash interruption was detected on a
                    # prior attempt, surface that as the root cause rather than the
                    # subsequent bootloader entry failure that follows it.
                    root_cause = self._last_flash_error if self._flash_interrupted else str(e)
                    error_msg = (
                        f"Firmware upgrade failed after {retries + 1} attempts: {root_cause}"
                    )
                    self.logger.error(error_msg)
                    self.progress_tracker.update(FirmwareStage.FAILED, error_msg)
                    raise FirmwareUpdateError(error_msg)

        # Should not reach here
        error_msg = f"Firmware upgrade failed after {retries + 1} attempts"
        self.logger.error(error_msg)
        self.progress_tracker.update(FirmwareStage.FAILED, error_msg)
        return False

    def _perform_upgrade(
        self,
        firmware_path: str,
        start_address: str,
        go_address: str,
    ) -> bool:
        """
        Perform a single upgrade attempt.

        Args:
            firmware_path: Path to firmware file
            start_address: Flash start address
            go_address: Go/jump address after flashing

        Returns:
            True if successful, False otherwise
        """
        try:
            # Step 1: Enter bootloader
            self.progress_tracker.update(
                FirmwareStage.ENTERING_BOOTLOADER,
                "Entering bootloader mode",
            )

            if not self.transport.enter_bootloader():
                raise FirmwareUpdateError("Failed to enter bootloader mode")

            self.progress_tracker.update(
                FirmwareStage.ENTERING_BOOTLOADER,
                "Device entered bootloader mode",
                sub_percentage=100,
            )

            # Step 2: Close connection for flashing
            self.progress_tracker.update(
                FirmwareStage.PREPARING_FLASH,
                "Closing serial connection for flashing",
            )

            # Save port info before closing
            if hasattr(self.transport, "port"):
                self.original_port = self.transport.port

            if not self.transport.close_for_flash():
                raise FirmwareUpdateError("Failed to close connection for flashing")

            self.progress_tracker.update(
                FirmwareStage.PREPARING_FLASH,
                "Connection closed, preparing to flash",
                sub_percentage=100,
            )

            # Step 3: Flash firmware using stm32flash
            self.progress_tracker.update(
                FirmwareStage.FLASHING,
                "Starting firmware flash operation",
            )

            if self.original_port == "SIM":
                self._simulate_flash()
            else:
                self._flash_hardware(firmware_path, start_address, go_address)

            self.progress_tracker.update(
                FirmwareStage.VERIFYING,
                "Firmware verification complete",
                sub_percentage=100,
            )

            # Step 4: Reconnect to device
            self.progress_tracker.update(
                FirmwareStage.RECONNECTING,
                "Waiting for device to reboot",
            )

            # Wait for device to reboot
            time.sleep(2)

            self.progress_tracker.update(
                FirmwareStage.RECONNECTING,
                "Attempting to reconnect to device",
                sub_percentage=50,
            )

            if not self.transport.reconnect_after_flash(timeout=RECONNECT_TIMEOUT):
                raise FirmwareUpdateError(
                    f"Failed to reconnect to device after {RECONNECT_TIMEOUT}s"
                )

            self.progress_tracker.update(
                FirmwareStage.RECONNECTING,
                "Successfully reconnected to device",
                sub_percentage=100,
            )

            return True

        except STM32FlasherError as e:
            error_msg = f"STM32 flashing error: {e}"
            self.logger.error(error_msg)
            self.progress_tracker.update(FirmwareStage.FAILED, error_msg)
            raise FirmwareUpdateError(error_msg)

        except Exception as e:
            error_msg = f"Unexpected error during firmware upgrade: {e}"
            self.logger.error(error_msg)
            self.progress_tracker.update(FirmwareStage.FAILED, error_msg)
            raise FirmwareUpdateError(error_msg)

    def _simulate_flash(self) -> None:
        """Simulate the flash and verify steps for the simulator transport."""
        self.logger.info("Using simulator - simulating flash process")
        for i in range(0, 81, 10):
            self.progress_tracker.update(
                FirmwareStage.FLASHING,
                "Writing firmware to device",
                sub_percentage=i,
            )
            time.sleep(0.3)
        for i in range(0, 101, 20):
            self.progress_tracker.update(
                FirmwareStage.VERIFYING,
                "Verifying firmware integrity",
                sub_percentage=i,
            )
            time.sleep(0.2)

    def _flash_progress_callback(self, percentage: float) -> None:
        """Bridge stm32flash percentage output to the progress tracker."""
        if percentage <= 80:
            self.progress_tracker.update(
                FirmwareStage.FLASHING,
                "Writing firmware to device",
                sub_percentage=percentage,
            )
        else:
            verify_pct = (percentage - 80) * 5  # Map 80-100 to 0-100
            self.progress_tracker.update(
                FirmwareStage.VERIFYING,
                "Verifying firmware integrity",
                sub_percentage=verify_pct,
            )

    def _flash_hardware(
        self,
        firmware_path: str,
        start_address: str,
        go_address: str,
    ) -> None:
        """Flash firmware to real hardware, raising FirmwareUpdateError on failure."""
        if not self.original_port:
            raise FirmwareUpdateError("No port information available for flashing")

        self.flasher = STM32Flasher(progress_callback=self._flash_progress_callback)
        flash_success = self.flasher.flash_firmware(
            firmware_path=firmware_path,
            port=self.original_port,
            start_address=start_address,
            go_address=go_address,
        )

        if not flash_success:
            flash_output = self.flasher.get_flash_output()
            self.logger.error(f"Flash output: {flash_output}")
            if self._was_flash_interrupted(flash_output):
                self._flash_interrupted = True
                interrupted_msg = (
                    "Firmware flash interrupted mid-update "
                    "(power may have been lost during flashing)"
                )
                self._last_flash_error = interrupted_msg
                raise FirmwareUpdateError(interrupted_msg)
            raise FirmwareUpdateError("Firmware flashing failed")

    def _was_flash_interrupted(self, flash_output: list) -> bool:
        """
        Detect whether stm32flash output indicates a mid-flash power interruption.

        A mid-flash interruption is identified by write progress having started
        (at least one "Wrote address" line) followed by a connection failure
        (ACK error, unexpected reply, or failed write).
        """
        wrote_started = any("Wrote address" in line for line in flash_output)
        connection_lost = any(
            keyword in line
            for line in flash_output
            for keyword in (
                "Failed to read ACK",
                "Unexpected reply",
                "Failed to write memory",
            )
        )
        return wrote_started and connection_lost

    def cancel_upgrade(self):
        """Cancel ongoing firmware upgrade."""
        self.logger.warning("Cancelling firmware upgrade")
        if self.flasher:
            self.flasher.cancel_flash()
        self.progress_tracker.update(FirmwareStage.FAILED, "Upgrade cancelled by user")

    def get_progress(self) -> FirmwareUpgradeProgress:
        """
        Get current upgrade progress.

        Returns:
            Current progress information
        """
        return self.progress_tracker.get_current_progress()
