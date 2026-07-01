"""
Serial Protocol Implementation for HayStack Communication

This module implements the serial communication protocol
as specified in section 6 of the documentation:
- Packet format: [COMMAND|SEQ_ID|LENGTH|DATA|CRC]
- Baudrate: 115200, 8N1, No Flow Control
- Sequence ID management (thread-safe)
- CRC-32 validation (optional)

Thread Safety:
    The SerialProtocol class is thread-safe for sequence ID management.
    Multiple threads can safely call encode_packet() and get_next_seq_id()
    without race conditions.
"""

import binascii

# import re
import threading
from dataclasses import dataclass
from typing import Optional

# Protocol constraints
MAX_DATA_LENGTH = 128  # TODO: Update protocol documentation
SEQ_ID_MIN = 0x00000001
SEQ_ID_MAX = 0xFFFFFFFF

# Protocol format constants
CRC32_MASK = 0xFFFFFFFF
HEX_FORMAT_WIDTH = 8  # 8-character hex strings for seq_id and CRC
HEXADECIMAL_BASE = 16

# Packet structure constants
PACKET_START_CHAR = "["
PACKET_END_CHAR = "]"
PACKET_DELIMITER = "|"
MIN_PACKET_PARTS = 3  # COMMAND, SEQ_ID, LENGTH
MAX_PACKET_PARTS = 5  # COMMAND, SEQ_ID, LENGTH, DATA, CRC
PARTS_WITH_OPTIONAL = 4  # COMMAND, SEQ_ID, LENGTH, DATA or CRC
PARTS_WITH_BOTH = 5  # COMMAND, SEQ_ID, LENGTH, DATA, CRC

# Field indices
COMMAND_INDEX = 0
SEQ_ID_INDEX = 1
LENGTH_INDEX = 2
DATA_INDEX = 3
CRC_INDEX_NO_DATA = 3
CRC_INDEX_WITH_DATA = 4


class SerialProtocolError(Exception):
    """Base exception for serial protocol errors"""

    pass


class InvalidPacketError(SerialProtocolError):
    """Raised when a packet is malformed or invalid"""

    pass


class CRCError(SerialProtocolError):
    """Raised when CRC validation fails"""

    pass


@dataclass
class SerialPacket:
    """
    Represents a serial protocol packet.

    Attributes:
        command: The command name
        seq_id: Sequence ID (1-0xFFFFFFFF)
        length: Length of data section
        data: Optional payload data (max 64 bytes)
        crc: Optional CRC-32 checksum
    """

    command: str
    seq_id: int
    length: int
    data: Optional[str] = None
    crc: Optional[int] = None

    def __post_init__(self):
        """Validate packet fields"""
        if not self.command:
            raise InvalidPacketError("Command cannot be empty")

        # TODO: Use min, firware bug
        if not (0 <= self.seq_id <= SEQ_ID_MAX):
            raise InvalidPacketError(
                f"Sequence ID must be between 0 and {SEQ_ID_MAX:#X}, got {self.seq_id}"
            )

        if self.length < 0:
            raise InvalidPacketError(f"Length cannot be negative, got {self.length}")

        if self.data:
            if len(self.data) > MAX_DATA_LENGTH:
                raise InvalidPacketError(
                    f"Data section cannot exceed {MAX_DATA_LENGTH} bytes, got {len(self.data)}"
                )
            if self.length != len(self.data):
                raise InvalidPacketError(
                    f"Length mismatch: LENGTH={self.length}, actual data length={len(self.data)}"
                )
        else:
            if self.length != 0:
                raise InvalidPacketError(
                    f"Length should be 0 when no data is present, got {self.length}"
                )

        # Validate allowable characters
        self._validate_characters()

    def _validate_characters(self):
        """Validate that packet contains only allowable ASCII characters"""
        # Allowable: 'A'-'Z', '0'-'9', '-', '_', '.', '|', '[', ']', ','
        # allowed_pattern = re.compile(r"^[A-Z0-9\-_.,|[\]]+$")

        # if not allowed_pattern.match(self.command):
        #     raise InvalidPacketError(f"Command contains invalid characters: {self.command}")

        # if self.data and not allowed_pattern.match(self.data):
        #     raise InvalidPacketError(f"Data contains invalid characters: {self.data}")
        pass  # TODO: Update protocol documentation


class SerialProtocol:
    """
    Handles encoding and decoding of serial protocol packets.
    Manages sequence ID and CRC validation.

    This class is thread-safe for sequence ID management. Multiple threads
    can safely encode packets without race conditions on the sequence counter.
    """

    def __init__(self, enforce_crc: bool = False):
        """
        Initialize the serial protocol handler.

        Args:
            enforce_crc: If True, CRC validation is enforced when present
        """
        self._seq_id = SEQ_ID_MIN
        self._enforce_crc = enforce_crc
        self._seq_id_lock = threading.Lock()

    def get_next_seq_id(self) -> int:
        """
        Get the next sequence ID and increment the counter.
        Automatically wraps from 0xFFFFFFFF back to 0x00000001.

        Thread-safe: Uses internal locking to prevent race conditions.

        Returns:
            The next sequence ID
        """
        with self._seq_id_lock:
            current_id = self._seq_id
            if self._seq_id >= SEQ_ID_MAX:
                self._seq_id = SEQ_ID_MIN
            else:
                self._seq_id += 1
            return current_id

    def reset_seq_id(self):
        """
        Reset sequence ID counter to initial value.

        Thread-safe: Uses internal locking to prevent race conditions.
        """
        with self._seq_id_lock:
            self._seq_id = SEQ_ID_MIN

    @staticmethod
    def calculate_crc32(data: str) -> int:
        """
        Calculate CRC-32 checksum for the given data.

        Args:
            data: String data to calculate CRC for

        Returns:
            CRC-32 value as a 32-bit unsigned integer
        """
        # Calculate CRC-32 on the bytes representation
        crc = binascii.crc32(data.encode("ascii")) & CRC32_MASK
        return crc

    def encode_packet(
        self,
        command: str,
        data: Optional[str] = None,
        seq_id: Optional[int] = None,
        include_crc: bool = False,
    ) -> str:
        """
        Encode a packet according to the serial protocol format.

        Args:
            command: Command name
            data: Optional payload data (comma-delimited if multiple values)
            seq_id: Optional sequence ID (if None, auto-generates next ID)
            include_crc: Whether to include CRC checksum

        Returns:
            Formatted packet string: [COMMAND|SEQ_ID|LENGTH|DATA|CRC]

        Raises:
            InvalidPacketError: If packet parameters are invalid
        """
        # Use provided seq_id or generate next one
        if seq_id is None:
            seq_id = self.get_next_seq_id()

        # Calculate length
        length = len(data) if data else 0

        # Check max data length constraint
        if length > MAX_DATA_LENGTH:
            raise InvalidPacketError(
                f"Data length {length} exceeds maximum allowed {MAX_DATA_LENGTH} bytes"
            )

        # Format sequence ID as hex string (lowercase to match firmware expectations)
        seq_id_hex = f"{seq_id:0{HEX_FORMAT_WIDTH}X}"  # Produces: 0000000a
        # seq_id_hex = f"{seq_id:x}"
        # Build packet without CRC first
        if data:
            packet_content = (
                f"{command}{PACKET_DELIMITER}{seq_id_hex}{PACKET_DELIMITER}"
                f"{length}{PACKET_DELIMITER}{data}"
            )
        else:
            packet_content = f"{command}{PACKET_DELIMITER}{seq_id_hex}{PACKET_DELIMITER}{length}"

        # Calculate and append CRC if requested
        crc = None
        if include_crc:
            crc = self.calculate_crc32(packet_content)
            crc_hex = f"{crc:0{HEX_FORMAT_WIDTH}x}"
            packet_content += f"{PACKET_DELIMITER}{crc_hex}"

        # Wrap with brackets
        packet = f"{PACKET_START_CHAR}{packet_content}{PACKET_END_CHAR}"

        # Create packet object for validation
        SerialPacket(command=command, seq_id=seq_id, length=length, data=data, crc=crc)

        return packet

    def _validate_and_split_packet(self, packet_str: str) -> list:
        """
        Validate packet format and split into parts.

        Args:
            packet_str: Raw packet string to validate

        Returns:
            List of packet parts split by pipe character

        Raises:
            InvalidPacketError: If packet format is invalid
        """
        # Remove optional CR/LF at the end
        packet_str = packet_str.rstrip("\r\n")

        # Check packet boundaries
        if not packet_str.startswith(PACKET_START_CHAR) or not packet_str.endswith(PACKET_END_CHAR):
            raise InvalidPacketError(
                f"Packet must start with '{PACKET_START_CHAR}' and end with "
                f"'{PACKET_END_CHAR}': {packet_str}"
            )

        # Remove brackets and split by pipe character
        content = packet_str[1:-1]
        parts = content.split(PACKET_DELIMITER)

        # Validate minimum number of parts (COMMAND, SEQ_ID, LENGTH)
        if len(parts) < MIN_PACKET_PARTS:
            raise InvalidPacketError(
                f"Packet must have at least COMMAND, SEQ_ID, and LENGTH: {packet_str}"
            )

        if len(parts) > MAX_PACKET_PARTS:
            raise InvalidPacketError(f"Too many sections in packet: {len(parts)}")

        return parts

    def _parse_mandatory_fields(self, parts: list) -> tuple:
        """
        Parse mandatory packet fields: command, seq_id, and length.

        Args:
            parts: List of packet parts

        Returns:
            Tuple of (command, seq_id, length)

        Raises:
            InvalidPacketError: If fields cannot be parsed
        """
        command = parts[COMMAND_INDEX]

        try:
            seq_id = int(parts[SEQ_ID_INDEX], HEXADECIMAL_BASE)
        except ValueError:
            raise InvalidPacketError(f"Invalid SEQ_ID format: {parts[SEQ_ID_INDEX]}")

        try:
            length = int(parts[LENGTH_INDEX])
        except ValueError:
            raise InvalidPacketError(f"Invalid LENGTH format: {parts[LENGTH_INDEX]}")

        return command, seq_id, length

    def _parse_optional_fields(self, parts: list, length: int) -> tuple:
        """
        Parse optional packet fields: data and crc.

        Args:
            parts: List of packet parts
            length: Expected data length

        Returns:
            Tuple of (data, crc)

        Raises:
            InvalidPacketError: If fields cannot be parsed
        """
        data = None
        crc = None

        if len(parts) == PARTS_WITH_OPTIONAL:
            # Either DATA or CRC (if length is 0)
            if length > 0:
                data = parts[DATA_INDEX]
            else:
                # No data, so this must be CRC
                try:
                    crc = int(parts[CRC_INDEX_NO_DATA], HEXADECIMAL_BASE)
                except ValueError:
                    # Maybe it's actually data with wrong length
                    data = parts[DATA_INDEX]

        elif len(parts) == PARTS_WITH_BOTH:
            # Both DATA and CRC
            data = parts[DATA_INDEX]
            try:
                crc = int(parts[CRC_INDEX_WITH_DATA], HEXADECIMAL_BASE)
            except ValueError:
                raise InvalidPacketError(f"Invalid CRC format: {parts[CRC_INDEX_WITH_DATA]}")

        return data, crc

    def _validate_packet_crc(
        self, command: str, seq_id_hex: str, length: int, data: Optional[str], crc: int
    ):
        """
        Validate packet CRC against calculated value.

        Args:
            command: Command string
            seq_id_hex: Sequence ID in hexadecimal format
            length: Data length
            data: Optional data string
            crc: CRC value to validate

        Raises:
            CRCError: If CRC validation fails
        """
        # Reconstruct packet content without CRC for validation
        if data:
            content_without_crc = (
                f"{command}{PACKET_DELIMITER}{seq_id_hex}{PACKET_DELIMITER}"
                f"{length}{PACKET_DELIMITER}{data}"
            )
        else:
            content_without_crc = (
                f"{command}{PACKET_DELIMITER}{seq_id_hex}{PACKET_DELIMITER}{length}"
            )

        calculated_crc = self.calculate_crc32(content_without_crc)
        if calculated_crc != crc:
            raise CRCError(
                f"CRC mismatch: expected {crc:0{HEX_FORMAT_WIDTH}X}, "
                f"calculated {calculated_crc:0{HEX_FORMAT_WIDTH}X}"
            )

    def decode_packet(self, packet_str: str, validate_crc: bool = None) -> SerialPacket:
        """
        Decode a packet string into a SerialPacket object.

        Args:
            packet_str: Raw packet string to decode
            validate_crc: Whether to validate CRC if present (uses instance default if None)

        Returns:
            Parsed SerialPacket object

        Raises:
            InvalidPacketError: If packet format is invalid
            CRCError: If CRC validation fails
        """
        if validate_crc is None:
            validate_crc = self._enforce_crc

        # Validate and split packet
        parts = self._validate_and_split_packet(packet_str)

        # Parse mandatory fields
        command, seq_id, length = self._parse_mandatory_fields(parts)

        # Parse optional fields
        data, crc = self._parse_optional_fields(parts, length)

        # Validate CRC if present and validation is enabled
        if crc is not None and validate_crc:
            self._validate_packet_crc(command, parts[SEQ_ID_INDEX], length, data, crc)

        # Create and return packet object
        packet = SerialPacket(command=command, seq_id=seq_id, length=length, data=data, crc=crc)

        return packet

    def parse_data_fields(self, data: Optional[str], delimiter: str = ",") -> list:
        """
        Parse comma-delimited data fields.

        Args:
            data: Data string to parse
            delimiter: Field delimiter (default: ',')

        Returns:
            List of parsed fields
        """
        if not data:
            return []
        return data.split(delimiter)

    def build_data_string(self, fields: list, delimiter: str = ",") -> str:
        """
        Build a comma-delimited data string from fields.

        Args:
            fields: List of field values
            delimiter: Field delimiter (default: ',')

        Returns:
            Comma-delimited string
        """
        return delimiter.join(str(field) for field in fields)


# Convenience functions for common operations


def create_packet(
    command: str,
    data: Optional[str] = None,
    seq_id: Optional[int] = None,
    include_crc: bool = False,
    protocol: Optional[SerialProtocol] = None,
) -> str:
    """
    Create a formatted packet string.

    Args:
        command: Command name
        data: Optional payload data
        seq_id: Optional sequence ID (auto-generated if None)
        include_crc: Whether to include CRC
        protocol: Optional SerialProtocol instance (creates new one if None)

    Returns:
        Formatted packet string
    """
    if protocol is None:
        protocol = SerialProtocol()
    return protocol.encode_packet(command, data, seq_id, include_crc)


def parse_packet(packet_str: str, validate_crc: bool = False) -> SerialPacket:
    """
    Parse a packet string.

    Args:
        packet_str: Raw packet string
        validate_crc: Whether to validate CRC if present

    Returns:
        Parsed SerialPacket object
    """
    protocol = SerialProtocol(enforce_crc=validate_crc)
    return protocol.decode_packet(packet_str)
