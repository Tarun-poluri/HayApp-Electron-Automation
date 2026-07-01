"""
Comprehensive test suite for Firmware Progress Tracking.

Tests cover:
- FirmwareStage enum values
- FirmwareUpgradeProgress dataclass
- ProgressTracker stage transitions
- Progress percentage calculations
- Progress callback invocation
- Thread safety
- Stage completion checks
"""

import threading
import time
import unittest
from unittest.mock import MagicMock

import pytest

from hayapp_python.items.haystack.firmware_progress import (
    FirmwareStage,
    FirmwareUpgradeProgress,
    ProgressTracker,
)

# ============================================================================
# FirmwareStage Tests
# ============================================================================


class TestFirmwareStage(unittest.TestCase):
    """Test FirmwareStage enum"""

    def test_all_stages_exist(self):
        """Test that all expected stages are defined"""
        expected_stages = [
            "idle",
            "entering_bootloader",
            "preparing_flash",
            "flashing",
            "verifying",
            "reconnecting",
            "complete",
            "failed",
        ]

        for stage_name in expected_stages:
            assert hasattr(FirmwareStage, stage_name.upper())
            stage = getattr(FirmwareStage, stage_name.upper())
            assert stage.value == stage_name

    def test_stage_values_are_strings(self):
        """Test that all stage values are strings"""
        for stage in FirmwareStage:
            assert isinstance(stage.value, str)


# ============================================================================
# FirmwareUpgradeProgress Tests
# ============================================================================


class TestFirmwareUpgradeProgress(unittest.TestCase):
    """Test FirmwareUpgradeProgress dataclass"""

    def test_create_progress(self):
        """Test creating a progress object"""
        progress = FirmwareUpgradeProgress(
            stage="flashing",
            percentage=50.5,
            message="Writing firmware",
            timestamp=1234567890.0,
        )

        assert progress.stage == "flashing"
        assert progress.percentage == 50.5
        assert progress.message == "Writing firmware"
        assert progress.timestamp == 1234567890.0

    def test_progress_attributes_accessible(self):
        """Test that all attributes are accessible"""
        progress = FirmwareUpgradeProgress(
            stage="complete", percentage=100.0, message="Done", timestamp=time.time()
        )

        # Should not raise AttributeError
        _ = progress.stage
        _ = progress.percentage
        _ = progress.message
        _ = progress.timestamp


# ============================================================================
# ProgressTracker Tests
# ============================================================================


class TestProgressTracker(unittest.TestCase):
    """Test ProgressTracker functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.callback_mock = MagicMock()
        self.tracker = ProgressTracker(progress_callback=self.callback_mock)

    def tearDown(self):
        """Clean up after tests"""
        self.callback_mock.reset_mock()

    def test_initial_state(self):
        """Test tracker starts in IDLE state at 0%"""
        assert self.tracker.current_stage == FirmwareStage.IDLE
        assert self.tracker.current_percentage == 0.0
        assert self.tracker.current_message == ""

    def test_update_to_entering_bootloader(self):
        """Test updating to ENTERING_BOOTLOADER stage"""
        self.tracker.update(FirmwareStage.ENTERING_BOOTLOADER, "Entering bootloader")

        assert self.tracker.current_stage == FirmwareStage.ENTERING_BOOTLOADER
        assert self.tracker.current_percentage == 0.0  # Start of range
        assert self.tracker.current_message == "Entering bootloader"

        # Check callback was called
        self.callback_mock.assert_called_once()
        call_args = self.callback_mock.call_args[0][0]
        assert call_args.stage == "entering_bootloader"
        assert call_args.percentage == 0.0

    def test_update_with_sub_percentage(self):
        """Test updating with sub-percentage within stage"""
        self.tracker.update(FirmwareStage.FLASHING, "Writing firmware", sub_percentage=50.0)

        # FLASHING range is 20-80%, so 50% within that range should be 50%
        # 20 + (80-20) * 0.5 = 20 + 30 = 50
        expected_percentage = 20 + (80 - 20) * 0.5
        assert self.tracker.current_percentage == expected_percentage
        assert self.tracker.current_message == "Writing firmware"

    def test_stage_percentage_ranges(self):
        """Test that each stage maps to correct percentage range"""
        test_cases = [
            (FirmwareStage.ENTERING_BOOTLOADER, 0, 10),
            (FirmwareStage.PREPARING_FLASH, 10, 20),
            (FirmwareStage.FLASHING, 20, 80),
            (FirmwareStage.VERIFYING, 80, 95),
            (FirmwareStage.RECONNECTING, 95, 100),
            (FirmwareStage.COMPLETE, 100, 100),
        ]

        for stage, expected_min, expected_max in test_cases:
            # Reset tracker
            self.tracker = ProgressTracker()

            # Update to start of stage
            self.tracker.update(stage, f"Testing {stage.value}")
            assert self.tracker.current_percentage == expected_min

            # Update to end of stage (if range exists)
            if expected_max > expected_min:
                self.tracker.update(stage, f"Testing {stage.value}", sub_percentage=100.0)
                assert self.tracker.current_percentage == expected_max

    def test_complete_stage(self):
        """Test COMPLETE stage sets percentage to 100%"""
        self.tracker.update(FirmwareStage.COMPLETE, "Upgrade complete")

        assert self.tracker.current_stage == FirmwareStage.COMPLETE
        assert self.tracker.current_percentage == 100.0
        assert self.tracker.is_complete()

    def test_failed_stage(self):
        """Test FAILED stage"""
        # Set some progress first
        self.tracker.update(FirmwareStage.FLASHING, "Writing", sub_percentage=50.0)

        # Update to FAILED - should keep last percentage
        self.tracker.update(FirmwareStage.FAILED, "Flash failed")

        assert self.tracker.current_stage == FirmwareStage.FAILED
        # FAILED stage range is (0, 0) so percentage stays at current
        assert self.tracker.is_failed()
        assert self.tracker.is_complete()

    def test_get_current_progress(self):
        """Test getting current progress snapshot"""
        self.tracker.update(FirmwareStage.VERIFYING, "Verifying firmware")

        progress = self.tracker.get_current_progress()

        assert isinstance(progress, FirmwareUpgradeProgress)
        assert progress.stage == "verifying"
        assert progress.percentage == 80.0  # Start of VERIFYING range
        assert progress.message == "Verifying firmware"
        assert isinstance(progress.timestamp, float)

    def test_is_complete_returns_false_initially(self):
        """Test is_complete returns False for non-terminal stages"""
        assert not self.tracker.is_complete()

        self.tracker.update(FirmwareStage.FLASHING, "Flashing")
        assert not self.tracker.is_complete()

    def test_is_complete_returns_true_for_complete(self):
        """Test is_complete returns True for COMPLETE stage"""
        self.tracker.update(FirmwareStage.COMPLETE, "Done")
        assert self.tracker.is_complete()

    def test_is_complete_returns_true_for_failed(self):
        """Test is_complete returns True for FAILED stage"""
        self.tracker.update(FirmwareStage.FAILED, "Error")
        assert self.tracker.is_complete()

    def test_is_failed_returns_false_for_success(self):
        """Test is_failed returns False for non-FAILED stages"""
        assert not self.tracker.is_failed()

        self.tracker.update(FirmwareStage.COMPLETE, "Done")
        assert not self.tracker.is_failed()

    def test_is_failed_returns_true_for_failed(self):
        """Test is_failed returns True for FAILED stage"""
        self.tracker.update(FirmwareStage.FAILED, "Error")
        assert self.tracker.is_failed()

    def test_callback_invocation(self):
        """Test that progress callback is invoked correctly"""
        self.tracker.update(FirmwareStage.FLASHING, "Writing firmware", sub_percentage=25.0)

        # Callback should be called once
        assert self.callback_mock.call_count == 1

        # Check callback arguments
        progress = self.callback_mock.call_args[0][0]
        assert isinstance(progress, FirmwareUpgradeProgress)
        assert progress.stage == "flashing"
        assert "Writing firmware" in progress.message

    def test_callback_called_for_each_update(self):
        """Test callback is called for each update"""
        self.tracker.update(FirmwareStage.ENTERING_BOOTLOADER, "Step 1")
        self.tracker.update(FirmwareStage.PREPARING_FLASH, "Step 2")
        self.tracker.update(FirmwareStage.FLASHING, "Step 3")

        assert self.callback_mock.call_count == 3

    def test_tracker_without_callback(self):
        """Test tracker works without callback"""
        tracker_no_callback = ProgressTracker(progress_callback=None)

        # Should not raise exception
        tracker_no_callback.update(FirmwareStage.FLASHING, "Test")

        assert tracker_no_callback.current_stage == FirmwareStage.FLASHING

    def test_callback_exception_handling(self):
        """Test that callback exceptions are caught and don't break tracker"""

        # Create callback that raises exception
        def bad_callback(progress):
            raise ValueError("Callback error")

        tracker = ProgressTracker(progress_callback=bad_callback)

        # Should not raise exception
        tracker.update(FirmwareStage.FLASHING, "Test")

        # Tracker should still update
        assert tracker.current_stage == FirmwareStage.FLASHING

    def test_thread_safety(self):
        """Test that progress tracker is thread-safe"""
        results = []
        errors = []

        def update_progress(stage_num):
            try:
                stage = FirmwareStage.FLASHING
                for i in range(10):
                    self.tracker.update(
                        stage, f"Thread {stage_num} update {i}", sub_percentage=i * 10
                    )
                    time.sleep(0.001)
                results.append(stage_num)
            except Exception as e:
                errors.append(e)

        # Create multiple threads updating progress
        threads = []
        for i in range(5):
            thread = threading.Thread(target=update_progress, args=(i,))
            threads.append(thread)
            thread.start()

        # Wait for all threads
        for thread in threads:
            thread.join()

        # Should complete without errors
        assert len(errors) == 0
        assert len(results) == 5

        # Tracker should still be in valid state
        assert self.tracker.current_stage == FirmwareStage.FLASHING

    def test_percentage_clamping(self):
        """Test that percentages are clamped to 0-100 range"""
        # Complete stage gives 100%
        self.tracker.update(FirmwareStage.COMPLETE, "Done")
        assert self.tracker.current_percentage == 100.0
        assert self.tracker.current_percentage <= 100.0

        # No stage should give > 100%
        for stage in FirmwareStage:
            if stage in (FirmwareStage.IDLE, FirmwareStage.FAILED):
                continue
            tracker = ProgressTracker()
            tracker.update(stage, "Test", sub_percentage=100.0)
            assert tracker.current_percentage <= 100.0
            assert tracker.current_percentage >= 0.0

    def test_sequential_stage_progression(self):
        """Test typical sequential progression through stages"""
        stages_sequence = [
            (FirmwareStage.ENTERING_BOOTLOADER, "Entering bootloader", None),
            (FirmwareStage.PREPARING_FLASH, "Closing connection", None),
            (FirmwareStage.FLASHING, "Writing firmware", 0.0),
            (FirmwareStage.FLASHING, "Writing firmware", 50.0),
            (FirmwareStage.VERIFYING, "Verifying", 0.0),
            (FirmwareStage.VERIFYING, "Verifying", 100.0),
            (FirmwareStage.RECONNECTING, "Reconnecting", 50.0),
            (FirmwareStage.COMPLETE, "Upgrade complete", None),
        ]

        for stage, message, sub_pct in stages_sequence:
            self.tracker.update(stage, message, sub_percentage=sub_pct)

            # Percentage should generally increase (except for stage resets)
            # Allow small variations due to stage boundaries
            if stage != FirmwareStage.IDLE:
                # Just check it's reasonable
                assert 0.0 <= self.tracker.current_percentage <= 100.0

        # Should end at 100%
        assert self.tracker.current_percentage == 100.0
        assert self.tracker.is_complete()


# ============================================================================
# Integration Tests
# ============================================================================


class TestProgressTrackerIntegration(unittest.TestCase):
    """Integration tests for progress tracking scenarios"""

    def test_complete_upgrade_flow(self):
        """Test complete upgrade flow with realistic progression"""
        callback_mock = MagicMock()
        tracker = ProgressTracker(progress_callback=callback_mock)

        # Simulate complete upgrade flow
        tracker.update(FirmwareStage.ENTERING_BOOTLOADER, "Sending UPDATE command")
        assert tracker.current_percentage < 10.0

        tracker.update(FirmwareStage.PREPARING_FLASH, "Closing connection")
        assert 10.0 <= tracker.current_percentage < 20.0

        tracker.update(FirmwareStage.FLASHING, "Writing firmware", sub_percentage=0.0)
        assert tracker.current_percentage == 20.0

        tracker.update(FirmwareStage.FLASHING, "Writing firmware", sub_percentage=50.0)
        assert tracker.current_percentage == 50.0  # Middle of FLASHING range

        tracker.update(FirmwareStage.FLASHING, "Writing firmware", sub_percentage=100.0)
        assert tracker.current_percentage == 80.0  # End of FLASHING range

        tracker.update(FirmwareStage.VERIFYING, "Verifying firmware", sub_percentage=100.0)
        assert tracker.current_percentage == 95.0

        tracker.update(FirmwareStage.RECONNECTING, "Reconnecting", sub_percentage=100.0)
        assert tracker.current_percentage == 100.0

        tracker.update(FirmwareStage.COMPLETE, "Upgrade complete")
        assert tracker.current_percentage == 100.0
        assert tracker.is_complete()
        assert not tracker.is_failed()

        # Should have called callback for each update
        assert callback_mock.call_count == 8

    def test_failed_upgrade_flow(self):
        """Test upgrade flow that fails during flashing"""
        tracker = ProgressTracker()

        tracker.update(FirmwareStage.ENTERING_BOOTLOADER, "Entering bootloader")
        tracker.update(FirmwareStage.PREPARING_FLASH, "Preparing")
        tracker.update(FirmwareStage.FLASHING, "Writing", sub_percentage=30.0)

        # Simulate failure
        tracker.update(FirmwareStage.FAILED, "Flash verification failed")

        assert tracker.is_complete()
        assert tracker.is_failed()
        assert tracker.current_stage == FirmwareStage.FAILED


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
