import threading
import time
from pathlib import Path
from typing import Callable

from parlay import ParlayCommandItem, local_item, parlay_command
from parlay.server.broker import run_in_thread

from hayapp_python.common.config_manager import config
from hayapp_python.common.defs import HayStackSimulator_item as item
from hayapp_python.common.events import ErrorEvent
from hayapp_python.common.utils import find_in_enum
from hayapp_python.items.haystack.base_transport import BaseTransport
from hayapp_python.items.haystack.haystack_interface import (
    AsyncCommand,
    Command,
    EventType,
    GetCommand,
    HaystackButton,
    HayStackTray,
    ImageCommand,
    ImageStatus,
    LedCommand,
    SetCommand,
)
from hayapp_python.items.haystack.haystack_status import HayStackStatus
from hayapp_python.items.haystack.serial_protocol import SerialPacket

CALIBRATION_DEFAULT_MATRIX = config.camera.calibration_default_matrix
CALIBRATION_DEFAULT_DISTORTION = config.camera.calibration_default_distortion


@local_item()
class SimTransport(BaseTransport, ParlayCommandItem):
    """
    Simulator for HayStack command item to emulate its behavior for testing purposes.
    """

    __version__: str = "1.0.1"
    __haystack_id__: str = "SIM_HAYSTACK"

    def __init__(
        self,
        response_processor: Callable[[str, list], None] = None,
        item_id: int = item.id,
        name: str = item.name,
    ):
        ParlayCommandItem.__init__(self, item_id=item_id, name=name)
        BaseTransport.__init__(self, response_processor)

        self.image_num = 1
        self.snd_seq_id = 1
        self.rcv_seq_id = 1
        self.is_ready = False
        self.is_installed = False
        self.last_heartbeat = 0
        self.kill_heartbeat = False

        self.test_mode = False

        # Simulate port for firmware upgrade compatibility
        self.port = "SIM"

        # Initialize status structure
        self.status = HayStackStatus()
        self.status.hc = False
        self.status.rdy = False
        self.status.chg = True

        self.lock = threading.RLock()  # Use RLock to allow reentrant locking
        # self._mock_connect()

        # Ports reported by scan_ports(); empty until sim_connect adds a simulated device
        self._sim_scan_ports: list[str] = []

        # Calibration values - updated by SET_CAM_MTX / SET_CAM_DIST commands
        self._sim_cam_mtx = list(CALIBRATION_DEFAULT_MATRIX)
        self._sim_cam_dist = list(CALIBRATION_DEFAULT_DISTORTION)

    def scan_ports(self) -> list[str]:
        with self.lock:
            return list(self._sim_scan_ports)

    @parlay_command()
    def sim_connect(self, sim: str = "SIM") -> list[str]:
        """
        Register a simulated HayStack port for discovery (e.g. ``SIM``).
        Idempotent: the same ``sim`` is not added twice.
        """
        with self.lock:
            if sim not in self._sim_scan_ports:
                self._sim_scan_ports.append(sim)
            return list(self._sim_scan_ports)

    @parlay_command()
    def sim_disconnect(self) -> list[str]:
        """Clear all simulated ports so ``scan_ports()`` returns an empty list."""
        with self.lock:
            self._sim_scan_ports.clear()
            return []

    def send_packet(self, packet: str) -> bool:
        """
        Send a command. Do not wait for a response.
        :param cmd:
        :param params:
        :return:
        """
        packet: SerialPacket = self.protocol.decode_packet(packet)
        self._mock_response(packet.command, self.protocol.parse_data_fields(packet.data))
        return True

    def handle_response(self, command: str, parms: list = []):
        """
        call the response processor with the message received
        :param command:
        :param parms:
        :return:
        """
        print(f"Sending response: {command} with parms: {parms}")
        with self.lock:
            self.response_processor(command, parms)

    def mock_event(self, event: str):
        event = event.upper()
        new_status = None
        if event == EventType.TRAY_INSERTED.name:
            self.status.hc = True
            self.status.chg = True
            new_status = self.status
        elif event == EventType.TRAY_REMOVED.name:
            self.status.hc = False
            self.status.chg = True
            new_status = self.status
        elif event == EventType.BTN_PRESS.value and self.status.rdy and not self.test_mode:
            # Send BTN_PRESS event FIRST so MockCamera can set is_reference = False
            # before IMAGE READY triggers the camera capture
            self.handle_response(AsyncCommand.EVENT.value, [event])

            self.status.rdy = False
            self.status.chg = True
            new_status = self.status
            self.handle_response(
                AsyncCommand.IMAGE.value, [self.image_num, ImageStatus.READY.value]
            )
            # BTN_PRESS event already sent above, so skip sending it again
            event = None

            return

        # Send responses
        if new_status:
            self.handle_response(AsyncCommand.HEARTBEAT.value, [new_status.to_hex_string()])
        if event is not None:
            self.handle_response(AsyncCommand.EVENT.value, [event])

    @run_in_thread
    def _mock_heartbeat(self):
        while not self.kill_heartbeat:
            # await asyncio.sleep(10)
            time.sleep(10)

            status_hex = self.status.to_hex_string()
            self.handle_response(AsyncCommand.HEARTBEAT.value, [status_hex])

    def connect(self, port) -> bool:
        self.handle_response(AsyncCommand.INIT.value, [SimTransport.__haystack_id__])

        # start the heartbeat thread
        # self.heartbeat_task = asyncio.create_task(self._mock_heartbeat())
        self.kill_heartbeat = False
        self.heartbeat_task = threading.Thread(target=self._mock_heartbeat)
        self.heartbeat_task.daemon = (
            True  # Thread will automatically terminate when main program exits
        )
        self.heartbeat_task.start()
        return True

    def disconnect(self) -> bool:
        """
        Disconnect from the HayStack.
        :return: True if disconnected successfully, False otherwise
        """
        self.kill_heartbeat = True
        self.heartbeat_task.join()
        return True

    @parlay_command()
    def simulate_button_press(self, button: str = HaystackButton.DEPOSIT_1.value):
        """
        Simulate a button press by updating the button_pressed property.
        :param button: New value for button_pressed.
        """
        if pressed_button := find_in_enum(HaystackButton, button):
            self.mock_event(pressed_button)

    @parlay_command()
    def simulate_tray_event(self, event: str):
        """
        Simulate a tray event.
        :param event: Tray event string
        """
        if parsed_tray_event := find_in_enum(HayStackTray, event):
            self.mock_event(parsed_tray_event)

    def set_error_value(self, error_code: int):
        """Set the error value (0-255)."""
        if not 0 <= error_code <= 255:
            raise ValueError("Error code must be between 0 and 255")
        self.status.error_value = error_code
        self.status.error = error_code > 0
        self.status.chg = True
        self.handle_response(AsyncCommand.HEARTBEAT.value, [self.status.to_hex_string()])
        self.handle_response(AsyncCommand.ERROR.value, [error_code])

    @parlay_command()
    def simulate_error(self, error_code: int):
        """Simulate an error condition."""
        self.set_error_value(int(error_code))
        print(f"Error simulated with code: {error_code}")
        print(f"Current status: {self.status}")

    @parlay_command()
    def simulate_error_event(
        self,
        title: str = "Simulated Error",
        msg: str = "This is a simulated error.",
        is_fatal: bool = False,
    ):
        """Publish an ErrorEvent for testing. Set is_fatal=True for a non-dismissible popup."""
        self.send_event(**ErrorEvent(title=title, msg=msg, is_fatal=is_fatal).to_event())

    @parlay_command()
    def get_current_status(self):
        """Get current status information."""
        return str(self.status)

    def _handle_get_command(self, parms):
        """Handle GET command responses."""
        print(f"GET command received with parms: {parms}")
        parameter = find_in_enum(GetCommand, parms[0])
        if parameter == GetCommand.STACK_ID.value:
            haystack_id = SimTransport.__haystack_id__
            self.handle_response(AsyncCommand.HAYSTACK_ID.value, [haystack_id])
        elif parameter == GetCommand.VERSION.value:
            version = SimTransport.__version__
            self.handle_response(AsyncCommand.VERSION.value, [version])
        elif parameter == GetCommand.STATUS.value:
            self.handle_response(AsyncCommand.STATUS.value, [self.status.to_hex_string()])
        elif parameter == GetCommand.ACCEL_DATA.value:
            self.handle_response(GetCommand.ACCEL_DATA.value, ["Mock Acceleration Data"])
        elif parameter == GetCommand.CART_VAL.value:
            self.handle_response(GetCommand.CART_VAL.value, ["Mock Live Cart Value"])
        elif parameter == GetCommand.VIN_MON.value:
            self.handle_response(GetCommand.VIN_MON.value, ["Mock Voltage In Monitor"])
        elif parameter == GetCommand.CONFIG.value:
            self.handle_response(AsyncCommand.CONFIG.value, ["Mock Config"])
        elif parameter == GetCommand.HW_VERSION.value:
            self.handle_response(AsyncCommand.HW_VERSION.value, ["Mock HW Version"])
        elif parameter == GetCommand.CAM_MTX.value:
            # Return current (possibly overridden) 3x3 camera matrix
            self.handle_response(
                AsyncCommand.CAM_MTX.value,
                self._sim_cam_mtx,
            )
        elif parameter == GetCommand.CAM_DIST.value:
            # Return current (possibly overridden) distortion coefficients
            self.handle_response(
                AsyncCommand.CAM_DIST.value,
                self._sim_cam_dist,
            )

    def _handle_set_command(self, parms):
        """Handle SET command."""
        print(f"SET command received with parms: {parms}")
        new_status = None
        if parms[0] == SetCommand.READY.value:
            print("Set Haystack to READY")
            self.status.rdy = True
            self.status.chg = True
            new_status = self.status
        elif parms[0] == SetCommand.NOT_READY.value:
            print("Set Haystack to NOT_READY")
            self.status.rdy = False
            self.status.chg = True
            new_status = self.status
        elif parms[0] == SetCommand.TEST.value:
            print("Set Haystack to TEST, deposit will not move needle")
            self.test_mode = True
        elif parms[0] == SetCommand.POST.value:
            self.handle_response(AsyncCommand.EVENT.value, [EventType.POST_RESULT.value, "0F"])
        elif parms[0] == SetCommand.BTN_PRESS.value:
            self.simulate_button_press(HaystackButton.DEPOSIT.name)

        if new_status:
            self.handle_response(AsyncCommand.HEARTBEAT.value, [new_status.to_hex_string()])

    def _handle_image_command(self, parms):
        """Handle IMAGE command.

        Args:
            parms: List with [image_number, command] (e.g., ['1', 'DONE'])
                   Protocol parser always converts comma-separated data to list
        """
        print(f"IMAGE command received with parms: {parms}")
        new_status = None

        # Parse the command - format is always a list: ['1', 'DONE']
        image_num = int(parms[0])
        command = parms[1]

        if command == ImageCommand.DONE.value:
            print(f"Imaging complete for needle {image_num}, moving to sharps")
            data = [image_num, ImageStatus.MOVED.value]
            self.handle_response(AsyncCommand.IMAGE.value, data)
        elif command == ImageCommand.MDONE.value:
            print(f"Needle {image_num} moved to sharps, preparing for next deposit")
            self.handle_response(AsyncCommand.EVENT.value, [EventType.READY_WITH_TRAY.value])
            self.image_num += 1
            self.status.rdy = True
            self.status.chg = True
            new_status = self.status
        elif command == ImageCommand.RESET_IMG_NUM.value:
            print(f"Resetting image number from {self.image_num} to {image_num}")
            self.image_num = image_num
        elif command == ImageCommand.SET_IMG_NUM.value:
            print(f"Setting image number from {self.image_num} to {image_num}")
            self.image_num = image_num

        if new_status:
            self.handle_response(AsyncCommand.HEARTBEAT.value, [new_status.to_hex_string()])

    def _handle_btn_led_command(self, parms):
        """Handle BTN_LED command.

        Args:
            parms: List with [led_number, state] (e.g., ['5', 'ON'])
                   Protocol parser always converts comma-separated data to list
        """
        print(f"BTN_LED command received with parms: {parms}")
        if len(parms) != 2:
            return

        led_num = int(parms[0])
        led_state = parms[1].upper()
        on_state = led_state == LedCommand.ON.value

        # Update the appropriate LED status
        if led_num == 1:
            self.status.btn1_led = on_state
        elif led_num == 2:
            self.status.btn2_led = on_state
        elif led_num == 3:
            self.status.btn3_led = on_state
        elif led_num == 4:
            self.status.btn4_led = on_state
        elif led_num == 5:
            # LED 5 targets all LEDs (1-4)
            self.status.btn1_led = on_state
            self.status.btn2_led = on_state
            self.status.btn3_led = on_state
            self.status.btn4_led = on_state

        self.status.chg = True
        self.handle_response(AsyncCommand.HEARTBEAT.value, [self.status.to_hex_string()])

    def _handle_reset_command(self, parms):
        """Handle RESET command."""
        print(f"RESET command received with parms: {parms}")
        self.status = HayStackStatus()
        self.status.chg = True
        self.handle_response(AsyncCommand.HEARTBEAT.value, [self.status.to_hex_string()])

    def _handle_led_command(self, parms):
        """Handle LED command."""
        print(f"LED command received with parms: {parms}")

    def _handle_illuminator_command(self, parms):
        """Handle ILLUMINATOR command."""
        print(f"ILLUMINATOR command received with parms: {parms}")

    def _handle_cap_btn_indicate_command(self, parms):
        """Handle CAP_BTN_INDICATE command."""
        print(f"CAP_BTN_INDICATE command received with parms: {parms}")
        if len(parms) != 1 or len(parms[0]) != 4:
            print(f"Invalid CAP_BTN_INDICATE command: {parms}")
            return
        self.status.btn1_led = parms[0][3] == "1"
        self.status.btn2_led = parms[0][2] == "1"
        self.status.btn3_led = parms[0][1] == "1"
        self.status.btn4_led = parms[0][0] == "1"
        self.status.chg = True
        self.handle_response(AsyncCommand.HEARTBEAT.value, [self.status.to_hex_string()])

    def _handle_set_phase_command(self, parms):
        """Handle SET_PHASE command."""
        print(f"SET_PHASE command received with parms: {parms}")

    def _handle_indicate_command(self, parms):
        """Handle INDICATE command."""
        print(f"INDICATE command received with parms: {parms}")

    def _handle_set_cam_mtx_command(self, parms):
        """Handle SET_CAM_MTX command - store 9-value camera matrix."""
        print(f"SET_CAM_MTX command received with parms: {parms}")
        try:
            values = [float(p) for p in parms]
        except (ValueError, TypeError) as e:
            print(f"SET_CAM_MTX: invalid values: {e}")
            return
        if len(values) != 9:
            print(f"SET_CAM_MTX: expected 9 values, got {len(values)}")
            return
        self._sim_cam_mtx = values
        # self.handle_response(AsyncCommand.ACK.value, [])

    def _handle_set_cam_dist_command(self, parms):
        """Handle SET_CAM_DIST command - store 5-value distortion coefficients."""
        print(f"SET_CAM_DIST command received with parms: {parms}")
        try:
            values = [float(p) for p in parms]
        except (ValueError, TypeError) as e:
            print(f"SET_CAM_DIST: invalid values: {e}")
            return
        if len(values) != 5:
            print(f"SET_CAM_DIST: expected 5 values, got {len(values)}")
            return
        self._sim_cam_dist = values
        # self.handle_response(AsyncCommand.ACK.value, [])

    def _mock_response(self, command: str, parms: list):
        print(f"Mock response for command: {command} with parms: {parms}")
        command = find_in_enum(Command, command)
        if command == Command.GET.value:
            self._handle_get_command(parms)
        elif command == Command.SET.value:
            self._handle_set_command(parms)
        elif command == Command.IMAGE.value:
            self._handle_image_command(parms)
        elif command == Command.BTN_LED.value:
            self._handle_btn_led_command(parms)
        elif command == Command.RESET.value:
            self._handle_reset_command(parms)
        elif command == Command.LED.value:
            self._handle_led_command(parms)
        elif command == Command.ILLUMINATOR.value:
            self._handle_illuminator_command(parms)
        elif command == Command.CAP_BTN_INDICATE.value:
            self._handle_cap_btn_indicate_command(parms)
        elif command == Command.SET_PHASE.value:
            self._handle_set_phase_command(parms)
        elif command == Command.INDICATE.value:
            self._handle_indicate_command(parms)
        elif command == Command.SET_CAM_MTX.value:
            self._handle_set_cam_mtx_command(parms)
        elif command == Command.SET_CAM_DIST.value:
            self._handle_set_cam_dist_command(parms)
        else:
            print(f"Invalid command: {command}, valid commands are: {[e.value for e in Command]}")

    def enter_bootloader(self) -> bool:
        """
        Simulate bootloader entry.

        Returns:
            True (always successful in simulator)
        """
        print("Simulating bootloader entry")
        self.handle_response(AsyncCommand.EVENT.value, ["ENTERING_BOOTLOADER"])
        time.sleep(0.5)  # Simulate bootloader entry delay
        return True

    def close_for_flash(self) -> bool:
        """
        Simulate closing connection for flashing.

        Returns:
            True (always successful in simulator)
        """
        print("Simulating connection close for flashing")
        time.sleep(0.2)  # Simulate close delay
        return True

    def reconnect_after_flash(self, timeout: float = 10.0) -> bool:
        """
        Simulate reconnection after firmware flash.

        Args:
            timeout: Maximum time to wait (ignored in simulator)

        Returns:
            True (always successful in simulator)
        """
        print(f"Simulating reconnection after flash (timeout: {timeout}s)")
        time.sleep(1.0)  # Simulate device reboot

        # Simulate version update
        new_version = "2.0.0-simulated"
        SimTransport.__version__ = new_version

        # Send INIT event to simulate reconnection
        self.handle_response(AsyncCommand.INIT.value, [SimTransport.__haystack_id__])
        self.handle_response(AsyncCommand.VERSION.value, [new_version])

        print(f"Simulated firmware upgraded to version: {new_version}")
        return True

    @parlay_command()
    def simulate_firmware_flash(
        self,
        firmware_path: str,
        progress_stages: int = 10,
    ) -> dict:
        """
        Simulate firmware flashing with realistic timing and progress events.

        Args:
            firmware_path: Path to firmware file (for validation only)
            progress_stages: Number of progress updates to emit

        Returns:
            Dictionary with simulation results
        """
        print(f"Simulating firmware flash from: {firmware_path}")

        fw_path = Path(firmware_path)
        if not fw_path.exists():
            return {
                "success": False,
                "error": f"Firmware file not found: {firmware_path}",
            }

        # Simulate each stage of firmware upgrade
        stages = [
            ("ENTERING_BOOTLOADER", 0.5),
            ("PREPARING_FLASH", 0.3),
            ("FLASHING", 3.0),
            ("VERIFYING", 1.0),
            ("RECONNECTING", 1.0),
            ("COMPLETE", 0.2),
        ]

        for stage_name, duration in stages:
            self.handle_response(AsyncCommand.EVENT.value, [stage_name])
            time.sleep(duration)

            # Emit progress updates during flashing
            if stage_name == "FLASHING":
                for i in range(progress_stages):
                    percentage = (i + 1) * (100 // progress_stages)
                    print(f"  Flash progress: {percentage}%")
                    time.sleep(duration / progress_stages)

        # Update simulated firmware version
        new_version = "2.0.0-simulated"
        SimTransport.__version__ = new_version
        self.handle_response(AsyncCommand.VERSION.value, [new_version])

        return {
            "success": True,
            "new_version": new_version,
            "message": "Firmware flash simulation completed",
        }
