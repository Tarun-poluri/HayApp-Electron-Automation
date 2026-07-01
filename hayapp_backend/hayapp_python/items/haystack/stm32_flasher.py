"""
STM32 flasher wrapper for firmware upgrades.

Handles execution of stm32flash tool and progress parsing.
"""

import logging
import os
import platform
import re
import subprocess  # nosec B404 - Required for stm32flash execution
import threading
from pathlib import Path
from typing import Callable, Optional

from hayapp_python.common.config_manager import config

FLASH_TIMEOUT = config.haystack.firmware_flash_timeout
TOOLS_DIR = config.haystack.firmware_tools_dir
FLASH_TIMEOUT = config.haystack.firmware_flash_timeout


class STM32FlasherError(Exception):
    """Error during STM32 flashing operation."""

    pass


class STM32Flasher:
    """Wrapper for stm32flash executable."""

    def __init__(self, progress_callback: Optional[Callable[[float], None]] = None):
        """
        Initialize STM32 flasher.

        Args:
            progress_callback: Optional callback for progress updates (0-100)
        """
        self.logger = logging.getLogger(__name__)
        self.progress_callback = progress_callback
        self.process: Optional[subprocess.Popen] = None
        self.is_flashing = False
        self.flash_output = []
        self.lock = threading.Lock()

    def find_stm32flash_binary(self) -> Path:
        """
        Find the appropriate stm32flash binary for the current platform.

        Returns:
            Path to stm32flash executable

        Raises:
            STM32FlasherError: If binary not found
        """
        # Determine platform
        system = platform.system()

        # Get tools directory from config
        tools_dir = Path(TOOLS_DIR)

        # Select binary based on platform
        if system == "Windows":
            binary_name = "stm32flash.exe"
        elif system == "Linux":
            binary_name = "stm32flash"
        elif system == "Darwin":  # macOS
            binary_name = "stm32flash"
        else:
            raise STM32FlasherError(f"Unsupported platform: {system}")

        binary_path = tools_dir / binary_name

        if not binary_path.exists():
            raise STM32FlasherError(
                f"STM32 flash binary not found: {binary_path} "
                f"(looking for {binary_name} in {tools_dir})"
            )

        # Make executable on Unix systems
        if system in ["Linux", "Darwin"]:
            os.chmod(binary_path, 0o755)  # nosec B103 - Needed for binary execution

        return binary_path

    def flash_firmware(
        self,
        firmware_path: str,
        port: str,
        start_address: str = "0x08005000",
        go_address: str = "0x08005000",
        baudrate: int = 115200,
    ) -> bool:
        """
        Flash firmware to STM32 device.

        Args:
            firmware_path: Path to .bin firmware file
            port: Serial port name
            start_address: Flash start address
            go_address: Go/jump address after flashing
            baudrate: Serial baudrate

        Returns:
            True if flashing successful, False otherwise

        Raises:
            STM32FlasherError: If flashing fails
        """
        # Validate firmware file
        fw_path = Path(firmware_path)
        if not fw_path.exists():
            raise STM32FlasherError(f"Firmware file not found: {firmware_path}")

        # Find stm32flash binary
        try:
            stm32flash_binary = self.find_stm32flash_binary()
        except STM32FlasherError as e:
            self.logger.error(f"Failed to find stm32flash binary: {e}")
            raise

        # Build command
        cmd = [
            str(stm32flash_binary),
            "-w",
            str(fw_path),
            "-S",
            start_address,
            "-g",
            go_address,
            "-m",
            "8n1",
            "-b",
            str(baudrate),
            port,
        ]

        self.logger.info(f"Executing stm32flash: {' '.join(cmd)}")

        # Reset state
        with self.lock:
            self.is_flashing = True
            self.flash_output = []

        try:
            # Execute stm32flash
            # Command array validated, shell=False is secure
            self.process = subprocess.Popen(  # nosec
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )

            # Monitor output
            success = self._monitor_flash_process()

            return success

        except subprocess.CalledProcessError as e:
            error_msg = f"stm32flash failed with exit code {e.returncode}"
            self.logger.error(error_msg)
            raise STM32FlasherError(error_msg)

        except Exception as e:
            error_msg = f"Unexpected error during flashing: {e}"
            self.logger.error(error_msg)
            raise STM32FlasherError(error_msg)

        finally:
            with self.lock:
                self.is_flashing = False
                self.process = None

    def _monitor_flash_process(self) -> bool:
        """
        Monitor stm32flash process output and parse progress.

        Returns:
            True if flashing completed successfully, False otherwise
        """
        if not self.process:
            return False

        success = False

        try:
            # Read output line by line
            for line in self.process.stdout:
                line = line.strip()
                if line:
                    self.logger.debug(f"stm32flash: {line}")
                    self.flash_output.append(line)

                    # Parse progress from output
                    self._parse_progress_line(line)

                    # Check for completion
                    if "Starting execution at address" in line:
                        success = True

            # Wait for process to complete
            return_code = self.process.wait(timeout=FLASH_TIMEOUT)

            if return_code != 0:
                self.logger.error(f"stm32flash exited with code {return_code}")
                return False

            return success

        except subprocess.TimeoutExpired:
            self.logger.error("stm32flash timeout")
            if self.process:
                self.process.kill()
            return False

        except Exception as e:
            self.logger.error(f"Error monitoring flash process: {e}")
            return False

    def _parse_progress_line(self, line: str):
        """
        Parse progress from stm32flash output line.

        Args:
            line: Output line from stm32flash
        """
        # Look for percentage patterns.
        # stm32flash outputs vary by version, e.g.:
        #   "Wrote and verified address 0x08005000 ( 2.00%)"  ← combined write+verify per block
        #   "Writing... (12%)"                                ← legacy write-only pass
        #   "Verifying... (45%)"                              ← legacy separate verify pass
        # The decimal-aware pattern captures both "2%" and "2.00%".
        match = re.search(r"(\d+(?:\.\d+)?)%", line)
        if match:
            try:
                percentage = float(match.group(1))

                # Determine phase. "Wrote and verified" is a combined write+verify block
                # (treat as write phase). A standalone "Verif" line without "Wrote" signals
                # a dedicated verification pass.
                if "Verif" in line and "Wrote" not in line:
                    # Dedicated verification pass: map to the 80-100 adjusted range
                    adjusted_percentage = 80 + (percentage * 0.2)
                else:
                    # Write, erase, combined write+verify, or unknown — treat as write phase:
                    # map to the 0-80 adjusted range so flash_progress_callback can
                    # distinguish write (≤80) from verify (>80) without ambiguity.
                    adjusted_percentage = percentage * 0.8

                # Call progress callback
                if self.progress_callback:
                    try:
                        self.progress_callback(adjusted_percentage)
                    except Exception as e:
                        self.logger.error(f"Error in progress callback: {e}")

            except ValueError:
                pass

    def cancel_flash(self):
        """Cancel ongoing flash operation."""
        with self.lock:
            if self.process and self.is_flashing:
                self.logger.warning("Cancelling flash operation")
                try:
                    self.process.kill()
                    self.process.wait(timeout=5)
                except Exception as e:
                    self.logger.error(f"Error cancelling flash: {e}")
                finally:
                    self.is_flashing = False
                    self.process = None

    def get_flash_output(self) -> list[str]:
        """
        Get captured flash output.

        Returns:
            List of output lines from stm32flash
        """
        with self.lock:
            return self.flash_output.copy()
