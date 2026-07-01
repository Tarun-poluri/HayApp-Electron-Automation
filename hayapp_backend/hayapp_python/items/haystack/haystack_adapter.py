# -*- coding: utf-8 -*-
import json
import logging
import threading
import time
from dataclasses import asdict
from pathlib import Path
from typing import Callable, Optional

from parlay import ParlayCommandItem, ParlayProperty, local_item, parlay_command
from pydantic import BaseModel, Field

from hayapp_python.common.config_manager import config
from hayapp_python.common.defs import HayStack_item as item
from hayapp_python.common.defs import HayStackError
from hayapp_python.common.events import (
    ErrorEvent,
    HaystackConnectionEvent,
    HaystackPostStatusEvent,
    TimerDepositReadyEvent,
    TimerNeedleDepositedEvent,
    TimerNeedleMovedToImagingEvent,
    TimerNeedleMovedToSharpsEvent,
)
from hayapp_python.common.parlay_mixin import ThreadSafePublishMixin
from hayapp_python.common.utils import find_in_enum
from hayapp_python.items.haystack.firmware_progress import FirmwareUpgradeProgress
from hayapp_python.items.haystack.firmware_updater import (
    FirmwareUpdateError,
    FirmwareUpdater,
)
from hayapp_python.items.haystack.haystack_interface import (
    AsyncCommand,
    BtnIndicatorCommand,
    ButtonLed,
)
from hayapp_python.items.haystack.haystack_interface import (
    EventType as HaystackEventType,
)
from hayapp_python.items.haystack.haystack_interface import (
    GetCommand,
    HaystackButton,
    HaystackInterface,
    IlluminatorCommand,
    ImageCommand,
    ImageStatus,
    IndicateCommand,
    Led,
    LedCommand,
    ResetCommand,
    SetCommand,
    SetPhaseCommand,
)
from hayapp_python.items.haystack.haystack_status import HayStackStatus


class FirmwareUpgradeResponse(BaseModel):
    """Response from firmware upgrade operation."""

    success: bool = Field(..., description="Whether the upgrade was successful")
    message: Optional[str] = Field(None, description="Success message")
    error: Optional[str] = Field(None, description="Error message if failed")
    new_version: Optional[str] = Field(None, description="New firmware version after upgrade")


@local_item()
class HayStack(ThreadSafePublishMixin, ParlayCommandItem):
    """
    test_property = ParlayProperty (default="Boo", read_only=True)
    """

    __version__: str = "0.0.1"

    id = ParlayProperty(default="", val_type=str, read_only=True)
    version = ParlayProperty(default="", val_type=str, read_only=True)
    hw_version = ParlayProperty(default="", val_type=str, read_only=True)
    needle_number = ParlayProperty(default=1, val_type=int, read_only=True)
    last_error = ParlayProperty(default=0, val_type=int, read_only=True)
    is_connected = ParlayProperty(default=False, val_type=bool, read_only=False)
    post_status = ParlayProperty(default=False, val_type=bool, read_only=True)

    # Status structure properties
    status_change = ParlayProperty(default=False, val_type=bool, read_only=True)
    status_tray = ParlayProperty(default=False, val_type=bool, read_only=True)
    status_ready = ParlayProperty(default=False, val_type=bool, read_only=True)
    status_magnet_error = ParlayProperty(default=False, val_type=bool, read_only=True)
    status_error = ParlayProperty(default=False, val_type=bool, read_only=True)
    status_error_value = ParlayProperty(default=0, val_type=int, read_only=True)
    status_btn1_led = ParlayProperty(default=False, val_type=bool, read_only=True)
    status_btn2_led = ParlayProperty(default=False, val_type=bool, read_only=True)
    status_btn3_led = ParlayProperty(default=False, val_type=bool, read_only=True)
    status_btn4_led = ParlayProperty(default=False, val_type=bool, read_only=True)
    status_hex = ParlayProperty(default="00000000", val_type=str, read_only=True)

    def __init__(self, item_id=item.id, name=item.name, interface: HaystackInterface = None):
        ParlayCommandItem.__init__(self, item_id=item_id, name=name)
        self.interface: HaystackInterface = interface(self.message_handler)

        if hasattr(self.interface, "disconnect_callback"):
            self.interface.disconnect_callback = self._handle_disconnect

        # Initialize status structure
        self.status = HayStackStatus()

        # Heartbeat monitoring
        self.logger = logging.getLogger("hayapp")
        self.heartbeat_thread: Optional[threading.Thread] = None
        self.should_monitor_heartbeat = False
        self.heartbeat_interval = config.haystack.heartbeat_interval  # seconds
        self.heartbeat_timeout = config.haystack.heartbeat_timeout  # seconds
        self.last_heartbeat_time = 0.0
        self.heartbeat_lock = threading.Lock()

        # Port monitoring
        self.port_monitoring_thread: Optional[threading.Thread] = None
        self.should_monitor_ports = False
        self.port_monitoring_interval = config.haystack.port_monitoring_timeout  # seconds
        self._device_startup_wait = 8.0  # seconds to wait for device after discovery
        self._port_stop_event = threading.Event()
        self._heartbeat_stop_event = threading.Event()

        self.disconnect_callback: Optional[Callable] = None

        # Firmware upgrade tracking
        self.current_firmware_updater: Optional[FirmwareUpdater] = None
        self.firmware_upgrade_in_progress = False
        self._last_upgrade_progress: Optional[FirmwareUpgradeProgress] = None
        self._upgrade_state_lock = threading.Lock()

        # Camera calibration GET response storage (thread-safe)
        self._calibration_lock = threading.Lock()
        self._cam_mtx_data: Optional[list] = None
        self._cam_dist_data: Optional[list] = None
        self._cam_mtx_event = threading.Event()
        self._cam_dist_event = threading.Event()

        self._init_lock = threading.Lock()
        self._init_id: Optional[str] = None
        self._init_event = threading.Event()
        self._init_cancel = threading.Event()

        self._post_lock = threading.Lock()
        self._post_event = threading.Event()
        self._post_success: Optional[bool] = None

        self._disconnect_lock = threading.Lock()

        # Timestamps for exec_ms calculations on motor-move timer events
        self._deposit_pressed_time: Optional[float] = None
        self._imaging_done_time: Optional[float] = None
        self._mdone_time: Optional[float] = None

        # Auto connect to the first Haystack device found
        self.start_port_monitoring()

    # ###############################################################################
    # Process messages received from the Haystack
    # ###############################################################################

    def message_handler(self, cmd: str, params: list):  # noqa: C901 (ignore complexity)
        """
        transport callback to process message received from Haystack
        :param cmd: string for the command type
        :param params: list or command arguments
        :return: None
        """
        if not (command := find_in_enum(AsyncCommand, cmd)):
            print(f"Unknown command received: {cmd}, params: {params}")
            return

        if command == AsyncCommand.EVENT.value:
            self._handle_event(params)
        elif command == AsyncCommand.ERROR.value:
            self._handle_error(params[0])
        elif command == AsyncCommand.IMAGE.value:
            self._handle_image_event(params)
        elif command == AsyncCommand.HEARTBEAT.value:
            self._handle_heartbeat(params[0])
        elif command == AsyncCommand.HAYSTACK_ID.value:
            self._handle_stack_id(params[0])
        elif command == AsyncCommand.VERSION.value:
            self._handle_version(params[0])
        elif command == AsyncCommand.STATUS.value:
            self._handle_heartbeat(params[0])
        elif command == AsyncCommand.BLUETOOTH.value:
            pass  # Ignore Bluetooth messages
        elif command == AsyncCommand.HW_VERSION.value:
            self._handle_hw_version(params[0])
        elif command == AsyncCommand.CAM_MTX.value:
            self._handle_cam_mtx(params)
        elif command == AsyncCommand.CAM_DIST.value:
            self._handle_cam_dist(params)
        elif command == AsyncCommand.ACK.value:
            pass  # ACK messages handled synchronously by send_command
        elif command == AsyncCommand.INIT.value:
            pass  # INIT not consistently given, ignore
        elif command == AsyncCommand.DEBUG.value:
            self.logger.debug(f"DEBUG command received: {cmd}, params: {params}")
        else:
            self.logger.warning(f"Unhandled command received: {cmd}, params: {params}")

    def _handle_init(self, haystack_id: str):
        self.id = haystack_id

    def _handle_error(self, error: str):
        """Handle error messages received from Haystack."""
        self.logger.info(f"[HAYSTACK_ADAPTER] _handle_error called with error: {error}")
        if error_code := find_in_enum(HayStackError, error):
            self.last_error = error_code
            self.logger.error(f"Error: {error}")
        else:
            self.logger.error(f"Unknown error: {error}")
            self.last_error = ""
        if error_code == HayStackError.NOT_READY.value:
            return  # TODO: Remove, ignore NOT_READY errors for now
        self.send_event(**ErrorEvent(title="Haystack Error", msg=error).to_event())

    def _handle_version(self, version: str):
        """Handle version messages received from Haystack."""
        self.version = version

    def _handle_hw_version(self, hw_version: str):
        """Handle HW version messages received from Haystack."""
        self.hw_version = hw_version

    def _handle_stack_id(self, stack_id: str):
        """Handle stack ID messages received from Haystack."""
        self.id = stack_id
        with self._init_lock:
            if self._init_id != stack_id and self._init_id is not None:
                self.logger.warning(f"Stack ID mismatch: Old ID: {self.id}, New ID: {stack_id}")
            self._init_event.set()

    def _handle_cam_mtx(self, params: list):
        """Store camera matrix data from GET CAM_MTX response (9 floats)."""
        try:
            values = [float(p) for p in params]
            if len(values) != 9:
                self.logger.warning(f"CAM_MTX expected 9 values, got {len(values)}")
                return
            with self._calibration_lock:
                self._cam_mtx_data = values
            self._cam_mtx_event.set()
        except (ValueError, TypeError) as e:
            self.logger.warning(f"Failed to parse CAM_MTX params: {e}")

    def _handle_cam_dist(self, params: list):
        """Store distortion coefficients from GET CAM_DIST response (5 floats)."""
        try:
            values = [float(p) for p in params]
            if len(values) != 5:
                self.logger.warning(f"CAM_DIST expected 5 values, got {len(values)}")
                return
            with self._calibration_lock:
                self._cam_dist_data = values
            self._cam_dist_event.set()
        except (ValueError, TypeError) as e:
            self.logger.warning(f"Failed to parse CAM_DIST params: {e}")

    def _handle_heartbeat(self, hex_status: str):
        """Handle heartbeat with status parsing."""
        # Update heartbeat timestamp
        with self.heartbeat_lock:
            self.last_heartbeat_time = time.time()
            self.logger.debug(f"Updated heartbeat timestamp to {self.last_heartbeat_time}")

        # Parse the status from hex string
        self.status = HayStackStatus.from_hex_string(hex_status)

        # Update individual properties
        self.status_change = self.status.chg
        self.status_tray = self.status.hc
        self.status_ready = self.status.rdy
        self.status_magnet_error = self.status.magnet_error
        self.status_error = self.status.error
        self.status_error_value = self.status.error_value
        self.status_btn1_led = self.status.btn1_led
        self.status_btn2_led = self.status.btn2_led
        self.status_btn3_led = self.status.btn3_led
        self.status_btn4_led = self.status.btn4_led
        self.status_hex = hex_status

    def _on_deposit_button_event(self, event: str) -> None:
        """
        Handle a deposit button press (hardware BTN_PRESS* or mock_deposit_button).

        :param event: Haystack event string, e.g. BTN_PRESS, BTN_PRESS_1, BTN_PRESS_2
        """
        print(f"Deposit button pressed: {event}")
        self._deposit_pressed_time = time.time()
        payload = (
            "deposit_1"
            if event == HaystackEventType.BTN_PRESS_1.value
            else "deposit_2" if event == HaystackEventType.BTN_PRESS_2.value else "deposit"
        )
        self.send_event(f'{{"button":"{payload}"}}', "stack_button", None)
        self.send_event(**TimerNeedleDepositedEvent().to_event())

    def _handle_event(self, params: list):
        """
        process event messages received from Haystack
        :param params: list of event params; params[0] is the event name
        :return:
        """
        event = params[0].strip() if params else ""
        if (
            event == HaystackEventType.BTN_PRESS.value
            or event == HaystackEventType.BTN_PRESS_1.value
            or event == HaystackEventType.BTN_PRESS_2.value
        ):
            self._on_deposit_button_event(event)

        elif event == HaystackEventType.READY_WITH_TRAY.value:
            deposit_ready_exec_ms = (
                (time.time() - self._mdone_time) * 1000 if self._mdone_time is not None else None
            )
            self.send_event('{"event":"deposit_ready"}', "stack_needle", None)
            self.send_event(
                **TimerDepositReadyEvent(execution_duration_ms=deposit_ready_exec_ms).to_event()
            )
            self.interface.status_command()

        elif event == HaystackEventType.READY_NO_TRAY.value:
            self.send_event('{"event":"deposit_no_tray"}', "stack_needle", None)
            self.send_event('{"event":"removed"}', "stack_tray", None)

        elif event == HaystackEventType.TRAY_INSERTED.value:
            self.send_event('{"event":"inserted"}', "stack_tray", None)
            self.interface.status_command()

        elif event == HaystackEventType.TRAY_REMOVED.value:
            print("Tray was REMOVED")
            self.send_event('{"event":"removed"}', "stack_tray", None)
            self.interface.status_command()

        elif event == HaystackEventType.BTN_LED1_PRESSED.value:
            print("YES button pressed")
            self.send_event('{"button":"yes"}', "stack_button", None)

        elif event == HaystackEventType.BTN_LED2_PRESSED.value:
            print("VALIDATE button pressed")
            self.send_event('{"button":"validate"}', "stack_button", None)

        elif event == HaystackEventType.BTN_LED3_PRESSED.value:
            print("TAKE ACTION button pressed")
            self.send_event('{"button":"take_action"}', "stack_button", None)

        elif event == HaystackEventType.BTN_LED4_PRESSED.value:
            print("NO button pressed")
            self.send_event('{"button":"no"}', "stack_button", None)

        elif (
            event == HaystackEventType.POST_SUCCESS.value
            or event == HaystackEventType.POST_FAIL.value
        ):
            self.post_status = event == HaystackEventType.POST_SUCCESS.value
            with self._post_lock:
                self._post_success = self.post_status
                self._post_event.set()
            status_byte = 0x0F if self.post_status else 0x00
            self.send_event(**HaystackPostStatusEvent(status_byte).to_event())

        elif event == HaystackEventType.POST_RESULT.value:
            status_hex = params[1].strip() if len(params) > 1 else "00"
            self._handle_post_status(status_hex)

        else:
            self.logger.warning(f"Unknown event received: {event}")

    def _handle_post_status(self, status_hex: str):
        """Handle POST_STATUS event with bit-field status byte."""
        try:
            status_byte = int(status_hex, 16)
        except ValueError:
            self.logger.warning(f"_handle_post_status: invalid hex value: {status_hex!r}")
            status_byte = 0
        post_event = HaystackPostStatusEvent(status_byte)
        self.post_status = post_event.all_passed
        if not self.post_status:
            self.logger.error(f"POST failed: {post_event.info}")
        with self._post_lock:
            self._post_success = post_event.all_passed
            self._post_event.set()
        self.send_event(**post_event.to_event())

    def _handle_image_event(self, event: list):
        """
        process image events received from Haystack
        :param event: image parameters as a list of strings
        :return:
        """
        # update the needle number reported by Haystack FIRST, before processing the event
        # This ensures event handlers see the correct needle number
        if len(event) > 1:
            num = int(event[0])
            if self.needle_number != num:
                print(f"[DEBUG] Device reports needle {num}, updating from {self.needle_number}")
                self.needle_number = num

        if event[-1] == ImageStatus.MOVED.value:
            print("Needle deposited into sharps container")
            moved_exec_ms = (
                (time.time() - self._imaging_done_time) * 1000
                if self._imaging_done_time is not None
                else None
            )
            self.send_event(
                **TimerNeedleMovedToSharpsEvent(execution_duration_ms=moved_exec_ms).to_event()
            )
            self.send_event('{"event":"moved_to_sharps"}', "stack_needle", None)

        elif event[-1] == ImageStatus.READY.value:
            print("Haystack ready to start imaging")
            imaging_exec_ms = (
                (time.time() - self._deposit_pressed_time) * 1000
                if self._deposit_pressed_time is not None
                else None
            )
            self.send_event(
                **TimerNeedleMovedToImagingEvent(execution_duration_ms=imaging_exec_ms).to_event()
            )
            self.send_event('{"event":"imaging_ready"}', "stack_needle", None)
        else:
            print(f"Unknown image event: {event}")

    # ###############################################################################
    # Heartbeat & Port Monitoring
    # ###############################################################################

    def start_thread(
        self, thread: Optional[threading.Thread], target: Callable, daemon: bool = True
    ) -> Optional[threading.Thread]:
        """Start a background thread."""
        if not thread:
            thread = threading.Thread(target=target, daemon=daemon)
            thread.start()
            self.logger.info(f"Started thread {thread.name}")
        return thread

    def stop_thread(self, thread: Optional[threading.Thread]) -> Optional[threading.Thread]:
        """Stop a background thread."""
        if thread:
            thread.join(timeout=1.0)
            self.logger.info(f"Stopped thread {thread.name}")
            thread = None
        return thread

    def start_heartbeat_monitoring(self):
        """Start the background heartbeat monitoring thread."""
        if self.is_connected:
            self.should_monitor_heartbeat = True
            self.last_heartbeat_time = time.time()
            self.heartbeat_thread = self.start_thread(
                self.heartbeat_thread, self._monitor_heartbeat, True
            )

    def stop_heartbeat_monitoring(self):
        """Stop the background heartbeat monitoring thread."""
        self.should_monitor_heartbeat = False
        self._heartbeat_stop_event.set()
        self.heartbeat_thread = self.stop_thread(self.heartbeat_thread)
        self._heartbeat_stop_event.clear()

    def start_port_monitoring(self):
        """Start the background port monitoring thread."""
        if not self.port_monitoring_thread:
            self.should_monitor_ports = True
            self.port_monitoring_thread = self.start_thread(
                self.port_monitoring_thread, self._monitor_ports, True
            )

    def stop_port_monitoring(self):
        """Stop the background port monitoring thread."""
        self.should_monitor_ports = False
        self._port_stop_event.set()
        # Signal any in-flight connect() to abort so the thread exits quickly
        # rather than blocking for the full 5-second stack-ID wait.
        self._init_cancel.set()
        self.port_monitoring_thread = self.stop_thread(self.port_monitoring_thread)
        self._init_cancel.clear()
        self._port_stop_event.clear()

    def _monitor_heartbeat(self):
        """Background thread to monitor heartbeat and detect connection issues."""
        while self.should_monitor_heartbeat:
            try:
                current_time = time.time()

                # Check if we've received a heartbeat recently
                with self.heartbeat_lock:
                    time_since_last_heartbeat = current_time - self.last_heartbeat_time

                # If no heartbeat received within timeout period, disconnect
                if time_since_last_heartbeat > self.heartbeat_timeout:
                    self.logger.warning(
                        f"No heartbeat received for {time_since_last_heartbeat:.1f} seconds, "
                        "disconnecting"
                    )
                    self._handle_disconnect("Heartbeat timeout - no response from device")
                    break

                # # Send heartbeat request
                # if self.is_connected and hasattr(self.interface, 'send_command'):
                #     self.interface.send_command(Command.STATUS.value)
                #     self.logger.debug("Sent heartbeat request")

                if self._heartbeat_stop_event.wait(timeout=self.heartbeat_interval):
                    break

            except Exception as e:
                self.logger.error(f"Unexpected error in heartbeat monitoring: {str(e)}")
                if self.should_monitor_heartbeat:
                    if self._heartbeat_stop_event.wait(timeout=1.0):
                        break

    def _monitor_ports(self):
        """Background thread to monitor ports and detect connection issues."""
        while self.should_monitor_ports:
            if self._port_stop_event.wait(timeout=self.port_monitoring_interval):
                break
            haystack_ports = self.scan_ports()
            if len(haystack_ports) == 0:
                if self.is_connected:
                    self.logger.warning("No Haystack devices found")
                    self._handle_disconnect(
                        "[Port Monitoring] No Haystack devices found, disconnecting"
                    )
            else:
                # Wait for device to fully come up before connecting.
                time.sleep(self._device_startup_wait)
                if self._port_stop_event.is_set():
                    break
                self.connect(haystack_ports[0])

    def _handle_disconnect(self, error_msg: str = None):
        """Handle a disconnect event."""
        self.logger.error(f"Disconnect event: {error_msg}")
        self.disconnect()

    def set_heartbeat_config(self, interval: float = None, timeout: float = None):
        """
        Configure heartbeat monitoring parameters.

        Args:
            interval: Heartbeat request interval in seconds (default: 10.0)
            timeout: Heartbeat timeout in seconds (default: 15.0)
        """
        if interval is not None and interval > 0:
            self.heartbeat_interval = interval
            self.logger.info(f"Heartbeat interval set to {interval} seconds")

        if timeout is not None and timeout > 0:
            self.heartbeat_timeout = timeout
            self.logger.info(f"Heartbeat timeout set to {timeout} seconds")

        # Ensure timeout is greater than interval
        if self.heartbeat_timeout <= self.heartbeat_interval:
            self.heartbeat_timeout = self.heartbeat_interval + 5.0
            self.logger.warning(
                f"Adjusted heartbeat timeout to {self.heartbeat_timeout} seconds "
                "(must be > interval)"
            )

    def get_heartbeat_status(self) -> dict:
        """
        Get current heartbeat monitoring status.

        Returns:
            Dictionary with heartbeat status information
        """
        with self.heartbeat_lock:
            time_since_last_heartbeat = time.time() - self.last_heartbeat_time

        return {
            "is_monitoring": self.should_monitor_heartbeat,
            "thread_alive": self.heartbeat_thread.is_alive() if self.heartbeat_thread else False,
            "last_heartbeat_time": self.last_heartbeat_time,
            "time_since_last_heartbeat": time_since_last_heartbeat,
            "interval": self.heartbeat_interval,
            "timeout": self.heartbeat_timeout,
            "is_timeout": time_since_last_heartbeat > self.heartbeat_timeout,
        }

    @parlay_command()
    def get_camera_calibration(
        self, timeout_sec: float = 2.0
    ) -> Optional[dict[str, Optional[list[float]]]]:
        """
        Request camera matrix and distortion coefficients from Haystack, wait for
        both GET CAM_MTX and GET CAM_DIST responses, and return opencv-matrix structures.

        Returns:
            Dict with keys camera_matrix and distortion_coefficients (each opencv-matrix
            shape), or None on timeout or invalid data.
        """
        with self._calibration_lock:
            self._cam_mtx_data = None
            self._cam_dist_data = None
        self._cam_mtx_event.clear()
        self._cam_dist_event.clear()

        self.interface.get_command(GetCommand.CAM_MTX.value)
        self.interface.get_command(GetCommand.CAM_DIST.value)

        if not self._cam_mtx_event.wait(timeout=timeout_sec):
            self.logger.warning("get_camera_calibration: timeout waiting for CAM_MTX")
        if not self._cam_dist_event.wait(timeout=timeout_sec):
            self.logger.warning("get_camera_calibration: timeout waiting for CAM_DIST")

        with self._calibration_lock:
            mtx = self._cam_mtx_data
            dist = self._cam_dist_data
        return {"camera_matrix": mtx, "distortion_coefficients": dist}

    # ###############################################################################
    # Parlay commands to send to the Haystack
    # ###############################################################################

    @parlay_command()
    def connect(self, port: str):
        """
        Connect to the HayStack.
        :param port: Port string
        :return: True if connected successfully, False otherwise
        """
        new_haystack = False
        if not self.is_connected and self.interface.connect(port):
            self.logger.info(f"Attempting to connect to Haystack device on port {port}")
            self._init_event.clear()
            self.interface.get_command(GetCommand.STACK_ID.value)
            deadline = time.monotonic() + 5.0
            while not self._init_event.wait(timeout=0.1):
                if self._init_cancel.is_set():
                    self.logger.info("connect() aborted by cancellation signal")
                    self.disconnect()
                    return False
                if time.monotonic() >= deadline:
                    break
            if not self._init_event.is_set():
                self.logger.error("Timeout waiting for stack ID")
                self.send_event(
                    **ErrorEvent(
                        title="Haystack Connection Error",
                        msg="Haystack connection timed out, no response from Haystack",
                    ).to_event()
                )
                self.disconnect()
                return False
            with self._init_lock:
                if not self._init_id or self._init_id != self.id:
                    self._init_id = self.id
                    new_haystack = True
            self.interface.get_command(GetCommand.VERSION.value)
            self.interface.get_command(GetCommand.HW_VERSION.value)
            self.interface.status_command()
            self.set_needle_count(self.needle_number)
            self.is_connected = True
            self.start_heartbeat_monitoring()
            self.send_event(
                **HaystackConnectionEvent(
                    connected=self.is_connected, new_haystack=new_haystack
                ).to_event()
            )
            self.logger.info(
                f"Connected to Haystack device with ID {self.id} on port {port}, "
                f"haystack version {self.version}, "
                f"hw version {self.hw_version}, "
                f"needle number {self.needle_number}"
            )
        return self.is_connected

    @parlay_command()
    def disconnect(self):
        """
        Disconnect from the HayStack.
        :return: True if disconnected successfully, False otherwise
        """
        with self._disconnect_lock:
            if not self.is_connected:
                return False
            self.is_connected = False

        self.stop_heartbeat_monitoring()
        if hasattr(self.interface, "disconnect"):
            try:
                self.interface.disconnect()
                self.send_event(**HaystackConnectionEvent(connected=False).to_event())
                return True
            except Exception as e:
                self.logger.error(f"Error disconnecting: {str(e)}")
                return False
        return False

    @parlay_command()
    def set_state(self, state: SetCommand | str):
        """
        After a connection to Haystack has been established, it should be
        set to the READY state.
        :param state:
        :return:
        """
        return self.interface.set_command(state)

    @parlay_command()
    def imaging_complete(self):
        """
        After receiving stack_needle,imaging_ready event, capture
        and process the image. When done, send this command to Haystack.
        :return:
        """
        print(f"Send needle imaging complete for needle {self.needle_number}")
        self._imaging_done_time = time.time()
        return self.interface.image_command(ImageCommand.DONE.value, self.needle_number)

    @parlay_command()
    def prepare_next_deposit(self):
        """
        After receiving stack_needle,moved_to_sharps event, send
        this command to prepare Haystack to receive next needle.
        stack_needle,deposit_* will be received when ready.
        :return:
        """
        print(f"Sending MDONE for needle {self.needle_number}")
        self._mdone_time = time.time()
        return self.interface.image_command(ImageCommand.MDONE, self.needle_number)

    @parlay_command()
    def mock_deposit_button(self, button: str = HaystackButton.DEPOSIT_1.name):
        """
        Simulate a deposit button press when the device does not emit BTN_PRESS*.

        :param button: HaystackButton deposit member name (e.g. DEPOSIT, DEPOSIT_1, DEPOSIT_2);
            case-insensitive per find_in_enum.
        :return: True on success
        """
        resolved = find_in_enum(HaystackButton, button)
        deposit_hw_events = {
            HaystackEventType.BTN_PRESS.value,
            HaystackEventType.BTN_PRESS_1.value,
            HaystackEventType.BTN_PRESS_2.value,
        }
        if resolved is None:
            raise ValueError(f"Invalid HaystackButton: {button!r}")
        if resolved not in deposit_hw_events:
            raise ValueError(
                "button must be a deposit HaystackButton (DEPOSIT, DEPOSIT_1, DEPOSIT_2), "
                f"got {button!r}"
            )
        self._on_deposit_button_event(resolved)
        return True

    @parlay_command()
    def reset_needle_count(self):
        """
        After setting the READY state during startup. It is a good idea to
        reset the needle count in Haystack.
        :return:
        """
        self.needle_number = 1
        return self.interface.image_command(ImageCommand.RESET_IMG_NUM, self.needle_number)

    @parlay_command()
    def set_needle_count(self, count: int):
        self.needle_number = count
        return self.interface.image_command(ImageCommand.SET_IMG_NUM, count)

    @parlay_command()
    def reset_command(self, reset_type: ResetCommand | str = ResetCommand.SYSTEM.value):
        """
        Reset the Haystack system.
        :return:
        """
        return self.interface.reset_command(reset_type)

    @parlay_command()
    def set_drop_area_led(self, state: LedCommand | str):
        """
        Set the drop area LED state.
        :param state: LED state
        :return:
        """
        return self.interface.led_command(Led.DROP_AREA, state)

    @parlay_command()
    def set_button_led(self, led_num: int | str | ButtonLed, state: LedCommand | str):
        """
        Selecting BTN LED 5 will target LED 1-4 with the same command and will
        apply ON/OFF setting to all of the LEDs
        :param led_num: LED number (1-4, or 5 for all LEDs)
        :param state: LED state (ON, OFF)
        :return:
        """
        return self.interface.button_led_command(int(led_num), state)

    @parlay_command()
    def api_version(self):
        return HayStack.__version__

    @parlay_command()
    def get_current_status(self) -> str:
        """Get current status information."""
        self.interface.status_command()
        return str(self.status)

    @parlay_command()
    def get_heartbeat_status_cmd(self) -> dict:
        """Get heartbeat monitoring status (Parlay command wrapper)."""
        return self.get_heartbeat_status()

    @parlay_command()
    def set_heartbeat_config_cmd(self, interval: float = None, timeout: float = None):
        """Configure heartbeat monitoring parameters (Parlay command wrapper)."""
        self.set_heartbeat_config(interval, timeout)
        return {"success": True, "interval": interval, "timeout": timeout}

    @parlay_command()
    def scan_ports(self) -> list[str]:
        """
        Scan for available Haystack devices.

        Returns:
            List of available connectable port paths
            (e.g., '/dev/ttyUSB0' on Linux, 'COM1' on Windows)
        """
        return self.interface.scan_ports()

    @parlay_command()
    def set_illuminator(self, state: IlluminatorCommand | str = IlluminatorCommand.RESET.value):
        """
        Set the illuminator command.
        :param illuminator_command: Illuminator command string (ON, OFF, RESET)
        :return:
        """
        return self.interface.illuminator_command(state)

    @parlay_command()
    def set_cap_btn_indicate(self, indicator_command: BtnIndicatorCommand | str):
        """
        Set the cap btn indicate command.
        :param indicator_command: Indicator command
        :return:
        """
        if isinstance(indicator_command, str):
            if len(indicator_command) != 4:
                raise ValueError("Indicator command must be a string of 4 characters")
            indicator_command = BtnIndicatorCommand(
                btn1=indicator_command[0] == "1",
                btn2=indicator_command[1] == "1",
                btn3=indicator_command[2] == "1",
                btn4=indicator_command[3] == "1",
            )
        return self.interface.cap_btn_indicate_command(indicator_command)

    @parlay_command()
    def set_post(self, timeout_sec: str | float = 20) -> bool:
        """
        Set the post command.
        :param timeout_sec: Timeout in seconds (default: 12 seconds 10.5 is the minimum)
        :return: True if post was successful, False otherwise (timeout or failure)
        """
        if not self.status_tray:
            time.sleep(0.1)
            self.logger.warning("Tray is not inserted, skipping post")
            self.send_event(**HaystackPostStatusEvent(0xF).to_event())
            return True
        if isinstance(timeout_sec, str):
            timeout_sec = float(timeout_sec)
        post_success: Optional[bool] = None
        with self._post_lock:
            self._post_success = None
        self._post_event.clear()

        self.interface.post_command()
        if not self._post_event.wait(timeout=timeout_sec):
            self.logger.warning(
                f"set_post: timeout after {timeout_sec} seconds "
                "waiting for post command to complete"
            )
            self.send_event(**HaystackPostStatusEvent(0x0).to_event())
            return False

        with self._post_lock:
            post_success = self._post_success
        return post_success

    @parlay_command()
    def set_btn_press_command(self):
        """
        Set the btn press command.
        :return:
        """
        return self.interface.set_btn_press_command()

    @parlay_command()
    def set_phase_command(self, phase: SetPhaseCommand | str):
        """
        Set the phase command.
        :param phase: Phase command
        :return:
        """
        return self.interface.set_phase_command(phase)

    @parlay_command()
    def indicate_command(self, indicate: IndicateCommand | str):
        """
        Set the indicate command.
        :param indicate: Indicate command
        :return:
        """
        return self.interface.indicate_command(indicate)

    @parlay_command()
    def upgrade_firmware(self, firmware_path: str) -> dict:
        """
        Upgrade Haystack firmware.

        Args:
            firmware_path: Absolute path to .bin firmware file

        Returns:
            FirmwareUpgradeResponse: Structured response with status and version information
        """
        try:
            # Strip leading and trailing quotes from firmware_path (Windows path copy)
            firmware_path = firmware_path.strip('"')
            # Validate firmware file
            fw_path = Path(firmware_path)
            if not fw_path.exists():
                return FirmwareUpgradeResponse(
                    success=False,
                    error=f"Firmware file not found: {firmware_path}",
                ).model_dump()

            if not fw_path.suffix == ".bin":
                return FirmwareUpgradeResponse(
                    success=False,
                    error=f"Firmware file must be a .bin file: {firmware_path}",
                ).model_dump()

            if not self.is_connected:
                self.logger.info("Not connected, attempting to connect before firmware upgrade")
                ports = self.interface.scan_ports()
                if ports:
                    self.logger.info(
                        (
                            f"Found Haystack devices on ports: {ports} ",
                            f"attempting to connect to {ports[0]}",
                        )
                    )
                    if not self.connect(ports[0]):
                        self.interface.port = ports[0]
                        self.logger.error(
                            "Failed to connect to Haystack (may be in bootloader mode)"
                        )
                if not ports:
                    self.logger.error("No Haystack devices found for firmware upgrade")
                    return FirmwareUpgradeResponse(
                        success=False,
                        error="No Haystack devices found for firmware upgrade",
                    ).model_dump()

            # Create progress callback to emit Parlay events
            def progress_callback(progress: FirmwareUpgradeProgress):
                """Emit firmware upgrade progress as Parlay events."""
                self.send_event(
                    json.dumps(asdict(progress)),
                    "firmware_upgrade_progress",
                    None,
                )

            # Create firmware updater and track it
            with self._upgrade_state_lock:
                self.current_firmware_updater = FirmwareUpdater(
                    transport=self.interface,
                    progress_callback=progress_callback,
                )
                self.firmware_upgrade_in_progress = True
                self._last_upgrade_progress = None

            try:
                self.stop_heartbeat_monitoring()
                self.stop_port_monitoring()

                # Perform upgrade
                self.logger.info(f"Starting firmware upgrade from: {firmware_path}")
                success = self.current_firmware_updater.upgrade_firmware(
                    firmware_path=firmware_path
                )

                if success:
                    # Get new firmware version
                    time.sleep(1)
                    self.interface.get_command(GetCommand.VERSION.value)
                    time.sleep(0.5)  # Give time for version response

                    return FirmwareUpgradeResponse(
                        success=True,
                        message="Firmware upgrade completed successfully",
                        new_version=self.version,
                    ).model_dump()
                else:
                    return FirmwareUpgradeResponse(
                        success=False,
                        error="Firmware upgrade failed",
                    ).model_dump()
            finally:
                # Snapshot final state and clear atomically under lock so
                # concurrent status calls never see a partially-torn-down pair.
                with self._upgrade_state_lock:
                    if self.current_firmware_updater is not None:
                        self._last_upgrade_progress = self.current_firmware_updater.get_progress()
                    self.firmware_upgrade_in_progress = False
                    self.current_firmware_updater = None
                self.start_heartbeat_monitoring()
                self.start_port_monitoring()

        except FirmwareUpdateError as e:
            self.logger.error(f"Firmware update error: {e}")
            return FirmwareUpgradeResponse(
                success=False,
                error=str(e),
            ).model_dump()
        except Exception as e:
            self.logger.error(f"Unexpected error during firmware upgrade: {e}")
            return FirmwareUpgradeResponse(
                success=False,
                error=f"Unexpected error: {e}",
            ).model_dump()

    @parlay_command()
    def get_firmware_upgrade_status(self) -> dict:
        """
        Get current firmware upgrade progress.

        Returns:
            dict: Structured status with progress details (from FirmwareUpgradeProgress)
        """
        with self._upgrade_state_lock:
            in_progress = self.firmware_upgrade_in_progress
            updater = self.current_firmware_updater
            last_progress = self._last_upgrade_progress

        if in_progress and updater is not None:
            # Upgrade is running — read live progress outside the lock.
            return asdict(updater.get_progress())

        if last_progress is not None:
            with self._upgrade_state_lock:
                self._last_upgrade_progress = None
            return asdict(last_progress)

        # No upgrade has run or state has been explicitly reset.
        idle_progress = FirmwareUpgradeProgress(
            stage="idle",
            percentage=0,
            message="No upgrade in progress",
            timestamp=time.time(),
        )
        return asdict(idle_progress)

    @parlay_command()
    def set_cam_mtx(self, values: str) -> int:
        """
        Set camera calibration matrix stored in flash (SET_CAM_MTX).
        :param values: 9 comma-separated floats representing the 3x3 camera matrix
        :return: Sequence ID if sent successfully, None otherwise
        """
        try:
            float_values = [float(v.strip()) for v in values.split(",")]
        except ValueError as e:
            raise ValueError(f"Invalid values for SET_CAM_MTX: {e}") from e
        if len(float_values) != 9:
            raise ValueError(f"SET_CAM_MTX requires 9 values, got {len(float_values)}")
        return self.interface.set_cam_mtx_command(float_values)

    @parlay_command()
    def set_cam_dist(self, values: str) -> int:
        """
        Set camera distortion coefficient matrix stored in flash (SET_CAM_DIST).
        :param values: 5 comma-separated floats representing the 5x1 distortion matrix
        :return: Sequence ID if sent successfully, None otherwise
        """
        try:
            float_values = [float(v.strip()) for v in values.split(",")]
        except ValueError as e:
            raise ValueError(f"Invalid values for SET_CAM_DIST: {e}") from e
        if len(float_values) != 5:
            raise ValueError(f"SET_CAM_DIST requires 5 values, got {len(float_values)}")
        return self.interface.set_cam_dist_command(float_values)
