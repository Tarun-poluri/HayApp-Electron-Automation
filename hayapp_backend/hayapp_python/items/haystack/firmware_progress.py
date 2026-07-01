"""
Firmware upgrade progress tracking system.

Provides progress tracking with detailed stages for firmware upgrades.
"""

import logging
import threading
import time
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Optional


class FirmwareStage(Enum):
    """Stages of firmware upgrade process."""

    IDLE = "idle"
    ENTERING_BOOTLOADER = "entering_bootloader"
    PREPARING_FLASH = "preparing_flash"
    FLASHING = "flashing"
    VERIFYING = "verifying"
    RECONNECTING = "reconnecting"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class FirmwareUpgradeProgress:
    """Progress information for firmware upgrade."""

    stage: str  # FirmwareStage value
    percentage: float  # 0-100
    message: str
    timestamp: float


class ProgressTracker:
    """Thread-safe progress tracker for firmware upgrades."""

    def __init__(
        self, progress_callback: Optional[Callable[[FirmwareUpgradeProgress], None]] = None
    ):
        """
        Initialize progress tracker.

        Args:
            progress_callback: Optional callback function to receive progress updates
        """
        self.logger = logging.getLogger(__name__)
        self.current_stage = FirmwareStage.IDLE
        self.current_percentage = 0.0
        self.current_message = ""
        self.progress_callback = progress_callback
        self.lock = threading.Lock()

        # Stage percentage ranges (min, max)
        self.stage_ranges = {
            FirmwareStage.ENTERING_BOOTLOADER: (0, 10),
            FirmwareStage.PREPARING_FLASH: (10, 20),
            FirmwareStage.FLASHING: (20, 80),
            FirmwareStage.VERIFYING: (80, 95),
            FirmwareStage.RECONNECTING: (95, 100),
            FirmwareStage.COMPLETE: (100, 100),
            FirmwareStage.FAILED: (0, 0),  # Keep last known percentage
        }

    def update(
        self,
        stage: FirmwareStage,
        message: str,
        sub_percentage: Optional[float] = None,
    ):
        """
        Update progress to a new stage.

        Args:
            stage: Current firmware upgrade stage
            message: Human-readable progress message
            sub_percentage: Optional percentage within current stage (0-100)
        """
        with self.lock:
            self.current_stage = stage

            # Calculate overall percentage based on stage and sub-percentage
            if stage in self.stage_ranges:
                min_pct, max_pct = self.stage_ranges[stage]

                if sub_percentage is not None and max_pct > min_pct:
                    # Interpolate within stage range
                    stage_progress = min_pct + (max_pct - min_pct) * (sub_percentage / 100.0)
                    self.current_percentage = min(100.0, max(0.0, stage_progress))
                else:
                    # Use start of range
                    self.current_percentage = min_pct
            else:
                # Unknown stage, keep current percentage
                pass

            self.current_message = message

            # Create progress object
            progress = FirmwareUpgradeProgress(
                stage=stage.value,
                percentage=self.current_percentage,
                message=message,
                timestamp=time.time(),
            )

            # Log progress
            self.logger.info(
                f"Firmware upgrade progress: {stage.value} - "
                f"{self.current_percentage:.1f}% - {message}"
            )

            # Call callback if provided
            if self.progress_callback:
                try:
                    self.progress_callback(progress)
                except Exception as e:
                    self.logger.error(f"Error in progress callback: {e}")

    def get_current_progress(self) -> FirmwareUpgradeProgress:
        """
        Get current progress snapshot.

        Returns:
            Current progress information
        """
        with self.lock:
            return FirmwareUpgradeProgress(
                stage=self.current_stage.value,
                percentage=self.current_percentage,
                message=self.current_message,
                timestamp=time.time(),
            )

    def is_complete(self) -> bool:
        """Check if upgrade is complete."""
        with self.lock:
            return self.current_stage in (FirmwareStage.COMPLETE, FirmwareStage.FAILED)

    def is_failed(self) -> bool:
        """Check if upgrade failed."""
        with self.lock:
            return self.current_stage == FirmwareStage.FAILED
