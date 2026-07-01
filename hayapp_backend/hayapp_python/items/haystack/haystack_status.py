# -*- coding: utf-8 -*-
from dataclasses import dataclass


@dataclass
class HayStackStatus:
    """
    Represents the 4-byte status structure for Haystack communication.

    Byte Layout (Internal representation):
    HBD1 (Byte 0): CHG | HC | RDY | MAGNET | Reserved(3) | ERROR
    HBD2 (Byte 1): ERROR_VALUE (full byte)
    HBD3 (Byte 2): Reserved for future use
    HBD4 (Byte 3): Reserved(4) | BTN1_LED | BTN2_LED | BTN3_LED | BTN4_LED

    Bit positions in HBD1:
    - bit 0: CHG (Change indicator)
    - bit 1: HC (Hay Container/Tray present)
    - bit 2: RDY (Ready status)
    - bit 3: MAGNET_ERROR (Magnet location error)
    - bits 4-6: Reserved
    - bit 7: ERROR (Error occurred)

    Device Wire Format (Legacy 32-bit HeartbeatStatus):
    The device sends status using an older 32-bit format where bits are mapped
    differently than the HBD byte structure. The conversion is:

    Old 32-bit format -> New HBD structure:
    - bit 31 (0x80000000, CHANGED) -> CHG (bit 0 of HBD1)
    - bit 30 (0x40000000, TRAY_PRESENT) -> HC (bit 1 of HBD1)
    - bit 29 (0x20000000, READY) -> RDY (bit 2 of HBD1)
    - bit 28 (0x10000000, MAG_ERROR) -> MAGNET_ERROR (bit 3 of HBD1)
    - bit 24 (0x01000000, ERROR) -> ERROR (bit 7 of HBD1)
    - bits 23-16 (0x00FF0000, ERROR_MASK) -> ERROR_VALUE (HBD2)
    - bit 3 (0x00000008, BTN1_LED_ON) -> BTN1_LED (bit 4 of HBD4)
    - bit 2 (0x00000004, BTN2_LED_ON) -> BTN2_LED (bit 5 of HBD4)
    - bit 1 (0x00000002, BTN3_LED_ON) -> BTN3_LED (bit 6 of HBD4)
    - bit 0 (0x00000001, BTN4_LED_ON) -> BTN4_LED (bit 7 of HBD4)

    Example: When tray is inserted (HC=True):
    - Device sends: "40000000" (TRAY_PRESENT bit set in old format)
    - Parsed as: HC=True in new format
    """

    # HBD1 flags (Byte 0)
    chg: bool = False  # Change Indicator (bit 0)
    hc: bool = False  # Hay Container Status (bit 1)
    rdy: bool = False  # Haystack Status (bit 2)
    magnet_error: bool = False  # Magnet Location Error (bit 3)
    error: bool = False  # Error Occurred (bit 7)

    # HBD2 (Byte 1)
    error_value: int = 0  # Error code (full byte)

    # HBD4 flags (Byte 3)
    btn1_led: bool = False  # Button 1 LED (bit 4)
    btn2_led: bool = False  # Button 2 LED (bit 5)
    btn3_led: bool = False  # Button 3 LED (bit 6)
    btn4_led: bool = False  # Button 4 LED (bit 7)

    def to_bytes(self) -> bytes:
        """Convert status to 4-byte representation."""
        hbd1 = 0
        hbd1 |= (1 << 0) if self.chg else 0
        hbd1 |= (1 << 1) if self.hc else 0
        hbd1 |= (1 << 2) if self.rdy else 0
        hbd1 |= (1 << 3) if self.magnet_error else 0
        hbd1 |= (1 << 7) if self.error else 0

        hbd2 = self.error_value & 0xFF

        hbd3 = 0  # Reserved for future use

        hbd4 = 0
        hbd4 |= (1 << 4) if self.btn1_led else 0
        hbd4 |= (1 << 5) if self.btn2_led else 0
        hbd4 |= (1 << 6) if self.btn3_led else 0
        hbd4 |= (1 << 7) if self.btn4_led else 0

        return bytes([hbd1, hbd2, hbd3, hbd4])

    @classmethod
    def from_bytes(cls, data: bytes) -> "HayStackStatus":
        """Create status from 4-byte representation."""
        if len(data) != 4:
            raise ValueError("Status data must be exactly 4 bytes")

        hbd1, hbd2, hbd3, hbd4 = data

        return cls(
            chg=bool(hbd1 & (1 << 0)),
            hc=bool(hbd1 & (1 << 1)),
            rdy=bool(hbd1 & (1 << 2)),
            magnet_error=bool(hbd1 & (1 << 3)),
            error=bool(hbd1 & (1 << 7)),
            error_value=hbd2,
            btn1_led=bool(hbd4 & (1 << 4)),
            btn2_led=bool(hbd4 & (1 << 5)),
            btn3_led=bool(hbd4 & (1 << 6)),
            btn4_led=bool(hbd4 & (1 << 7)),
        )

    def to_hex_string(self) -> str:
        """Convert status to hex string representation.

        Converts from the new HBD byte structure back to the old 32-bit
        HeartbeatStatus format used by the device.
        """
        # Convert from new byte structure to old 32-bit format
        status_int = 0
        status_int |= 0x80000000 if self.chg else 0  # bit 31
        status_int |= 0x40000000 if self.hc else 0  # bit 30 (TRAY_PRESENT)
        status_int |= 0x20000000 if self.rdy else 0  # bit 29
        status_int |= 0x10000000 if self.magnet_error else 0  # bit 28
        status_int |= 0x01000000 if self.error else 0  # bit 24
        status_int |= (self.error_value & 0xFF) << 16  # bits 23-16
        status_int |= 0x00000008 if self.btn1_led else 0  # bit 3
        status_int |= 0x00000004 if self.btn2_led else 0  # bit 2
        status_int |= 0x00000002 if self.btn3_led else 0  # bit 1
        status_int |= 0x00000001 if self.btn4_led else 0  # bit 0

        return f"{status_int:08X}"

    @classmethod
    def from_hex_string(cls, hex_str: str) -> "HayStackStatus":
        """Create status from hex string.

        The device sends status using the old 32-bit HeartbeatStatus format,
        which must be converted to the new HBD1-4 byte structure.
        """
        # Remove any spaces or 0x prefix
        hex_str = hex_str.replace(" ", "").replace("0x", "").replace("0X", "")
        if len(hex_str) != 8:  # 4 bytes = 8 hex chars
            raise ValueError("Hex string must be exactly 8 characters (4 bytes)")

        # Parse as 32-bit integer (old HeartbeatStatus format)
        status_int = int(hex_str, 16)

        # Convert from old 32-bit format to new byte structure
        # Old format bit positions -> New HBD byte positions:
        # bit 31 (CHANGED) -> CHG (bit 0 of HBD1)
        # bit 30 (TRAY_PRESENT) -> HC (bit 1 of HBD1)
        # bit 29 (READY) -> RDY (bit 2 of HBD1)
        # bit 28 (MAG_ERROR) -> MAGNET_ERROR (bit 3 of HBD1)
        # bit 24 (ERROR) -> ERROR (bit 7 of HBD1)
        # bits 23-16 (ERROR_MASK) -> ERROR_VALUE (HBD2)
        # bit 3 (BTN1_LED_ON) -> BTN1_LED (bit 4 of HBD4)
        # bit 2 (BTN2_LED_ON) -> BTN2_LED (bit 5 of HBD4)
        # bit 1 (BTN3_LED_ON) -> BTN3_LED (bit 6 of HBD4)
        # bit 0 (BTN4_LED_ON) -> BTN4_LED (bit 7 of HBD4)

        return cls(
            chg=bool(status_int & 0x80000000),  # bit 31
            hc=bool(status_int & 0x40000000),  # bit 30 (TRAY_PRESENT)
            rdy=bool(status_int & 0x20000000),  # bit 29
            magnet_error=bool(status_int & 0x10000000),  # bit 28
            error=bool(status_int & 0x01000000),  # bit 24
            error_value=(status_int >> 16) & 0xFF,  # bits 23-16
            btn1_led=bool(status_int & 0x00000008),  # bit 3
            btn2_led=bool(status_int & 0x00000004),  # bit 2
            btn3_led=bool(status_int & 0x00000002),  # bit 1
            btn4_led=bool(status_int & 0x00000001),  # bit 0
        )

    def __str__(self) -> str:
        """String representation of status."""
        return (
            f"HaystackStatus(CHG={self.chg}, HC={self.hc}, RDY={self.rdy}, "
            f"MAGNET_ERROR={self.magnet_error}, ERROR={self.error}, "
            f"ERROR_VALUE={self.error_value}, BTN_LEDS=[{self.btn1_led}, "
            f"{self.btn2_led}, {self.btn3_led}, {self.btn4_led}])"
        )
