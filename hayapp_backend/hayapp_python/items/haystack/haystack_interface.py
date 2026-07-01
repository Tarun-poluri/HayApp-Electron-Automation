from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Command(Enum):
    GET = "GET"
    SET = "SET"
    IMAGE = "IMAGE"
    BTN_LED = "BTN_LED"
    LED = "LED"
    RESET = "RESET"
    SET_PHASE = "SET_PHASE"
    INDICATE = "INDICATE"
    LED_EFFECT = "LED_EFFECT"
    ILLUMINATOR = "ILLUMINATOR"
    CAP_BTN_INDICATE = "CAP_BTN_INDICATE"
    SET_CAM_MTX = "SET_CAM_MTX"
    SET_CAM_DIST = "SET_CAM_DIST"


class GetCommand(Enum):
    STACK_ID = "STACK_ID"
    VERSION = "VERSION"
    PRESSURE_DATA = "PRESSURE_DATA"
    STATUS = "STATUS"
    ACCEL_DATA = "ACCEL_DATA"
    CART_VAL = "CART_VAL"
    VIN_MON = "VIN_MON"
    CONFIG = "CONFIG"
    HW_VERSION = "HW_VERSION"
    CAM_MTX = "CAM_MTX"
    CAM_DIST = "CAM_DIST"


class SetCommand(Enum):
    """
    Used to set the state of the HayStack
    """

    READY = "READY"
    NOT_READY = "NOT_READY"
    TEST = "TEST"
    BTN_PRESS = "BTN_PRESS"
    POST = "POST"
    BTN_OUTPUT = "BTN_OUTPUT"
    UPDATE = "UPDATE"


class LedCommand(Enum):
    ON = "ON"
    OFF = "OFF"


class ButtonLed(Enum):
    YES = 1
    VALIDATE = 2
    TAKE_ACTION = 3
    NO = 4
    ALL = 5


class Led(Enum):
    ALL = 15
    DROP_AREA = 16


class ResetCommand(Enum):
    SYSTEM = "SYSTEM"
    TEST = "TEST"
    BATT = "BATT"
    BUZZER = "BUZZER"
    BLUETOOTH = "BLUETOOTH"
    BTN_OUTPUT = "BTN_OUTPUT"
    CONFIG = "CONFIG"


class ImageCommand(Enum):
    """
    Used to set the state of the HayStack
    """

    DONE = "DONE"
    FAIL = "FAIL"
    MDONE = "MDONE"
    RESET_IMG_NUM = "RESET_IMG_NUM"
    SET_IMG_NUM = "SET_IMG_NUM"


class ImageResponse(Enum):
    """
    Used to set the state of the HayStack
    """

    READY = "READY"
    MOVED = "MOVED"
    CLEAR_AREA = "CLEAR_AREA"
    TEST = "TEST"


class SetPhaseCommand(Enum):
    NORMAL = "NORMAL"
    CLOSING = "CLOSING"
    PACKAGED = "PACKAGED"
    UNPACKAGED = "UNPACKAGED"


class IndicateCommand(Enum):
    CLOSING_CNT = "CLOSING_CNT"
    OVER_CNT = "OVER_CNT"
    UNDER_CNT = "UNDER_CNT"


class LedEffect(Enum):
    PULSE = 0
    COUNTER_CLOCKWISE = 1
    CLOCKWISE = 2
    STATIC = 3


class LedColor(Enum):
    RED = 0
    GREEN = 1
    BLUE = 2
    AMBER = 3
    PURPLE = 4
    TEAL = 5
    WHITE = 6


class AsyncCommand(Enum):
    """
    These are commands received from the Haystack
    that are not a response to a command sent.
    """

    EVENT = "EVENT"
    ERROR = "ERROR"
    HEARTBEAT = "HEARTBEAT"
    IMAGE = "IMAGE"
    INIT = "INIT"  # Defined in protocol but unused
    HAYSTACK_ID = "HAYSTACK_ID"
    VERSION = "VERSION"
    STATUS = "STATUS"
    CONFIG = "CONFIG"
    BLUETOOTH = "BLUETOOTH"
    ACK = "ACK"
    HW_VERSION = "HW_VERSION"
    CAM_MTX = "CAM_MTX"
    CAM_DIST = "CAM_DIST"
    DEBUG = "DEBUG"


class EventType(Enum):
    BTN_PRESS = "BTN_PRESS"
    BTN_PRESS_1 = "BTN_PRESS_1"
    BTN_PRESS_2 = "BTN_PRESS_2"
    READY_WITH_TRAY = "READY_WITH_TRAY"
    READY_NO_TRAY = "READY_NO_TRAY"
    TRAY_INSERTED = "TRAY_INSERTED"
    TRAY_REMOVED = "TRAY_REMOVED"
    FAULT_CLEAR = "FAULT_CLEAR"
    BTN_LED1_PRESSED = "BTN_LED1_PRESS"
    BTN_LED2_PRESSED = "BTN_LED2_PRESS"
    BTN_LED3_PRESSED = "BTN_LED3_PRESS"
    BTN_LED4_PRESSED = "BTN_LED4_PRESS"
    POST_SUCCESS = "POST_SUCCESS"
    POST_FAIL = "POST_FAIL"
    POST_RESULT = "POST_RESULT"


class HeartbeatStatus(Enum):
    CHANGED = 0x80000000
    TRAY_PRESENT = 0x40000000
    READY = 0x20000000
    MAG_ERROR = 0x10000000
    ERROR = 0x01000000
    ERROR_MASK = 0x00FF0000
    BTN1_LED_ON = 0x00000008
    BTN2_LED_ON = 0x00000004
    BTN3_LED_ON = 0x00000002
    BTN4_LED_ON = 0x00000001


class ImageStatus(Enum):
    READY = "READY"
    MOVED = "MOVED"


class HaystackButton(Enum):
    YES = EventType.BTN_LED1_PRESSED.value
    NO = EventType.BTN_LED4_PRESSED.value
    TAKE_ACTION = EventType.BTN_LED3_PRESSED.value
    VALIDATE = EventType.BTN_LED2_PRESSED.value
    DEPOSIT = EventType.BTN_PRESS.value  # TODO Remove, keep for backward compatibility
    DEPOSIT_1 = EventType.BTN_PRESS_1.value
    DEPOSIT_2 = EventType.BTN_PRESS_2.value


class HayStackTray(Enum):
    INSERTED = EventType.TRAY_INSERTED.value
    REMOVED = EventType.TRAY_REMOVED.value


class IlluminatorCommand(Enum):
    ON = "ON"
    OFF = "OFF"
    RESET = "RESET"


@dataclass
class BtnIndicatorCommand:
    btn1: bool
    btn2: bool
    btn3: bool
    btn4: bool


ReturnType = Optional[int]


class HaystackInterface(ABC):

    port: Optional[str] = None

    @abstractmethod
    def scan_ports(self) -> list[str]:
        """
        Scan for available Haystack devices.
        :return: List of available port strings
        """
        return NotImplementedError

    @abstractmethod
    def connect(self, port: str) -> bool:
        """
        Connect to the Haystack.
        :param port: Port string
        :return: True if connected successfully, False otherwise
        """
        return NotImplementedError

    @abstractmethod
    def disconnect(self) -> bool:
        """
        Disconnect from the Haystack.
        :return: True if disconnected successfully, False otherwise
        """
        return NotImplementedError

    @abstractmethod
    def send_command(self, cmd: str, params: list = None) -> ReturnType:
        """
        Send a command. Do not wait for a response.
        :param cmd:
        :param params:
        :return:
        """
        return NotImplementedError

    @abstractmethod
    def send_packet(self, packet: str) -> bool:
        """
        Send a packet using the serial handler.
        :param packet: Packet string
        :return: True if sent successfully, False otherwise
        """
        return NotImplementedError

    @abstractmethod
    def get_command(self, command: GetCommand | str) -> ReturnType:
        """
        Get a command.
        :param command: Command string
        """
        return NotImplementedError

    @abstractmethod
    def set_command(self, state: SetCommand | str) -> ReturnType:
        """
        Send the set command to the HayStack.
        :param state: State string
        """
        return NotImplementedError

    @abstractmethod
    def status_command(self) -> ReturnType:
        """
        Send the status command to the HayStack.
        """
        return NotImplementedError

    @abstractmethod
    def image_command(self, image_command: ImageCommand | str, number: int) -> ReturnType:
        """
        Send the image command to the HayStack.
        :param ImageCommand: Image command string
        :param number: Image number
        """
        return NotImplementedError

    @abstractmethod
    def button_led_command(
        self, led_num: int | str | ButtonLed, led_command: LedCommand | str
    ) -> ReturnType:
        """
        Send the btn led command to the HayStack.
        :param ButtonLed: Button led command string
        :param led_command: Led command string
        """
        return NotImplementedError

    @abstractmethod
    def led_command(self, led_num: int | str | Led, led_command: LedCommand | str) -> ReturnType:
        """
        Send the led command to the HayStack.
        :param LedCommand: Led command string
        :param led_command: Led command string
        """
        return NotImplementedError

    @abstractmethod
    def reset_command(self, reset_type: ResetCommand | str) -> ReturnType:
        """
        Reset the HayStack.
        :param reset_type: Reset type
        """
        return NotImplementedError

    @abstractmethod
    def set_phase_command(self, set_phase_command: SetPhaseCommand | str) -> ReturnType:
        """
        Send the set phase command to the HayStack.
        :param SetPhaseCommand: Set phase command string
        """
        return NotImplementedError

    @abstractmethod
    def indicate_command(self, indicate_command: IndicateCommand | str) -> ReturnType:
        """
        Send the indicate command to the HayStack.
        :param IndicateCommand: Indicate command string
        """
        return NotImplementedError

    @abstractmethod
    def led_effect_command(self, led_effect_command: LedEffect | str) -> ReturnType:
        """
        Send the led effect command to the HayStack.
        :param LedEffect: Led effect command string
        """
        return NotImplementedError

    @abstractmethod
    def illuminator_command(self, illuminator_command: IlluminatorCommand | str) -> ReturnType:
        """
        Send the illuminator command to the HayStack.
        :param IlluminatorCommand: Illuminator command string
        """
        return NotImplementedError

    @abstractmethod
    def cap_btn_indicate_command(self, inducator_command: BtnIndicatorCommand | str) -> ReturnType:
        """
        Send the cap btn indicate command to the HayStack.
        :param inducator_command: Inducator command
        """
        return NotImplementedError

    @abstractmethod
    def post_command(self) -> ReturnType:
        """
        Send the post command to the HayStack.
        """
        return NotImplementedError

    @abstractmethod
    def set_btn_press_command(self) -> ReturnType:
        """
        Send the btn press command to the HayStack.
        """
        return NotImplementedError

    @abstractmethod
    def enter_bootloader(self) -> bool:
        """
        Enter bootloader mode for firmware update.

        Returns:
            True if bootloader entry successful, False otherwise
        """
        return NotImplementedError

    @abstractmethod
    def set_cam_mtx_command(self, values: list) -> ReturnType:
        """
        Send SET_CAM_MTX command to store the 3x3 camera calibration matrix in flash.
        :param values: List of 9 floats representing the camera matrix
        """
        return NotImplementedError

    @abstractmethod
    def close_for_flash(self) -> bool:
        """
        Close connection for external flashing.

        Returns:
            True if closed successfully, False otherwise
        """
        return NotImplementedError

    @abstractmethod
    def reconnect_after_flash(self, timeout: float = 10.0) -> bool:
        """
        Reconnect after firmware flash.

        Args:
            timeout: Maximum time to wait for reconnection in seconds

        Returns:
            True if reconnected successfully, False otherwise
        """
        return NotImplementedError

    @abstractmethod
    def set_cam_dist_command(self, values: list) -> ReturnType:
        """
        Send SET_CAM_DIST command to store the 5x1 distortion coefficient matrix in flash.
        :param values: List of 5 floats representing the distortion coefficients
        """
        return NotImplementedError
