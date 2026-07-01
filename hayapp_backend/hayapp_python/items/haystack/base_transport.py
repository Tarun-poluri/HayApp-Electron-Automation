import logging
from typing import Callable, Optional

from hayapp_python.common.utils import find_in_enum
from hayapp_python.items.haystack.haystack_interface import (
    BtnIndicatorCommand,
    ButtonLed,
    Command,
    GetCommand,
    HaystackInterface,
    IlluminatorCommand,
    ImageCommand,
    IndicateCommand,
    Led,
    LedCommand,
    LedEffect,
    ResetCommand,
    ReturnType,
    SetCommand,
    SetPhaseCommand,
)
from hayapp_python.items.haystack.serial_protocol import (
    InvalidPacketError,
    SerialProtocol,
)


class BaseTransport(HaystackInterface):
    """
    Base class for all HayStack transports.
    """

    def __init__(self, response_processor: Callable[[str, list], None] = None):
        self.response_processor = response_processor
        if response_processor is None:
            raise RuntimeError("Haystack requires a response processor")

        self.protocol = SerialProtocol()
        self.logger = logging.getLogger(__name__)

    def send_command(
        self, command: str, data: Optional[str | list] = None, include_crc: bool = False
    ) -> ReturnType:
        """
        Send a command using the serial protocol.

        Args:
            command: Command name
            data: Optional data payload (string or list of values)
            include_crc: Whether to include CRC checksum

        Returns:
            Sequence ID if sent successfully, None otherwise
        """
        try:
            # Convert list to comma-delimited string if needed
            if isinstance(data, list):
                data = self.protocol.build_data_string(data)

            packet = self.protocol.encode_packet(command, data, include_crc=include_crc)
            return self.protocol.decode_packet(packet).seq_id if self.send_packet(packet) else None
        except InvalidPacketError as e:
            self.logger.error(f"Invalid packet: {str(e)}")
            return None

    def get_command(self, command: GetCommand | str) -> ReturnType:
        """
        Send the get command to the HayStack.
        :param command: Command string/enum
        """
        if parsed_command := find_in_enum(GetCommand, command):
            return self.send_command(Command.GET.value, [parsed_command])
        return None

    def set_command(self, command: SetCommand | str) -> ReturnType:
        """
        Send the set command to the HayStack.
        :param command: Command string/enum
        """
        if parsed_command := find_in_enum(SetCommand, command):
            return self.send_command(Command.SET.value, [parsed_command])
        return None

    def set_state(self, state: SetCommand | str) -> ReturnType:
        """
        Set the HayStack state.
        :param state: State string/enum
        """
        if parsed_state := find_in_enum(SetCommand, state):
            return self.send_command(Command.SET.value, [parsed_state])
        return None

    def status_command(self) -> ReturnType:
        """
        Send the status command to the HayStack.
        """
        return self.get_command(GetCommand.STATUS.value)

    def image_command(self, image_command: ImageCommand | str, number: int) -> ReturnType:
        """
        Send the image command to the HayStack.
        :param ImageCommand: Image command string
        :param number: Image number
        :return: True if sent successfully, False otherwise
        """
        if parsed_image_command := find_in_enum(ImageCommand, image_command):
            return self.send_command(Command.IMAGE.value, [number, parsed_image_command])
        return None

    def button_led_command(
        self, led_num: int | str | ButtonLed, led_command: LedCommand | str
    ) -> ReturnType:
        """
        Send the btn led command to the HayStack.
        :param ButtonLed: Button led command string
        """
        if (parsed_led_num := find_in_enum(ButtonLed, led_num)) and (
            parsed_command := find_in_enum(LedCommand, led_command)
        ):
            data = f"{parsed_led_num},{parsed_command}"
            return self.send_command(Command.BTN_LED.value, data)
        return None

    def led_command(self, led_num: int | str | Led, led_command: LedCommand | str) -> ReturnType:
        """
        Send the led command to the HayStack.
        :param LedCommand: Led command string
        """
        if (parsed_led_num := find_in_enum(Led, led_num)) and (
            parsed_command := find_in_enum(LedCommand, led_command)
        ):
            return self.send_command(Command.LED.value, [parsed_led_num, parsed_command])
        return None

    def reset_command(self, reset_type: ResetCommand | str) -> ReturnType:
        """
        Reset the HayStack.
        :param ResetCommand: Reset command string
        """
        if parsed_reset_type := find_in_enum(ResetCommand, reset_type):
            return self.send_command(Command.RESET.value, [parsed_reset_type])
        return None

    def set_phase_command(self, set_phase_command: SetPhaseCommand | str) -> ReturnType:
        """
        Send the set phase command to the HayStack.
        :param SetPhaseCommand: Set phase command string
        """
        if parsed_set_phase_command := find_in_enum(SetPhaseCommand, set_phase_command):
            return self.send_command(Command.SET_PHASE.value, [parsed_set_phase_command])
        return None

    def indicate_command(self, indicate_command: IndicateCommand | str) -> ReturnType:
        """
        Send the indicate command to the HayStack.
        :param IndicateCommand: Indicate command string
        """
        if parsed_indicate_command := find_in_enum(IndicateCommand, indicate_command):
            return self.send_command(Command.INDICATE.value, [parsed_indicate_command])
        return None

    def led_effect_command(self, led_effect_command: LedEffect | str) -> ReturnType:
        """
        Send the led effect command to the HayStack.
        :param LedEffect: Led effect command string
        """
        if parsed_led_effect_command := find_in_enum(LedEffect, led_effect_command):
            return self.send_command(Command.LED_EFFECT.value, [parsed_led_effect_command])
        return None

    def illuminator_command(self, illuminator_command: IlluminatorCommand | str) -> ReturnType:
        """
        Send the illuminator command to the HayStack.
        :param IlluminatorCommand: Illuminator command string
        """
        if parsed_illuminator_command := find_in_enum(IlluminatorCommand, illuminator_command):
            return self.send_command(Command.ILLUMINATOR.value, [parsed_illuminator_command])
        return None

    def cap_btn_indicate_command(self, indicator_command: BtnIndicatorCommand) -> ReturnType:
        """
        Send the cap btn indicate command to the HayStack.
        :param led0: LED0 state
        :param led1: LED1 state
        :param led2: LED2 state
        :param led3: LED3 state
        """
        data = (
            f"{int(indicator_command.btn4)}{int(indicator_command.btn3)}"
            f"{int(indicator_command.btn2)}{int(indicator_command.btn1)}"
        )
        return self.send_command(Command.CAP_BTN_INDICATE.value, [data])

    def post_command(self) -> ReturnType:
        """
        Send the post command to the HayStack.
        """
        return self.send_command(Command.SET.value, [SetCommand.POST.value])

    def set_btn_press_command(self) -> ReturnType:
        """
        Send the btn press command to the HayStack.
        """
        return self.send_command(Command.SET.value, [SetCommand.BTN_PRESS.value])

    def set_cam_mtx_command(self, values: list) -> ReturnType:
        """
        Send SET_CAM_MTX command with 9 float values (3x3 camera calibration matrix).
        :param values: List of 9 floats
        """
        if len(values) != 9:
            self.logger.error(f"SET_CAM_MTX requires 9 values, got {len(values)}")
            return None
        return self.send_command(Command.SET_CAM_MTX.value, values)

    def set_cam_dist_command(self, values: list) -> ReturnType:
        """
        Send SET_CAM_DIST command with 5 float values (5x1 distortion coefficient matrix).
        :param values: List of 5 floats
        """
        if len(values) != 5:
            self.logger.error(f"SET_CAM_DIST requires 5 values, got {len(values)}")
            return None
        return self.send_command(Command.SET_CAM_DIST.value, values)
