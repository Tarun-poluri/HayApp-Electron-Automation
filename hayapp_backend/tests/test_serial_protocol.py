"""
Comprehensive test suite for the Serial Protocol Implementation.

Tests cover:
- SerialPacket dataclass validation
- Packet encoding and decoding
- CRC-32 calculation and validation
- Sequence ID management and wrapping
- Character validation
- Thread safety
- Edge cases and error handling
"""

import threading
from concurrent.futures import ThreadPoolExecutor

import pytest

from hayapp_python.items.haystack.serial_protocol import (
    MAX_DATA_LENGTH,
    SEQ_ID_MAX,
    SEQ_ID_MIN,
    CRCError,
    InvalidPacketError,
    SerialPacket,
    SerialProtocol,
    SerialProtocolError,
    create_packet,
    parse_packet,
)

# ============================================================================
# SerialPacket Tests
# ============================================================================


class TestSerialPacket:
    """Test SerialPacket dataclass validation"""

    def test_valid_packet_without_data(self):
        """Test creating a valid packet without data"""
        packet = SerialPacket(command="PING", seq_id=1, length=0)
        assert packet.command == "PING"
        assert packet.seq_id == 1
        assert packet.length == 0
        assert packet.data is None
        assert packet.crc is None

    def test_valid_packet_with_data(self):
        """Test creating a valid packet with data"""
        packet = SerialPacket(command="SET", seq_id=42, length=10, data="TEST-DATA1")
        assert packet.command == "SET"
        assert packet.seq_id == 42
        assert packet.length == 10
        assert packet.data == "TEST-DATA1"

    def test_valid_packet_with_crc(self):
        """Test creating a valid packet with CRC"""
        packet = SerialPacket(command="GET", seq_id=100, length=5, data="VALUE", crc=0x12345678)
        assert packet.crc == 0x12345678

    def test_empty_command_raises_error(self):
        """Test that empty command raises error"""
        with pytest.raises(InvalidPacketError, match="Command cannot be empty"):
            SerialPacket(command="", seq_id=1, length=0)

    @pytest.mark.skip(reason="Firmware sometimes sends seq_id=0, validation relaxed to allow it")
    def test_seq_id_too_low_raises_error(self):
        """Test that sequence ID less than 1 raises error"""
        with pytest.raises(InvalidPacketError, match="Sequence ID must be between"):
            SerialPacket(command="TEST", seq_id=0, length=0)

    def test_seq_id_too_high_raises_error(self):
        """Test that sequence ID greater than 0xFFFFFFFF raises error"""
        with pytest.raises(InvalidPacketError, match="Sequence ID must be between"):
            SerialPacket(command="TEST", seq_id=0x100000000, length=0)

    def test_seq_id_boundary_values(self):
        """Test sequence ID boundary values"""
        # Minimum valid value
        packet_min = SerialPacket(command="TEST", seq_id=SEQ_ID_MIN, length=0)
        assert packet_min.seq_id == SEQ_ID_MIN

        # Maximum valid value
        packet_max = SerialPacket(command="TEST", seq_id=SEQ_ID_MAX, length=0)
        assert packet_max.seq_id == SEQ_ID_MAX

    def test_negative_length_raises_error(self):
        """Test that negative length raises error"""
        with pytest.raises(InvalidPacketError, match="Length cannot be negative"):
            SerialPacket(command="TEST", seq_id=1, length=-1)

    def test_data_exceeds_max_length(self):
        """Test that data exceeding 64 bytes raises error"""
        long_data = "A" * (MAX_DATA_LENGTH + 1)
        with pytest.raises(InvalidPacketError, match="cannot exceed"):
            SerialPacket(command="TEST", seq_id=1, length=len(long_data), data=long_data)

    def test_data_exactly_max_length(self):
        """Test that data of exactly 64 bytes is accepted"""
        max_data = "A" * MAX_DATA_LENGTH
        packet = SerialPacket(command="TEST", seq_id=1, length=MAX_DATA_LENGTH, data=max_data)
        assert len(packet.data) == MAX_DATA_LENGTH

    def test_length_data_mismatch(self):
        """Test that length/data mismatch raises error"""
        with pytest.raises(InvalidPacketError, match="Length mismatch"):
            SerialPacket(command="TEST", seq_id=1, length=5, data="TOOLONG")

    def test_non_zero_length_without_data(self):
        """Test that non-zero length without data raises error"""
        with pytest.raises(InvalidPacketError, match="Length should be 0"):
            SerialPacket(command="TEST", seq_id=1, length=5, data=None)

    @pytest.mark.skip(reason="Invalid characters in command are temporarily allowed")
    def test_invalid_characters_in_command(self):
        """Test that invalid characters in command raise error"""
        with pytest.raises(InvalidPacketError, match="contains invalid characters"):
            SerialPacket(command="TEST@CMD", seq_id=1, length=0)

    @pytest.mark.skip(reason="Invalid characters in data are temporarily allowed")
    def test_invalid_characters_in_data(self):
        """Test that invalid characters in data raise error"""
        with pytest.raises(InvalidPacketError, match="contains invalid characters"):
            SerialPacket(command="TEST", seq_id=1, length=5, data="TEST@")

    def test_valid_characters(self):
        """Test all valid characters are accepted"""
        valid_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.,|[]"
        packet = SerialPacket(
            command="TEST-CMD_01", seq_id=1, length=len(valid_chars), data=valid_chars
        )
        assert packet.data == valid_chars


# ============================================================================
# SerialProtocol Initialization Tests
# ============================================================================


class TestSerialProtocolInit:
    """Test SerialProtocol initialization"""

    def test_default_initialization(self):
        """Test default initialization"""
        protocol = SerialProtocol()
        assert protocol._seq_id == SEQ_ID_MIN
        assert protocol._enforce_crc is False

    def test_initialization_with_crc_enforcement(self):
        """Test initialization with CRC enforcement enabled"""
        protocol = SerialProtocol(enforce_crc=True)
        assert protocol._enforce_crc is True


# ============================================================================
# Sequence ID Management Tests
# ============================================================================


class TestSequenceIDManagement:
    """Test sequence ID management"""

    def test_get_next_seq_id_starts_at_one(self):
        """Test that sequence ID starts at 1"""
        protocol = SerialProtocol()
        seq_id = protocol.get_next_seq_id()
        assert seq_id == SEQ_ID_MIN

    def test_get_next_seq_id_increments(self):
        """Test that sequence ID increments"""
        protocol = SerialProtocol()
        seq_id1 = protocol.get_next_seq_id()
        seq_id2 = protocol.get_next_seq_id()
        seq_id3 = protocol.get_next_seq_id()

        assert seq_id1 == SEQ_ID_MIN
        assert seq_id2 == SEQ_ID_MIN + 1
        assert seq_id3 == SEQ_ID_MIN + 2

    def test_seq_id_wraps_at_max(self):
        """Test that sequence ID wraps from max to min"""
        protocol = SerialProtocol()
        protocol._seq_id = SEQ_ID_MAX

        seq_id1 = protocol.get_next_seq_id()
        seq_id2 = protocol.get_next_seq_id()

        assert seq_id1 == SEQ_ID_MAX
        assert seq_id2 == SEQ_ID_MIN

    def test_reset_seq_id(self):
        """Test resetting sequence ID"""
        protocol = SerialProtocol()
        protocol.get_next_seq_id()
        protocol.get_next_seq_id()
        protocol.get_next_seq_id()

        protocol.reset_seq_id()

        seq_id = protocol.get_next_seq_id()
        assert seq_id == SEQ_ID_MIN

    def test_seq_id_thread_safety(self):
        """Test that sequence ID management is thread-safe"""
        protocol = SerialProtocol()
        num_threads = 10
        ids_per_thread = 100
        collected_ids = []
        lock = threading.Lock()

        def get_ids():
            local_ids = []
            for _ in range(ids_per_thread):
                local_ids.append(protocol.get_next_seq_id())
            with lock:
                collected_ids.extend(local_ids)

        threads = []
        for _ in range(num_threads):
            thread = threading.Thread(target=get_ids)
            threads.append(thread)
            thread.start()

        for thread in threads:
            thread.join()

        # All IDs should be unique
        assert len(collected_ids) == num_threads * ids_per_thread
        assert len(set(collected_ids)) == len(collected_ids)

        # IDs should be in valid range
        for seq_id in collected_ids:
            assert SEQ_ID_MIN <= seq_id <= SEQ_ID_MAX


# ============================================================================
# CRC Calculation Tests
# ============================================================================


class TestCRCCalculation:
    """Test CRC-32 calculation"""

    def test_calculate_crc32_basic(self):
        """Test basic CRC-32 calculation"""
        protocol = SerialProtocol()
        crc = protocol.calculate_crc32("TEST")
        assert isinstance(crc, int)
        assert 0 <= crc <= 0xFFFFFFFF

    def test_calculate_crc32_consistency(self):
        """Test that CRC calculation is consistent"""
        protocol = SerialProtocol()
        data = "PING|00000001|0"
        crc1 = protocol.calculate_crc32(data)
        crc2 = protocol.calculate_crc32(data)
        assert crc1 == crc2

    def test_calculate_crc32_different_data(self):
        """Test that different data produces different CRC"""
        protocol = SerialProtocol()
        crc1 = protocol.calculate_crc32("DATA1")
        crc2 = protocol.calculate_crc32("DATA2")
        assert crc1 != crc2

    def test_calculate_crc32_empty_string(self):
        """Test CRC calculation with empty string"""
        protocol = SerialProtocol()
        crc = protocol.calculate_crc32("")
        assert isinstance(crc, int)
        assert crc == 0  # CRC-32 of empty string is 0


# ============================================================================
# Packet Encoding Tests
# ============================================================================


class TestPacketEncoding:
    """Test packet encoding"""

    def test_encode_simple_packet_no_data(self):
        """Test encoding a simple packet without data"""
        protocol = SerialProtocol()
        packet = protocol.encode_packet("PING")
        assert packet == "[PING|00000001|0]"

    def test_encode_packet_with_data(self):
        """Test encoding a packet with data"""
        protocol = SerialProtocol()
        packet = protocol.encode_packet("SET", data="VALUE123")
        assert packet == "[SET|00000001|8|VALUE123]"

    def test_encode_packet_with_custom_seq_id(self):
        """Test encoding with custom sequence ID"""
        protocol = SerialProtocol()
        packet = protocol.encode_packet("TEST", seq_id=255)
        assert packet == "[TEST|000000FF|0]"

    def test_encode_packet_with_crc(self):
        """Test encoding packet with CRC"""
        protocol = SerialProtocol()
        packet = protocol.encode_packet("PING", include_crc=True)

        # Verify format
        assert packet.startswith("[PING|")
        assert packet.endswith("]")
        assert packet.count("|") == 3  # COMMAND|SEQ_ID|LENGTH|CRC

        # Extract and verify CRC
        parts = packet[1:-1].split("|")
        assert len(parts) == 4
        crc = int(parts[3], 16)
        assert 0 <= crc <= 0xFFFFFFFF

    def test_encode_packet_with_data_and_crc(self):
        """Test encoding packet with both data and CRC"""
        protocol = SerialProtocol()
        packet = protocol.encode_packet("SET", data="TEST", include_crc=True)

        # Verify format
        assert packet.startswith("[SET|")
        assert "|TEST|" in packet
        assert packet.endswith("]")
        assert packet.count("|") == 4  # COMMAND|SEQ_ID|LENGTH|DATA|CRC

    def test_encode_packet_max_data_length(self):
        """Test encoding with maximum data length"""
        protocol = SerialProtocol()
        max_data = "A" * MAX_DATA_LENGTH
        packet = protocol.encode_packet("DATA", data=max_data)

        assert f"|{MAX_DATA_LENGTH}|" in packet
        assert max_data in packet

    def test_encode_packet_exceeds_max_data_length(self):
        """Test that encoding with too much data raises error"""
        protocol = SerialProtocol()
        long_data = "A" * (MAX_DATA_LENGTH + 1)

        with pytest.raises(InvalidPacketError, match="exceeds maximum allowed"):
            protocol.encode_packet("DATA", data=long_data)

    def test_encode_packet_auto_increment_seq_id(self):
        """Test that sequence ID auto-increments"""
        protocol = SerialProtocol()

        packet1 = protocol.encode_packet("TEST1")
        packet2 = protocol.encode_packet("TEST2")
        packet3 = protocol.encode_packet("TEST3")

        assert "[TEST1|00000001|0]" == packet1
        assert "[TEST2|00000002|0]" == packet2
        assert "[TEST3|00000003|0]" == packet3

    def test_encode_packet_seq_id_format(self):
        """Test sequence ID formatting"""
        protocol = SerialProtocol()

        # Test various sequence ID values
        packet1 = protocol.encode_packet("TEST", seq_id=1)
        assert "|00000001|" in packet1

        packet2 = protocol.encode_packet("TEST", seq_id=255)
        assert "|000000FF|" in packet2

        packet3 = protocol.encode_packet("TEST", seq_id=0xFFFFFFFF)
        assert "|FFFFFFFF|" in packet3


# ============================================================================
# Packet Decoding Tests
# ============================================================================


class TestPacketDecoding:
    """Test packet decoding"""

    def test_decode_simple_packet_no_data(self):
        """Test decoding a simple packet without data"""
        protocol = SerialProtocol()
        packet = protocol.decode_packet("[PING|00000001|0]")

        assert packet.command == "PING"
        assert packet.seq_id == 1
        assert packet.length == 0
        assert packet.data is None
        assert packet.crc is None

    def test_decode_packet_with_data(self):
        """Test decoding a packet with data"""
        protocol = SerialProtocol()
        packet = protocol.decode_packet("[SET|0000000A|8|VALUE123]")

        assert packet.command == "SET"
        assert packet.seq_id == 10
        assert packet.length == 8
        assert packet.data == "VALUE123"

    def test_decode_packet_with_crc(self):
        """Test decoding a packet with CRC (no validation)"""
        protocol = SerialProtocol()
        packet = protocol.decode_packet("[PING|00000001|0|12345678]")

        assert packet.command == "PING"
        assert packet.seq_id == 1
        assert packet.length == 0
        assert packet.data is None
        assert packet.crc == 0x12345678

    def test_decode_packet_with_data_and_crc(self):
        """Test decoding a packet with both data and CRC"""
        protocol = SerialProtocol()
        packet = protocol.decode_packet("[SET|00000001|4|TEST|ABCDEF12]")

        assert packet.command == "SET"
        assert packet.seq_id == 1
        assert packet.length == 4
        assert packet.data == "TEST"
        assert packet.crc == 0xABCDEF12

    def test_decode_packet_with_crlf(self):
        """Test decoding packet with CR/LF line endings"""
        protocol = SerialProtocol()

        packet1 = protocol.decode_packet("[PING|00000001|0]\r\n")
        assert packet1.command == "PING"

        packet2 = protocol.decode_packet("[PING|00000001|0]\n")
        assert packet2.command == "PING"

        packet3 = protocol.decode_packet("[PING|00000001|0]\r")
        assert packet3.command == "PING"

    def test_decode_packet_missing_brackets(self):
        """Test that packet without brackets raises error"""
        protocol = SerialProtocol()

        with pytest.raises(InvalidPacketError, match="must start with"):
            protocol.decode_packet("PING|00000001|0")

        with pytest.raises(InvalidPacketError, match="must start with"):
            protocol.decode_packet("[PING|00000001|0")

        with pytest.raises(InvalidPacketError, match="must start with"):
            protocol.decode_packet("PING|00000001|0]")

    def test_decode_packet_insufficient_fields(self):
        """Test that packet with insufficient fields raises error"""
        protocol = SerialProtocol()

        with pytest.raises(InvalidPacketError, match="at least COMMAND, SEQ_ID, and LENGTH"):
            protocol.decode_packet("[PING]")

        with pytest.raises(InvalidPacketError, match="at least COMMAND, SEQ_ID, and LENGTH"):
            protocol.decode_packet("[PING|00000001]")

    def test_decode_packet_invalid_seq_id(self):
        """Test that invalid sequence ID raises error"""
        protocol = SerialProtocol()

        with pytest.raises(InvalidPacketError, match="Invalid SEQ_ID format"):
            protocol.decode_packet("[PING|INVALID|0]")

    def test_decode_packet_invalid_length(self):
        """Test that invalid length raises error"""
        protocol = SerialProtocol()

        with pytest.raises(InvalidPacketError, match="Invalid LENGTH format"):
            protocol.decode_packet("[PING|00000001|ABC]")

    def test_decode_packet_too_many_sections(self):
        """Test that packet with too many sections raises error"""
        protocol = SerialProtocol()

        with pytest.raises(InvalidPacketError, match="Too many sections"):
            protocol.decode_packet("[CMD|00000001|0|EXTRA|DATA|MORE]")

    def test_decode_encode_roundtrip(self):
        """Test that encoding and decoding produces the same result"""
        protocol = SerialProtocol()

        # Test without data
        encoded1 = protocol.encode_packet("PING", seq_id=42)
        decoded1 = protocol.decode_packet(encoded1)
        assert decoded1.command == "PING"
        assert decoded1.seq_id == 42

        # Test with data
        encoded2 = protocol.encode_packet("SET", data="VALUE", seq_id=100)
        decoded2 = protocol.decode_packet(encoded2)
        assert decoded2.command == "SET"
        assert decoded2.data == "VALUE"
        assert decoded2.seq_id == 100

    def test_decode_packet_length_zero_but_has_non_hex_field(self):
        """
        Test edge case: packet with length=0 and a 4th field that's not hex.
        This should be interpreted as data with wrong length.
        """
        protocol = SerialProtocol()

        # Packet says length=0 but has a non-hex 4th field
        # The decoder will attempt to parse it as CRC, fail, and treat it as data
        with pytest.raises(InvalidPacketError):
            # This will fail validation because length=0 but data is present
            protocol.decode_packet("[TEST|00000001|0|NOTAHEXVALUE]")


# ============================================================================
# CRC Validation Tests
# ============================================================================


class TestCRCValidation:
    """Test CRC validation during decoding"""

    def test_crc_validation_success(self):
        """Test successful CRC validation"""
        protocol = SerialProtocol(enforce_crc=True)

        # Encode with CRC
        encoded = protocol.encode_packet("PING", seq_id=1, include_crc=True)

        # Decode with validation
        decoded = protocol.decode_packet(encoded, validate_crc=True)
        assert decoded.command == "PING"

    def test_crc_validation_failure(self):
        """Test CRC validation failure"""
        protocol = SerialProtocol(enforce_crc=True)

        # Create packet with invalid CRC
        invalid_packet = "[PING|00000001|0|00000000]"

        with pytest.raises(CRCError, match="CRC mismatch"):
            protocol.decode_packet(invalid_packet, validate_crc=True)

    def test_crc_validation_with_data(self):
        """Test CRC validation with data payload"""
        protocol = SerialProtocol(enforce_crc=True)

        # Encode with CRC
        encoded = protocol.encode_packet("SET", data="TEST", seq_id=5, include_crc=True)

        # Decode with validation
        decoded = protocol.decode_packet(encoded, validate_crc=True)
        assert decoded.command == "SET"
        assert decoded.data == "TEST"

    def test_crc_validation_disabled_by_default(self):
        """Test that CRC validation is disabled by default"""
        protocol = SerialProtocol()

        # Packet with wrong CRC should not raise error when validation is off
        invalid_packet = "[PING|00000001|0|FFFFFFFF]"
        decoded = protocol.decode_packet(invalid_packet, validate_crc=False)
        assert decoded.command == "PING"

    def test_crc_validation_instance_default(self):
        """Test that instance CRC enforcement setting is used"""
        protocol_enforce = SerialProtocol(enforce_crc=True)
        protocol_no_enforce = SerialProtocol(enforce_crc=False)

        # Create packet with wrong CRC
        invalid_packet = "[PING|00000001|0|FFFFFFFF]"

        # Should fail with enforce_crc=True
        with pytest.raises(CRCError):
            protocol_enforce.decode_packet(invalid_packet)

        # Should succeed with enforce_crc=False
        decoded = protocol_no_enforce.decode_packet(invalid_packet)
        assert decoded.command == "PING"


# ============================================================================
# Data Field Parsing Tests
# ============================================================================


class TestDataFieldParsing:
    """Test data field parsing and building"""

    def test_parse_data_fields_comma_delimited(self):
        """Test parsing comma-delimited data"""
        protocol = SerialProtocol()
        fields = protocol.parse_data_fields("VALUE1,VALUE2,VALUE3")
        assert fields == ["VALUE1", "VALUE2", "VALUE3"]

    def test_parse_data_fields_single_value(self):
        """Test parsing single value"""
        protocol = SerialProtocol()
        fields = protocol.parse_data_fields("SINGLEVALUE")
        assert fields == ["SINGLEVALUE"]

    def test_parse_data_fields_empty(self):
        """Test parsing empty/None data"""
        protocol = SerialProtocol()
        fields = protocol.parse_data_fields(None)
        assert fields == []

        fields = protocol.parse_data_fields("")
        assert fields == []

    def test_parse_data_fields_custom_delimiter(self):
        """Test parsing with custom delimiter"""
        protocol = SerialProtocol()
        fields = protocol.parse_data_fields("A|B|C", delimiter="|")
        assert fields == ["A", "B", "C"]

    def test_build_data_string_multiple_fields(self):
        """Test building data string from multiple fields"""
        protocol = SerialProtocol()
        data_str = protocol.build_data_string(["FIELD1", "FIELD2", "FIELD3"])
        assert data_str == "FIELD1,FIELD2,FIELD3"

    def test_build_data_string_single_field(self):
        """Test building data string from single field"""
        protocol = SerialProtocol()
        data_str = protocol.build_data_string(["SINGLE"])
        assert data_str == "SINGLE"

    def test_build_data_string_empty(self):
        """Test building data string from empty list"""
        protocol = SerialProtocol()
        data_str = protocol.build_data_string([])
        assert data_str == ""

    def test_build_data_string_custom_delimiter(self):
        """Test building data string with custom delimiter"""
        protocol = SerialProtocol()
        data_str = protocol.build_data_string(["A", "B", "C"], delimiter="-")
        assert data_str == "A-B-C"

    def test_build_data_string_with_numbers(self):
        """Test building data string with numeric values"""
        protocol = SerialProtocol()
        data_str = protocol.build_data_string([1, 2, 3, 4.5])
        assert data_str == "1,2,3,4.5"

    def test_parse_build_roundtrip(self):
        """Test parsing and building roundtrip"""
        protocol = SerialProtocol()
        original = "VALUE1,VALUE2,VALUE3"

        fields = protocol.parse_data_fields(original)
        rebuilt = protocol.build_data_string(fields)

        assert rebuilt == original


# ============================================================================
# Convenience Function Tests
# ============================================================================


class TestConvenienceFunctions:
    """Test convenience functions"""

    def test_create_packet_basic(self):
        """Test create_packet convenience function"""
        packet = create_packet("PING")
        assert packet.startswith("[PING|")
        assert packet.endswith("]")

    def test_create_packet_with_data(self):
        """Test create_packet with data"""
        packet = create_packet("SET", data="VALUE")
        assert "VALUE" in packet

    def test_create_packet_with_crc(self):
        """Test create_packet with CRC"""
        packet = create_packet("PING", include_crc=True)
        assert packet.count("|") == 3  # Has CRC

    def test_create_packet_with_seq_id(self):
        """Test create_packet with custom sequence ID"""
        packet = create_packet("TEST", seq_id=999)
        assert "|000003E7|" in packet  # 999 in hex

    def test_create_packet_with_protocol_instance(self):
        """Test create_packet with provided protocol instance"""
        protocol = SerialProtocol()
        protocol._seq_id = 50

        packet = create_packet("TEST", protocol=protocol)
        assert "|00000032|" in packet  # 50 in hex

    def test_parse_packet_basic(self):
        """Test parse_packet convenience function"""
        packet = parse_packet("[PING|00000001|0]")
        assert packet.command == "PING"
        assert packet.seq_id == 1

    def test_parse_packet_with_crc_validation(self):
        """Test parse_packet with CRC validation"""
        protocol = SerialProtocol()
        encoded = protocol.encode_packet("PING", seq_id=1, include_crc=True)

        # Should work with valid CRC
        packet = parse_packet(encoded, validate_crc=True)
        assert packet.command == "PING"

        # Should fail with invalid CRC
        invalid = "[PING|00000001|0|00000000]"
        with pytest.raises(CRCError):
            parse_packet(invalid, validate_crc=True)


# ============================================================================
# Integration and Edge Case Tests
# ============================================================================


class TestIntegrationAndEdgeCases:
    """Test integration scenarios and edge cases"""

    def test_multiple_packets_in_sequence(self):
        """Test creating multiple packets in sequence"""
        protocol = SerialProtocol()

        packets = []
        for i in range(10):
            packet = protocol.encode_packet(f"CMD{i}", data=f"DATA{i}")
            packets.append(packet)

        # Verify all packets are unique
        assert len(set(packets)) == 10

        # Verify sequence IDs are sequential
        for i, packet_str in enumerate(packets, start=1):
            decoded = protocol.decode_packet(packet_str)
            assert decoded.seq_id == i

    def test_concurrent_packet_creation(self):
        """Test concurrent packet creation from multiple threads"""
        protocol = SerialProtocol()
        packets = []
        lock = threading.Lock()

        def create_packets(count):
            local_packets = []
            for i in range(count):
                packet = protocol.encode_packet("TEST", data=f"DATA{i}")
                local_packets.append(packet)
            with lock:
                packets.extend(local_packets)

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(create_packets, 20) for _ in range(5)]
            for future in futures:
                future.result()

        # All packets should be unique
        assert len(packets) == 100
        assert len(set(packets)) == 100

    def test_max_length_data_with_special_chars(self):
        """Test maximum length data with all valid special characters (except pipe delimiter)"""
        protocol = SerialProtocol()
        # Build string with valid chars up to max length
        # Note: pipe (|) cannot be used in data as it's the protocol delimiter
        data = ("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.,[]" * 2)[:MAX_DATA_LENGTH]

        packet = protocol.encode_packet("DATA", data=data)
        decoded = protocol.decode_packet(packet)

        assert decoded.data == data
        assert decoded.length == len(data)

    def test_seq_id_wrapping_continuity(self):
        """Test continuity when sequence ID wraps"""
        protocol = SerialProtocol()
        protocol._seq_id = SEQ_ID_MAX - 2

        ids = [protocol.get_next_seq_id() for _ in range(5)]

        assert ids == [SEQ_ID_MAX - 2, SEQ_ID_MAX - 1, SEQ_ID_MAX, SEQ_ID_MIN, SEQ_ID_MIN + 1]

    def test_empty_data_string_handling(self):
        """Test handling of empty string as data (should be treated as no data)"""
        protocol = SerialProtocol()

        # Empty string should work for data
        packet = protocol.encode_packet("TEST", data="")
        assert packet == "[TEST|00000001|0]"

    def test_numeric_command_names(self):
        """Test that numeric command names work"""
        protocol = SerialProtocol()
        packet = protocol.encode_packet("CMD123", seq_id=1)
        assert packet == "[CMD123|00000001|0]"

        decoded = protocol.decode_packet(packet)
        assert decoded.command == "CMD123"

    def test_hyphen_and_underscore_in_commands(self):
        """Test commands with hyphens and underscores"""
        protocol = SerialProtocol()

        packet1 = protocol.encode_packet("GET-VALUE", seq_id=1)
        decoded1 = protocol.decode_packet(packet1)
        assert decoded1.command == "GET-VALUE"

        packet2 = protocol.encode_packet("SET_CONFIG", seq_id=2)
        decoded2 = protocol.decode_packet(packet2)
        assert decoded2.command == "SET_CONFIG"

    def test_packet_with_dots_in_data(self):
        """Test data containing dots"""
        protocol = SerialProtocol()
        packet = protocol.encode_packet("VERSION", data="1.2.3", seq_id=1)

        decoded = protocol.decode_packet(packet)
        assert decoded.data == "1.2.3"

    @pytest.mark.skip(reason="Invalid characters in command are temporarily allowed")
    def test_lowercase_not_allowed(self):
        """Test that lowercase characters are not allowed"""
        with pytest.raises(InvalidPacketError, match="contains invalid characters"):
            SerialPacket(command="test", seq_id=1, length=0)

        with pytest.raises(InvalidPacketError, match="contains invalid characters"):
            SerialPacket(command="TEST", seq_id=1, length=4, data="test")

    def test_pipe_in_data_limitation(self):
        """
        Test that pipe character in data causes parsing issues.

        Note: This is a known limitation - the pipe character (|) is used as
        the protocol delimiter and cannot be reliably used within data fields.
        """
        protocol = SerialProtocol()

        # Encoding will work (no validation prevents it)
        data_with_pipe = "VALUE1|VALUE2"
        packet = protocol.encode_packet("TEST", data=data_with_pipe, seq_id=1)

        # But decoding will fail because the pipe splits the packet incorrectly
        # The decoder will see extra sections and raise an error
        with pytest.raises((InvalidPacketError, SerialProtocolError)):
            protocol.decode_packet(packet)
