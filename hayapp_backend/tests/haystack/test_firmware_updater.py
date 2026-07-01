"""
Comprehensive test suite for Firmware Updater.

Tests cover:
- Firmware file validation
- Complete upgrade workflow
- Bootloader entry
- Flash execution
- Reconnection logic
- Retry mechanism
- Error handling and recovery
- Progress tracking integration
"""

import unittest
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

from hayapp_python.items.haystack.firmware_updater import (
    FirmwareUpdateError,
    FirmwareUpdater,
)
from hayapp_python.items.haystack.stm32_flasher import STM32Flasher

# ============================================================================
# Initialization Tests
# ============================================================================


class TestFirmwareUpdaterInit(unittest.TestCase):
    """Test FirmwareUpdater initialization"""

    def test_init_with_transport(self):
        """Test initializing updater with transport"""
        mock_transport = Mock()
        updater = FirmwareUpdater(mock_transport)

        assert updater.transport == mock_transport
        assert updater.flasher is None
        assert updater.original_port is None

    def test_init_with_callback(self):
        """Test initializing with progress callback"""
        mock_transport = Mock()
        mock_callback = MagicMock()

        updater = FirmwareUpdater(mock_transport, progress_callback=mock_callback)

        assert updater.progress_tracker.progress_callback == mock_callback


# ============================================================================
# Validation Tests
# ============================================================================


class TestFirmwareValidation(unittest.TestCase):
    """Test firmware file validation"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_transport = Mock()
        self.updater = FirmwareUpdater(self.mock_transport)

    def test_nonexistent_firmware_file(self):
        """Test that non-existent file raises error"""
        with pytest.raises(FirmwareUpdateError, match="Firmware file not found"):
            self.updater.upgrade_firmware("/nonexistent/firmware.bin")

    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    def test_invalid_firmware_extension(self, mock_path_class):
        """Test that non-.bin file raises error"""
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".hex"  # Wrong extension
        mock_path_class.return_value = mock_path

        with pytest.raises(FirmwareUpdateError, match="must be a .bin file"):
            self.updater.upgrade_firmware("/path/to/firmware.hex")


# ============================================================================
# Upgrade Workflow Tests
# ============================================================================


class TestUpgradeWorkflow(unittest.TestCase):
    """Test complete firmware upgrade workflow"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_transport = Mock()
        self.mock_transport.port = "COM3"
        self.mock_transport.enter_bootloader.return_value = True
        self.mock_transport.close_for_flash.return_value = True
        self.mock_transport.reconnect_after_flash.return_value = True

        self.updater = FirmwareUpdater(self.mock_transport)

    @patch("hayapp_python.items.haystack.firmware_updater.STM32Flasher")
    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    @patch("hayapp_python.items.haystack.firmware_updater.time.sleep")
    def test_successful_upgrade(self, mock_sleep, mock_path_class, mock_flasher_class):
        """Test successful firmware upgrade"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        # Mock flasher
        mock_flasher = Mock()
        mock_flasher.flash_firmware.return_value = True
        mock_flasher_class.return_value = mock_flasher

        result = self.updater.upgrade_firmware("/path/to/firmware.bin")

        assert result is True

        # Verify workflow
        self.mock_transport.enter_bootloader.assert_called_once()
        self.mock_transport.close_for_flash.assert_called_once()
        mock_flasher.flash_firmware.assert_called_once()
        self.mock_transport.reconnect_after_flash.assert_called_once()

    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    def test_bootloader_entry_failure(self, mock_path_class):
        """Test failure during bootloader entry"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        # Mock bootloader entry failure
        self.mock_transport.enter_bootloader.return_value = False

        with pytest.raises(FirmwareUpdateError, match="Failed to enter bootloader"):
            self.updater.upgrade_firmware("/path/to/firmware.bin")

    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    def test_close_for_flash_failure(self, mock_path_class):
        """Test failure when closing connection"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        # Mock close failure
        self.mock_transport.close_for_flash.return_value = False

        with pytest.raises(FirmwareUpdateError, match="Failed to close connection"):
            self.updater.upgrade_firmware("/path/to/firmware.bin")

    @patch("hayapp_python.items.haystack.firmware_updater.STM32Flasher")
    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    @patch("hayapp_python.items.haystack.firmware_updater.time.sleep")
    def test_flash_failure(self, mock_sleep, mock_path_class, mock_flasher_class):
        """Test failure during flashing"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        # Mock flasher failure
        mock_flasher = Mock()
        mock_flasher.flash_firmware.return_value = False
        mock_flasher.get_flash_output.return_value = ["Error: Flash failed"]
        mock_flasher_class.return_value = mock_flasher

        with pytest.raises(FirmwareUpdateError, match="Firmware flashing failed"):
            self.updater.upgrade_firmware("/path/to/firmware.bin")

    @patch("hayapp_python.items.haystack.firmware_updater.STM32Flasher")
    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    @patch("hayapp_python.items.haystack.firmware_updater.time.sleep")
    def test_reconnection_failure(self, mock_sleep, mock_path_class, mock_flasher_class):
        """Test failure during reconnection"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        # Mock flasher success
        mock_flasher = Mock()
        mock_flasher.flash_firmware.return_value = True
        mock_flasher_class.return_value = mock_flasher

        # Mock reconnection failure
        self.mock_transport.reconnect_after_flash.return_value = False

        with pytest.raises(FirmwareUpdateError, match="Failed to reconnect"):
            self.updater.upgrade_firmware("/path/to/firmware.bin")


# ============================================================================
# Retry Logic Tests
# ============================================================================


class TestRetryLogic(unittest.TestCase):
    """Test retry logic"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_transport = Mock()
        self.mock_transport.port = "COM3"
        self.updater = FirmwareUpdater(self.mock_transport)

    @patch("hayapp_python.items.haystack.firmware_updater.STM32Flasher")
    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    @patch("hayapp_python.items.haystack.firmware_updater.time.sleep")
    def test_retry_on_failure(self, mock_sleep, mock_path_class, mock_flasher_class):
        """Test that upgrade retries on failure"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        # First attempt fails, second succeeds
        self.mock_transport.enter_bootloader.side_effect = [False, True]
        self.mock_transport.close_for_flash.return_value = True
        self.mock_transport.reconnect_after_flash.return_value = True

        # Mock flasher
        mock_flasher = Mock()
        mock_flasher.flash_firmware.return_value = True
        mock_flasher_class.return_value = mock_flasher

        result = self.updater.upgrade_firmware("/path/to/firmware.bin", max_retries=1)

        # Should succeed after retry
        assert result is True
        assert self.mock_transport.enter_bootloader.call_count == 2

    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    def test_max_retries_exceeded(self, mock_path_class):
        """Test that upgrade fails after max retries"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        # Always fail bootloader entry
        self.mock_transport.enter_bootloader.return_value = False

        with pytest.raises(FirmwareUpdateError, match="failed after .* attempts"):
            self.updater.upgrade_firmware("/path/to/firmware.bin", max_retries=2)

        # Should try initial + 2 retries = 3 total
        assert self.mock_transport.enter_bootloader.call_count == 3


# ============================================================================
# Progress Tracking Tests
# ============================================================================


class TestProgressTracking(unittest.TestCase):
    """Test progress tracking during upgrade"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_transport = Mock()
        self.mock_transport.port = "COM3"
        self.mock_transport.enter_bootloader.return_value = True
        self.mock_transport.close_for_flash.return_value = True
        self.mock_transport.reconnect_after_flash.return_value = True

        self.progress_callback = MagicMock()
        self.updater = FirmwareUpdater(
            self.mock_transport, progress_callback=self.progress_callback
        )

    @patch("hayapp_python.items.haystack.firmware_updater.STM32Flasher")
    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    @patch("hayapp_python.items.haystack.firmware_updater.time.sleep")
    def test_progress_callbacks_invoked(self, mock_sleep, mock_path_class, mock_flasher_class):
        """Test that progress callbacks are invoked during upgrade"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        # Mock flasher
        mock_flasher = Mock()
        mock_flasher.flash_firmware.return_value = True
        mock_flasher_class.return_value = mock_flasher

        self.updater.upgrade_firmware("/path/to/firmware.bin")

        # Progress callback should be called multiple times
        assert self.progress_callback.call_count > 0

        # Check that different stages were reported
        stages_reported = [
            call_args[0][0].stage for call_args in self.progress_callback.call_args_list
        ]

        assert "entering_bootloader" in stages_reported
        assert "preparing_flash" in stages_reported
        assert "flashing" in stages_reported

    def test_get_progress(self):
        """Test getting current progress"""
        progress = self.updater.get_progress()

        assert progress.stage == "idle"
        assert progress.percentage == 0.0

    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    def test_progress_on_failure(self, mock_path_class):
        """Test that progress is updated on failure"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        # Mock bootloader failure
        self.mock_transport.enter_bootloader.return_value = False

        try:
            self.updater.upgrade_firmware("/path/to/firmware.bin")
        except FirmwareUpdateError:
            pass

        # Progress should show failure
        progress = self.updater.get_progress()
        assert progress.stage == "failed"


# ============================================================================
# Cancellation Tests
# ============================================================================


class TestCancellation(unittest.TestCase):
    """Test upgrade cancellation"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_transport = Mock()
        self.updater = FirmwareUpdater(self.mock_transport)

    def test_cancel_upgrade(self):
        """Test cancelling upgrade"""
        # Mock active flasher
        mock_flasher = Mock()
        self.updater.flasher = mock_flasher

        self.updater.cancel_upgrade()

        # Flasher cancel should be called
        mock_flasher.cancel_flash.assert_called_once()

        # Progress should show failure
        progress = self.updater.get_progress()
        assert progress.stage == "failed"
        assert "cancelled" in progress.message.lower()

    def test_cancel_without_active_flasher(self):
        """Test cancelling when no flash is active"""
        # Should not raise exception
        self.updater.cancel_upgrade()

        progress = self.updater.get_progress()
        assert progress.stage == "failed"


# ============================================================================
# Port Management Tests
# ============================================================================


class TestPortManagement(unittest.TestCase):
    """Test port information management"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_transport = Mock()
        self.mock_transport.port = "/dev/ttyUSB0"
        self.updater = FirmwareUpdater(self.mock_transport)

    @patch("hayapp_python.items.haystack.firmware_updater.STM32Flasher")
    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    @patch("hayapp_python.items.haystack.firmware_updater.time.sleep")
    def test_port_saved_during_upgrade(self, mock_sleep, mock_path_class, mock_flasher_class):
        """Test that port information is saved"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        # Mock successful flash
        self.mock_transport.enter_bootloader.return_value = True
        self.mock_transport.close_for_flash.return_value = True
        self.mock_transport.reconnect_after_flash.return_value = True

        mock_flasher = Mock()
        mock_flasher.flash_firmware.return_value = True
        mock_flasher_class.return_value = mock_flasher

        self.updater.upgrade_firmware("/path/to/firmware.bin")

        # Port should be saved
        assert self.updater.original_port == "/dev/ttyUSB0"

    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    def test_no_port_available_error(self, mock_path_class):
        """Test error when no port information is available"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        # Transport has no port
        self.mock_transport.port = None
        self.mock_transport.enter_bootloader.return_value = True
        self.mock_transport.close_for_flash.return_value = True

        # Should fail because no port for flashing
        with pytest.raises(FirmwareUpdateError, match="No port information"):
            self.updater.upgrade_firmware("/path/to/firmware.bin")


# ============================================================================
# Simulator Mode Tests
# ============================================================================


class TestSimulatorMode(unittest.TestCase):
    """Test simulator-specific firmware upgrade behavior"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_transport = Mock()
        self.mock_transport.port = "SIM"  # Simulator port
        self.mock_transport.enter_bootloader.return_value = True
        self.mock_transport.close_for_flash.return_value = True
        self.mock_transport.reconnect_after_flash.return_value = True

        self.updater = FirmwareUpdater(self.mock_transport)

    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    @patch("hayapp_python.items.haystack.firmware_updater.time.sleep")
    def test_simulator_upgrade_success(self, mock_sleep, mock_path_class):
        """Test successful firmware upgrade in simulator mode"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        result = self.updater.upgrade_firmware("/path/to/firmware.bin")

        # Should succeed
        assert result is True

        # Verify workflow (but no STM32Flasher should be created)
        self.mock_transport.enter_bootloader.assert_called_once()
        self.mock_transport.close_for_flash.assert_called_once()
        self.mock_transport.reconnect_after_flash.assert_called_once()

    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    @patch("hayapp_python.items.haystack.firmware_updater.time.sleep")
    def test_simulator_skips_real_flasher(self, mock_sleep, mock_path_class):
        """Test that simulator mode doesn't use STM32Flasher"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        self.updater.upgrade_firmware("/path/to/firmware.bin")

        # Flasher should not be created in simulator mode
        assert self.updater.flasher is None

    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    @patch("hayapp_python.items.haystack.firmware_updater.time.sleep")
    def test_simulator_progress_updates(self, mock_sleep, mock_path_class):
        """Test that simulator emits progress updates"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        progress_callback = MagicMock()
        updater = FirmwareUpdater(self.mock_transport, progress_callback=progress_callback)

        updater.upgrade_firmware("/path/to/firmware.bin")

        # Progress callback should be called multiple times
        assert progress_callback.call_count > 0

        # Check that flashing and verifying stages were reported
        stages_reported = [call_args[0][0].stage for call_args in progress_callback.call_args_list]

        assert "flashing" in stages_reported
        assert "verifying" in stages_reported


# ============================================================================
# Custom Address Tests
# ============================================================================


class TestCustomAddresses(unittest.TestCase):
    """Test custom start and go addresses"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_transport = Mock()
        self.mock_transport.port = "COM3"
        self.mock_transport.enter_bootloader.return_value = True
        self.mock_transport.close_for_flash.return_value = True
        self.mock_transport.reconnect_after_flash.return_value = True

        self.updater = FirmwareUpdater(self.mock_transport)

    @patch("hayapp_python.items.haystack.firmware_updater.STM32Flasher")
    @patch("hayapp_python.items.haystack.firmware_updater.Path")
    @patch("hayapp_python.items.haystack.firmware_updater.time.sleep")
    def test_custom_addresses(self, mock_sleep, mock_path_class, mock_flasher_class):
        """Test using custom start and go addresses"""
        # Mock firmware file exists
        mock_path = Mock()
        mock_path.exists.return_value = True
        mock_path.suffix = ".bin"
        mock_path_class.return_value = mock_path

        # Mock flasher
        mock_flasher = Mock()
        mock_flasher.flash_firmware.return_value = True
        mock_flasher_class.return_value = mock_flasher

        self.updater.upgrade_firmware(
            "/path/to/firmware.bin",
            start_address="0x08000000",
            go_address="0x08000000",
        )

        # Check that flasher was called with custom addresses
        mock_flasher.flash_firmware.assert_called_once()
        call_kwargs = mock_flasher.flash_firmware.call_args[1]
        assert call_kwargs["start_address"] == "0x08000000"
        assert call_kwargs["go_address"] == "0x08000000"


# ============================================================================
# Flash Progress Callback Bridge Tests
# ============================================================================


class TestFlashCallbackBridge(unittest.TestCase):
    """Test FirmwareUpdater._flash_progress_callback.

    This callback maps STM32Flasher's adjusted percentages to firmware stages:
      adjusted_percentage ≤ 80  →  FLASHING  (write phase, sub_percentage = adjusted_pct)
      adjusted_percentage >  80  →  VERIFYING (verify phase, sub_percentage = (pct-80)*5)

    ProgressTracker stage ranges:
      FLASHING:   overall = 20 + (80-20) * sub_pct/100
      VERIFYING:  overall = 80 + (95-80) * sub_pct/100
    """

    def _run_upgrade_emitting_percentages(self, flash_percentages):
        """
        Run upgrade_firmware with a mock STM32Flasher that fires the given
        adjusted percentages through flash_progress_callback during flash_firmware.
        Returns the list of FirmwareUpgradeProgress objects emitted to the outer callback.
        """
        mock_transport = Mock()
        mock_transport.port = "COM3"
        mock_transport.enter_bootloader.return_value = True
        mock_transport.close_for_flash.return_value = True
        mock_transport.reconnect_after_flash.return_value = True

        emitted = []
        updater = FirmwareUpdater(mock_transport, progress_callback=lambda p: emitted.append(p))

        def flasher_factory(progress_callback=None):
            def do_flash(*args, **kwargs):
                for pct in flash_percentages:
                    if progress_callback:
                        progress_callback(pct)
                return True

            mock_flasher = Mock()
            mock_flasher.flash_firmware.side_effect = do_flash
            return mock_flasher

        with patch(
            "hayapp_python.items.haystack.firmware_updater.STM32Flasher",
            side_effect=flasher_factory,
        ):
            with patch("hayapp_python.items.haystack.firmware_updater.Path") as mock_path_class:
                mock_path = Mock()
                mock_path.exists.return_value = True
                mock_path.suffix = ".bin"
                mock_path_class.return_value = mock_path
                with patch("hayapp_python.items.haystack.firmware_updater.time.sleep"):
                    updater.upgrade_firmware("/path/to/firmware.bin")

        return emitted

    def test_write_phase_percentage_produces_flashing_stage(self):
        """Adjusted percentage ≤ 80 must emit a FLASHING stage update."""
        emitted = self._run_upgrade_emitting_percentages([40.0])
        flash_updates = [p for p in emitted if p.stage == "flashing"]
        assert len(flash_updates) > 0

    def test_verify_phase_percentage_produces_verifying_stage(self):
        """Adjusted percentage > 80 must emit a VERIFYING stage update."""
        emitted = self._run_upgrade_emitting_percentages([90.0])
        verify_updates = [p for p in emitted if p.stage == "verifying"]
        assert len(verify_updates) > 0

    def test_boundary_80_is_still_flashing(self):
        """Exactly 80.0 sits on the write side of the ≤80 boundary → FLASHING."""
        emitted = self._run_upgrade_emitting_percentages([80.0])
        flash_updates = [p for p in emitted if p.stage == "flashing"]
        assert len(flash_updates) > 0

    def test_just_above_80_is_verifying(self):
        """80.001 crosses into verify phase → VERIFYING."""
        emitted = self._run_upgrade_emitting_percentages([80.001])
        verify_updates = [p for p in emitted if p.stage == "verifying"]
        assert len(verify_updates) > 0

    def test_write_percentage_maps_to_correct_overall_value(self):
        """Adjusted pct=40 → sub_pct=40 → overall = 20 + 60*(40/100) = 44.0."""
        emitted = self._run_upgrade_emitting_percentages([40.0])
        flash_updates = [p for p in emitted if p.stage == "flashing"]
        assert any(abs(p.percentage - 44.0) < 0.1 for p in flash_updates)

    def test_verify_percentage_maps_to_correct_overall_value(self):
        """Adjusted pct=90 → verify_pct=(90-80)*5=50 → overall = 80 + 15*(50/100) = 87.5."""
        emitted = self._run_upgrade_emitting_percentages([90.0])
        verify_updates = [p for p in emitted if p.stage == "verifying"]
        assert any(abs(p.percentage - 87.5) < 0.1 for p in verify_updates)

    def test_full_sequence_stage_order_is_flash_then_verify(self):
        """
        A write→verify sequence must not produce any verify updates
        before the first flash update.
        """
        percentages = [0.0, 20.0, 40.0, 60.0, 80.0, 82.0, 90.0, 100.0]
        emitted = self._run_upgrade_emitting_percentages(percentages)
        flash_and_verify = [p for p in emitted if p.stage in ("flashing", "verifying")]

        if "verifying" in [p.stage for p in flash_and_verify]:
            first_verify_idx = next(
                i for i, p in enumerate(flash_and_verify) if p.stage == "verifying"
            )
            for p in flash_and_verify[:first_verify_idx]:
                assert p.stage == "flashing"

    def test_full_sequence_overall_percentage_is_non_decreasing(self):
        """
        A complete write→verify sequence must produce
        monotonically increasing overall percentages.
        """
        percentages = [0.0, 16.0, 32.0, 48.0, 64.0, 80.0, 82.0, 86.0, 90.0, 94.0, 98.0, 100.0]
        emitted = self._run_upgrade_emitting_percentages(percentages)
        flash_and_verify = [p for p in emitted if p.stage in ("flashing", "verifying")]

        for i in range(1, len(flash_and_verify)):
            prev = flash_and_verify[i - 1].percentage
            curr = flash_and_verify[i].percentage
            assert curr >= prev - 0.001, (
                f"Percentage went backwards at index {i}: "
                f"stage={flash_and_verify[i].stage} {prev:.2f} → {curr:.2f}"
            )


# ============================================================================
# Full Pipeline Integration Tests (Real STM32Flasher + Mocked Subprocess)
# ============================================================================


class TestFullFlashPipelineWithRealFlasher(unittest.TestCase):
    """Integration tests that run the real STM32Flasher with a mocked subprocess.

    Unlike the unit tests above (which mock STM32Flasher entirely), these tests
    let the real STM32Flasher run — including _parse_progress_line and the
    _flash_progress_callback bridge — and only stub out the external process and
    binary/file-system checks. This exercises the full chain:

        stm32flash output line
            → STM32Flasher._parse_progress_line
            → adjusted_percentage
            → FirmwareUpdater._flash_progress_callback
            → ProgressTracker.update
            → FirmwareUpgradeProgress emitted to outer callback
    """

    def setUp(self):
        self.mock_transport = Mock()
        self.mock_transport.port = "COM3"
        self.mock_transport.enter_bootloader.return_value = True
        self.mock_transport.close_for_flash.return_value = True
        self.mock_transport.reconnect_after_flash.return_value = True

    def _make_mock_popen(self, output_lines):
        """Return a mock Popen that streams the given lines then exits 0."""
        mock_proc = Mock()
        mock_proc.stdout = iter(line + "\n" for line in output_lines)
        mock_proc.wait.return_value = 0
        return mock_proc

    def _run_pipeline(self, output_lines):
        """Run the full upgrade pipeline with mocked subprocess output. Returns emitted progress."""
        emitted = []
        updater = FirmwareUpdater(
            self.mock_transport, progress_callback=lambda p: emitted.append(p)
        )

        with patch(
            "hayapp_python.items.haystack.stm32_flasher.subprocess.Popen",
            return_value=self._make_mock_popen(output_lines),
        ):
            with patch.object(
                STM32Flasher,
                "find_stm32flash_binary",
                return_value=Path("/fake/stm32flash"),
            ):
                with patch(
                    "hayapp_python.items.haystack.firmware_updater.Path"
                ) as mock_fw_path_cls:
                    mock_fw_path = Mock()
                    mock_fw_path.exists.return_value = True
                    mock_fw_path.suffix = ".bin"
                    mock_fw_path_cls.return_value = mock_fw_path
                    with patch(
                        "hayapp_python.items.haystack.stm32_flasher.Path"
                    ) as mock_stm_path_cls:
                        mock_stm_path = Mock()
                        mock_stm_path.exists.return_value = True
                        mock_stm_path_cls.return_value = mock_stm_path
                        with patch("hayapp_python.items.haystack.firmware_updater.time.sleep"):
                            updater.upgrade_firmware("/path/to/firmware.bin")

        return emitted

    def test_modern_output_produces_flashing_updates(self):
        """Modern 'Wrote and verified' output must generate FLASHING stage updates."""
        output = [
            "stm32flash 0.5",
            "Wrote and verified address 0x08005000 (  0.00%)",
            "Wrote and verified address 0x08008000 ( 25.00%)",
            "Wrote and verified address 0x0800B000 ( 50.00%)",
            "Wrote and verified address 0x0800E000 ( 75.00%)",
            "Wrote and verified address 0x0801FFFF (100.00%)",
            "Starting execution at address 0x08005000",
        ]
        emitted = self._run_pipeline(output)
        flash_updates = [p for p in emitted if p.stage == "flashing"]
        assert len(flash_updates) > 0

    def test_modern_output_overall_percentage_is_non_decreasing(self):
        """
        End-to-end: a full 'Wrote and verified' run
        must never decrease the overall percentage.
        """
        output = [
            "Wrote and verified address 0x08005000 (  0.00%)",
            "Wrote and verified address 0x08007000 ( 10.00%)",
            "Wrote and verified address 0x08009000 ( 25.00%)",
            "Wrote and verified address 0x0800D000 ( 50.00%)",
            "Wrote and verified address 0x08013000 ( 75.00%)",
            "Wrote and verified address 0x0801FFFF (100.00%)",
            "Starting execution at address 0x08005000",
        ]
        emitted = self._run_pipeline(output)
        percentages = [p.percentage for p in emitted]
        for i in range(1, len(percentages)):
            assert percentages[i] >= percentages[i - 1] - 0.001, (
                f"Overall percentage went backwards: "
                f"{emitted[i-1].stage}@{percentages[i-1]:.2f} → "
                f"{emitted[i].stage}@{percentages[i]:.2f}"
            )

    def test_modern_output_ends_at_complete(self):
        """Upgrade with valid stm32flash output should finish at the COMPLETE stage."""
        output = [
            "Wrote and verified address 0x0801FFFF (100.00%)",
            "Starting execution at address 0x08005000",
        ]
        emitted = self._run_pipeline(output)
        assert emitted[-1].stage == "complete"

    def test_wrote_and_verified_does_not_trigger_verifying_stage_during_flash(self):
        """
        'Wrote and verified' lines must not produce
        VERIFYING updates — that is a separate stage.
        """
        output = [
            "Wrote and verified address 0x08005000 ( 50.00%)",
            "Starting execution at address 0x08005000",
        ]
        emitted = self._run_pipeline(output)
        # The only verifying update should come from the post-flash update
        # ("Firmware verification complete"), not from the stm32flash output itself.
        flash_driven_verify = [
            p
            for p in emitted
            if p.stage == "verifying" and p.message != "Firmware verification complete"
        ]
        assert len(flash_driven_verify) == 0

    def test_legacy_write_and_verify_passes_produce_correct_stages(self):
        """
        Legacy format with separate Writing.../Verifying...
        passes must produce both stages.
        """
        output = [
            "Writing... (  0%)",
            "Writing... ( 50%)",
            "Writing... (100%)",
            "Verifying... (  0%)",
            "Verifying... ( 50%)",
            "Verifying... (100%)",
            "Starting execution at address 0x08005000",
        ]
        emitted = self._run_pipeline(output)
        stages = {p.stage for p in emitted}
        assert "flashing" in stages
        assert "verifying" in stages

    def test_legacy_sequence_overall_percentage_is_non_decreasing(self):
        """
        End-to-end: legacy write→verify sequence must
        produce monotonically non-decreasing values.
        """
        output = [
            "Writing... (  0%)",
            "Writing... ( 25%)",
            "Writing... ( 50%)",
            "Writing... ( 75%)",
            "Writing... (100%)",
            "Verifying... (  0%)",
            "Verifying... ( 50%)",
            "Verifying... (100%)",
            "Starting execution at address 0x08005000",
        ]
        emitted = self._run_pipeline(output)
        percentages = [p.percentage for p in emitted]
        for i in range(1, len(percentages)):
            assert percentages[i] >= percentages[i - 1] - 0.001, (
                f"Overall percentage went backwards: "
                f"{emitted[i-1].stage}@{percentages[i-1]:.2f} → "
                f"{emitted[i].stage}@{percentages[i]:.2f}"
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
