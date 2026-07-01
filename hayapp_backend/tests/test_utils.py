"""
Tests for utility functions in hayapp_python.common.utils
"""

from hayapp_python.common.utils import find_in_enum
from hayapp_python.items.haystack.haystack_interface import (
    ButtonLed,
    Command,
    GetCommand,
    HeartbeatStatus,
    ImageCommand,
    Led,
    LedColor,
    LedCommand,
    LedEffect,
    ResetCommand,
    SetCommand,
)

# ============================================================================
# find_in_enum Function Tests
# ============================================================================


class TestFindInEnum:
    """Test find_in_enum utility function"""

    def test_find_in_enum_with_string_uppercase(self):
        """Test finding enum value with uppercase string"""
        # Test with string enum (uppercase)
        result = find_in_enum(GetCommand, "STACK_ID")
        assert result == "STACK_ID"

        result = find_in_enum(SetCommand, "READY")
        assert result == "READY"

    def test_find_in_enum_with_string_lowercase(self):
        """Test finding enum value with lowercase string (should be converted to uppercase)"""
        # Test with lowercase string (should be converted to uppercase)
        result = find_in_enum(GetCommand, "stack_id")
        assert result == "STACK_ID"

        result = find_in_enum(SetCommand, "ready")
        assert result == "READY"

        result = find_in_enum(GetCommand, "Version")
        assert result == "VERSION"

    def test_find_in_enum_with_string_mixed_case(self):
        """Test finding enum value with mixed case string"""
        result = find_in_enum(GetCommand, "StAcK_iD")
        assert result == "STACK_ID"

        result = find_in_enum(LedCommand, "On")
        assert result == "ON"

        result = find_in_enum(LedCommand, "oFf")
        assert result == "OFF"

    def test_find_in_enum_with_string_invalid(self):
        """Test finding enum value with invalid string"""
        # Test with invalid string
        result = find_in_enum(GetCommand, "INVALID_COMMAND")
        assert result is None

        result = find_in_enum(SetCommand, "DOES_NOT_EXIST")
        assert result is None

    def test_find_in_enum_with_int_valid(self):
        """Test finding enum value with valid integer"""
        # Test with integer enum values
        result = find_in_enum(ButtonLed, 1)
        assert result == 1

        result = find_in_enum(ButtonLed, 5)
        assert result == 5

        result = find_in_enum(Led, 15)
        assert result == 15

        result = find_in_enum(Led, 16)
        assert result == 16

        result = find_in_enum(LedEffect, 0)
        assert result == 0

        result = find_in_enum(LedEffect, 3)
        assert result == 3

    def test_find_in_enum_with_int_invalid(self):
        """Test finding enum value with invalid integer"""
        # Test with invalid integer
        result = find_in_enum(ButtonLed, 999)
        assert result is None

        result = find_in_enum(Led, 100)
        assert result is None

        result = find_in_enum(LedEffect, -1)
        assert result is None

    def test_find_in_enum_with_enum_instance(self):
        """Test finding enum value with enum instance"""
        # Test with enum instance
        result = find_in_enum(GetCommand, GetCommand.STACK_ID)
        assert result == "STACK_ID"

        result = find_in_enum(SetCommand, SetCommand.READY)
        assert result == "READY"

        result = find_in_enum(ButtonLed, ButtonLed.YES)
        assert result == 1

        result = find_in_enum(Led, Led.ALL)
        assert result == 15

        result = find_in_enum(LedCommand, LedCommand.ON)
        assert result == "ON"

    def test_find_in_enum_with_invalid_type(self):
        """Test finding enum value with invalid type"""
        # Test with invalid types
        result = find_in_enum(GetCommand, None)
        assert result is None

        result = find_in_enum(GetCommand, [1, 2, 3])
        assert result is None

        result = find_in_enum(GetCommand, {"key": "value"})
        assert result is None

        result = find_in_enum(GetCommand, 3.14)
        assert result is None

    def test_find_in_enum_with_different_enum_types(self):
        """Test find_in_enum with various enum types"""
        # Test with Command enum
        result = find_in_enum(Command, "GET")
        assert result == "GET"

        # Test with ResetCommand enum
        result = find_in_enum(ResetCommand, "SYSTEM")
        assert result == "SYSTEM"

        result = find_in_enum(ResetCommand, ResetCommand.BLUETOOTH)
        assert result == "BLUETOOTH"

        # Test with ImageCommand enum
        result = find_in_enum(ImageCommand, "DONE")
        assert result == "DONE"

        result = find_in_enum(ImageCommand, ImageCommand.FAIL)
        assert result == "FAIL"

        # Test with LedColor enum (integer values)
        result = find_in_enum(LedColor, 0)
        assert result == 0

        result = find_in_enum(LedColor, LedColor.RED)
        assert result == 0

        result = find_in_enum(LedColor, 6)
        assert result == 6

    def test_find_in_enum_string_with_underscore(self):
        """Test finding enum value with string containing underscore"""
        # Test enum names with underscores
        result = find_in_enum(GetCommand, "STACK_ID")
        assert result == "STACK_ID"

        result = find_in_enum(GetCommand, "stack_id")
        assert result == "STACK_ID"

        result = find_in_enum(SetCommand, "NOT_READY")
        assert result == "NOT_READY"

        result = find_in_enum(SetCommand, "not_ready")
        assert result == "NOT_READY"

        result = find_in_enum(ResetCommand, "BTN_OUTPUT")
        assert result == "BTN_OUTPUT"

    def test_find_in_enum_edge_cases(self):
        """Test edge cases for find_in_enum"""
        # Test with integer enum that has large values
        result = find_in_enum(HeartbeatStatus, 0x80000000)
        assert result == 0x80000000

        result = find_in_enum(HeartbeatStatus, HeartbeatStatus.CHANGED)
        assert result == 0x80000000

        # Test with zero value
        result = find_in_enum(LedEffect, 0)
        assert result == 0

        result = find_in_enum(LedColor, 0)
        assert result == 0

        # Test with empty string (should fail)
        result = find_in_enum(GetCommand, "")
        assert result is None
