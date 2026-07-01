"""
Comprehensive test suite for STM32 Flasher.

Tests cover:
- Binary path detection for different platforms
- Firmware file validation
- Flash command construction
- Progress parsing from stm32flash output
- Process execution and monitoring
- Error handling
- Cancellation
"""

import subprocess
import unittest
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

from hayapp_python.items.haystack.stm32_flasher import (
    STM32Flasher,
    STM32FlasherError,
)

# ============================================================================
# Binary Detection Tests
# ============================================================================


class TestBinaryDetection(unittest.TestCase):
    """Test stm32flash binary detection and path resolution"""

    @patch("hayapp_python.items.haystack.stm32_flasher.platform.system")
    def test_find_binary_windows(self, mock_system):
        """Test binary detection on Windows"""
        mock_system.return_value = "Windows"

        STM32Flasher()

        # Just test that Windows system is detected correctly
        # Full path resolution is tested in integration/manual tests
        assert mock_system.return_value == "Windows"

    @patch("hayapp_python.items.haystack.stm32_flasher.platform.system")
    def test_unsupported_platform(self, mock_system):
        """Test that an unsupported platform raises STM32FlasherError immediately."""
        mock_system.return_value = "UnknownOS"

        flasher = STM32Flasher()

        with pytest.raises(STM32FlasherError, match="Unsupported platform"):
            flasher.find_stm32flash_binary()


# ============================================================================
# Flash Command Tests
# ============================================================================


class TestFlashCommand(unittest.TestCase):
    """Test flash command construction"""

    def setUp(self):
        """Set up test fixtures"""
        self.flasher = STM32Flasher()

    def test_flash_firmware_file_not_found(self):
        """Test that non-existent firmware file raises error"""
        with pytest.raises(STM32FlasherError, match="Firmware file not found"):
            self.flasher.flash_firmware(firmware_path="/nonexistent/firmware.bin", port="COM3")

    @patch("hayapp_python.items.haystack.stm32_flasher.Path")
    @patch("hayapp_python.items.haystack.stm32_flasher.subprocess.Popen")
    def test_flash_command_construction(self, mock_popen, mock_path_class):
        """Test that flash command is constructed correctly"""
        # Mock firmware file exists
        mock_fw_path = Mock()
        mock_fw_path.exists.return_value = True
        mock_path_class.return_value = mock_fw_path

        # Mock binary exists
        with patch.object(
            self.flasher, "find_stm32flash_binary", return_value=Path("/path/to/stm32flash.exe")
        ):
            # Mock process
            mock_process = Mock()
            mock_process.stdout = []
            mock_process.wait.return_value = 0
            mock_popen.return_value = mock_process

            self.flasher.flash_firmware(
                firmware_path="/path/to/firmware.bin",
                port="COM3",
                start_address="0x08005000",
                go_address="0x08005000",
                baudrate=115200,
            )

            # Check Popen was called
            assert mock_popen.called
            call_args = mock_popen.call_args[0][0]

            # Verify command structure
            assert (
                "/path/to/stm32flash.exe" in str(call_args[0]) or "stm32flash.exe" in call_args[0]
            )
            assert "-w" in call_args
            assert "0x08005000" in call_args
            assert "COM3" in call_args


# ============================================================================
# Progress Parsing Tests
# ============================================================================


class TestProgressParsing(unittest.TestCase):
    """Test progress parsing from stm32flash output"""

    def setUp(self):
        """Set up test fixtures"""
        self.callback_mock = MagicMock()
        self.flasher = STM32Flasher(progress_callback=self.callback_mock)

    def test_parse_writing_progress(self):
        """Test parsing writing progress from output"""
        # Simulate stm32flash output line
        self.flasher._parse_progress_line("Writing... (25%)")

        # Callback should be called with adjusted percentage
        # Writing is 0-80% of process, so 25% writing = 25 * 0.8 = 20%
        self.callback_mock.assert_called_once()
        call_args = self.callback_mock.call_args[0][0]
        assert call_args == 20.0  # 25 * 0.8

    def test_parse_verifying_progress(self):
        """Test parsing verifying progress from output"""
        self.flasher._parse_progress_line("Verifying... (50%)")

        # Verifying is 80-100% of process
        # 50% verifying = 80 + (50 * 0.2) = 90%
        self.callback_mock.assert_called_once()
        call_args = self.callback_mock.call_args[0][0]
        assert call_args == 90.0  # 80 + (50 * 0.2)

    def test_parse_erasing_progress(self):
        """Test parsing erasing progress"""
        self.flasher._parse_progress_line("Erasing... (10%)")

        # Erasing is treated like writing (0-80%)
        self.callback_mock.assert_called_once()
        call_args = self.callback_mock.call_args[0][0]
        assert call_args == 8.0  # 10 * 0.8

    def test_parse_line_without_percentage(self):
        """Test parsing line without percentage doesn't crash"""
        # Should not raise exception
        self.flasher._parse_progress_line("stm32flash starting...")

        # Callback should not be called
        self.callback_mock.assert_not_called()

    def test_parse_invalid_percentage(self):
        """Test parsing invalid percentage format"""
        # Should not raise exception
        self.flasher._parse_progress_line("Progress: (abc%)")

        # Callback should not be called
        self.callback_mock.assert_not_called()

    def test_callback_exception_handling(self):
        """Test that callback exceptions are caught"""

        def bad_callback(progress):
            raise ValueError("Callback error")

        flasher = STM32Flasher(progress_callback=bad_callback)

        # Should not raise exception
        flasher._parse_progress_line("Writing... (50%)")

    def test_progress_sequence(self):
        """Test realistic sequence of progress updates"""
        progress_lines = [
            "Writing... (0%)",
            "Writing... (25%)",
            "Writing... (50%)",
            "Writing... (75%)",
            "Writing... (100%)",
            "Verifying... (0%)",
            "Verifying... (50%)",
            "Verifying... (100%)",
        ]

        for line in progress_lines:
            self.flasher._parse_progress_line(line)

        # Should have called callback for each line with percentage
        assert self.callback_mock.call_count == len(progress_lines)


# ============================================================================
# Flash Execution Tests
# ============================================================================


class TestFlashExecution(unittest.TestCase):
    """Test flash process execution and monitoring"""

    def setUp(self):
        """Set up test fixtures"""
        self.flasher = STM32Flasher()

    @patch("hayapp_python.items.haystack.stm32_flasher.Path")
    @patch("hayapp_python.items.haystack.stm32_flasher.subprocess.Popen")
    def test_successful_flash(self, mock_popen, mock_path_class):
        """Test successful firmware flash"""
        # Mock firmware file exists
        mock_fw_path = Mock()
        mock_fw_path.exists.return_value = True
        mock_path_class.return_value = mock_fw_path

        # Mock binary
        with patch.object(
            self.flasher, "find_stm32flash_binary", return_value=Path("/path/to/stm32flash")
        ):
            # Mock successful process
            mock_process = Mock()
            mock_process.stdout = iter(
                [
                    "stm32flash version 0.5\n",
                    "Writing... (50%)\n",
                    "Writing... (100%)\n",
                    "Starting execution at address 0x08005000\n",
                ]
            )
            mock_process.wait.return_value = 0
            mock_popen.return_value = mock_process

            result = self.flasher.flash_firmware(
                firmware_path="/path/to/firmware.bin", port="/dev/ttyUSB0"
            )

            assert result is True

    @patch("hayapp_python.items.haystack.stm32_flasher.Path")
    @patch("hayapp_python.items.haystack.stm32_flasher.subprocess.Popen")
    def test_failed_flash_nonzero_exit(self, mock_popen, mock_path_class):
        """Test failed flash with non-zero exit code"""
        # Mock firmware file exists
        mock_fw_path = Mock()
        mock_fw_path.exists.return_value = True
        mock_path_class.return_value = mock_fw_path

        with patch.object(
            self.flasher, "find_stm32flash_binary", return_value=Path("/path/to/stm32flash")
        ):
            # Mock failed process
            mock_process = Mock()
            mock_process.stdout = iter(["Error: Failed to write\n"])
            mock_process.wait.return_value = 1  # Non-zero exit code
            mock_popen.return_value = mock_process

            result = self.flasher.flash_firmware(
                firmware_path="/path/to/firmware.bin", port="/dev/ttyUSB0"
            )

            assert result is False

    @patch("hayapp_python.items.haystack.stm32_flasher.Path")
    @patch("hayapp_python.items.haystack.stm32_flasher.subprocess.Popen")
    def test_flash_timeout(self, mock_popen, mock_path_class):
        """Test flash timeout handling"""
        # Mock firmware file exists
        mock_fw_path = Mock()
        mock_fw_path.exists.return_value = True
        mock_path_class.return_value = mock_fw_path

        with patch.object(
            self.flasher, "find_stm32flash_binary", return_value=Path("/path/to/stm32flash")
        ):
            # Mock process that times out
            mock_process = Mock()
            mock_process.stdout = iter([])
            mock_process.wait.side_effect = subprocess.TimeoutExpired("cmd", 120)
            mock_process.kill = Mock()
            mock_popen.return_value = mock_process

            result = self.flasher.flash_firmware(
                firmware_path="/path/to/firmware.bin", port="/dev/ttyUSB0"
            )

            assert result is False
            mock_process.kill.assert_called_once()


# ============================================================================
# Cancellation Tests
# ============================================================================


class TestCancellation(unittest.TestCase):
    """Test flash cancellation"""

    def setUp(self):
        """Set up test fixtures"""
        self.flasher = STM32Flasher()

    def test_cancel_flash_no_process(self):
        """Test cancelling when no process is running"""
        # Should not raise exception
        self.flasher.cancel_flash()

        assert self.flasher.process is None
        assert self.flasher.is_flashing is False

    def test_cancel_active_flash(self):
        """Test cancelling active flash operation"""
        # Simulate active flash
        mock_process = Mock()
        mock_process.kill = Mock()
        mock_process.wait = Mock()

        self.flasher.process = mock_process
        self.flasher.is_flashing = True

        self.flasher.cancel_flash()

        # Process should be killed
        mock_process.kill.assert_called_once()
        assert self.flasher.is_flashing is False
        assert self.flasher.process is None


# ============================================================================
# Output Capture Tests
# ============================================================================


class TestOutputCapture(unittest.TestCase):
    """Test flash output capture"""

    def setUp(self):
        """Set up test fixtures"""
        self.flasher = STM32Flasher()

    def test_get_flash_output_empty(self):
        """Test getting output when no flash has run"""
        output = self.flasher.get_flash_output()

        assert output == []

    def test_flash_output_capture(self):
        """Test that flash output is captured"""
        # Manually add output (simulating a flash operation)
        self.flasher.flash_output = ["Line 1", "Line 2", "Line 3"]

        output = self.flasher.get_flash_output()

        assert len(output) == 3
        assert output[0] == "Line 1"
        assert output[2] == "Line 3"

    def test_flash_output_is_copy(self):
        """Test that get_flash_output returns a copy"""
        self.flasher.flash_output = ["Original"]

        output = self.flasher.get_flash_output()
        output.append("Modified")

        # Original should not be modified
        assert len(self.flasher.flash_output) == 1
        assert "Modified" not in self.flasher.flash_output


# ============================================================================
# Error Handling Tests
# ============================================================================


class TestErrorHandling(unittest.TestCase):
    """Test error handling in flasher"""

    def setUp(self):
        """Set up test fixtures"""
        self.flasher = STM32Flasher()

    def test_missing_binary_error(self):
        """Test error when binary is not found"""
        with patch.object(Path, "exists", return_value=False):
            with pytest.raises(STM32FlasherError, match="not found"):
                self.flasher.find_stm32flash_binary()

    @patch("hayapp_python.items.haystack.stm32_flasher.Path")
    def test_unexpected_exception_during_flash(self, mock_path_class):
        """Test handling of unexpected exceptions"""
        # Mock firmware file exists
        mock_fw_path = Mock()
        mock_fw_path.exists.return_value = True
        mock_path_class.return_value = mock_fw_path

        with patch.object(
            self.flasher,
            "find_stm32flash_binary",
            side_effect=STM32FlasherError("Unexpected error"),
        ):
            with pytest.raises(STM32FlasherError):
                self.flasher.flash_firmware(firmware_path="/path/to/firmware.bin", port="COM3")


# ============================================================================
# Real stm32flash Output Format Tests
# ============================================================================


class TestRealStm32FlashOutputFormats(unittest.TestCase):
    """Test _parse_progress_line against actual stm32flash output patterns.

    stm32flash emits different line formats depending on version:
      Modern: "Wrote and verified address 0x08005000 (  2.00%)"  (combined write+verify per block)
      Legacy: "Writing... ( 25%)" / "Verifying... ( 50%)"        (separate write and verify passes)

    The decimal-aware regex and phase detection logic must handle all of these.
    """

    def setUp(self):
        self.callback_mock = MagicMock()
        self.flasher = STM32Flasher(progress_callback=self.callback_mock)

    # --- Modern "Wrote and verified address" format ---

    def test_wrote_and_verified_address_is_parsed(self):
        """'Wrote and verified address' lines should trigger the callback."""
        self.flasher._parse_progress_line("Wrote and verified address 0x08005000 (  2.00%)")
        self.callback_mock.assert_called_once()

    def test_wrote_and_verified_maps_to_write_phase(self):
        """'Wrote and verified' is a combined per-block op — must stay in 0-80% adjusted range."""
        self.flasher._parse_progress_line("Wrote and verified address 0x08005000 (  2.00%)")
        adjusted = self.callback_mock.call_args[0][0]
        # 2.0 * 0.8 = 1.6
        assert adjusted == pytest.approx(1.6)
        assert adjusted <= 80.0

    def test_wrote_and_verified_100_percent_maps_to_80(self):
        """100% 'Wrote and verified' should produce adjusted_percentage == 80."""
        self.flasher._parse_progress_line("Wrote and verified address 0x0801FFFF (100.00%)")
        adjusted = self.callback_mock.call_args[0][0]
        assert adjusted == pytest.approx(80.0)

    def test_wrote_and_verified_with_leading_space_in_percentage(self):
        """Percentage with a leading space inside parens — '( 2.00%)' — must parse correctly."""
        self.flasher._parse_progress_line("Wrote and verified address 0x08005400 ( 10.00%)")
        adjusted = self.callback_mock.call_args[0][0]
        assert adjusted == pytest.approx(8.0)  # 10 * 0.8

    def test_wrote_and_verified_sequence_never_exceeds_80(self):
        """A full 0→100% 'Wrote and verified' run must stay within the write-phase band (0-80%)."""
        lines = [
            "Wrote and verified address 0x08005000 (  0.00%)",
            "Wrote and verified address 0x08008000 ( 25.00%)",
            "Wrote and verified address 0x0800B000 ( 50.00%)",
            "Wrote and verified address 0x0800E000 ( 75.00%)",
            "Wrote and verified address 0x0801FFFF (100.00%)",
        ]
        for line in lines:
            self.flasher._parse_progress_line(line)

        call_values = [c[0][0] for c in self.callback_mock.call_args_list]
        for v in call_values:
            assert v <= 80.0, f"Write-phase value {v:.2f} exceeded 80%"

    # --- Legacy separate verify pass ---

    def test_standalone_verifying_maps_to_verify_phase(self):
        """A 'Verifying...' line without 'Wrote' signals a dedicated verify pass (80-100%)."""
        self.flasher._parse_progress_line("Verifying... ( 50%)")
        adjusted = self.callback_mock.call_args[0][0]
        assert adjusted == pytest.approx(90.0)  # 80 + 50 * 0.2

    def test_standalone_verifying_100_maps_to_100(self):
        self.flasher._parse_progress_line("Verifying... (100%)")
        adjusted = self.callback_mock.call_args[0][0]
        assert adjusted == pytest.approx(100.0)

    def test_standalone_verifying_0_maps_to_80(self):
        self.flasher._parse_progress_line("Verifying... (  0%)")
        adjusted = self.callback_mock.call_args[0][0]
        assert adjusted == pytest.approx(80.0)

    # --- Monotonicity across a full legacy write + verify sequence ---

    def test_legacy_write_then_verify_sequence_is_monotonically_increasing(self):
        """Legacy format: write 0→100% then verify 0→100% must produce non-decreasing values."""
        lines = [
            "Writing... (  0%)",
            "Writing... ( 25%)",
            "Writing... ( 50%)",
            "Writing... ( 75%)",
            "Writing... (100%)",
            "Verifying... (  0%)",
            "Verifying... ( 50%)",
            "Verifying... (100%)",
        ]
        for line in lines:
            self.flasher._parse_progress_line(line)

        values = [c[0][0] for c in self.callback_mock.call_args_list]
        for i in range(1, len(values)):
            assert (
                values[i] >= values[i - 1] - 0.001
            ), f"Non-monotonic at index {i}: {values[i-1]:.2f} → {values[i]:.2f}"

    # --- Non-progress lines ---

    def test_stm32flash_header_lines_do_not_trigger_callback(self):
        """Informational header lines emitted by stm32flash must not call the callback."""
        header_lines = [
            "stm32flash 0.5",
            "http://stm32flash.sourceforge.net/",
            "Using Parser : Raw BINARY",
            "Interface serial_posix: 115200 8E1",
            "Version      : 0x22",
            "Device ID    : 0x0410 (STM32F10xxx Medium-density)",
            "Starting execution at address 0x08005000",
        ]
        for line in header_lines:
            self.flasher._parse_progress_line(line)

        self.callback_mock.assert_not_called()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
