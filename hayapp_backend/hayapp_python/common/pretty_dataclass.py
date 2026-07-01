from __future__ import annotations

from dataclasses import fields, is_dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping, Sequence, Union

# Configure your default timezone for display
DEFAULT_TZ = timezone.utc  # change to local if desired: datetime.now().astimezone().tzinfo


def format_datetime(dt: datetime) -> str:
    """
    Format a datetime with date, time, seconds, milliseconds, and timezone.
    Example: 2025-11-18 16:49:00.123 PST (UTC-08:00)
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=DEFAULT_TZ)
    local = dt.astimezone(DEFAULT_TZ)
    # Offset like +00:00
    offset_total_minutes = int(local.utcoffset().total_seconds() // 60)
    sign = "+" if offset_total_minutes >= 0 else "-"
    hh = abs(offset_total_minutes) // 60
    mm = abs(offset_total_minutes) % 60
    offset_str = f"{sign}{hh:02d}:{mm:02d}"

    # Name if available; otherwise "UTC±HH:MM"
    tz_name = local.tzname() or f"UTC{offset_str}"

    # Include milliseconds in the timestamp
    ms = local.microsecond // 1000

    return f"{local.strftime('%Y-%m-%d %H:%M:%S')}.{ms:03d} {tz_name} (UTC{offset_str})"


def format_timedelta(td: timedelta) -> str:
    """
    Format a timedelta with days, hours, minutes, seconds, and milliseconds.
    For durations under 1 minute, shows only milliseconds.
    """
    total_ms = int(td.total_seconds() * 1000)
    sign = "-" if total_ms < 0 else ""
    total_ms = abs(total_ms)

    days = total_ms // (24 * 3600 * 1000)
    rem = total_ms % (24 * 3600 * 1000)
    hours = rem // (3600 * 1000)
    rem %= 3600 * 1000
    minutes = rem // (60 * 1000)
    rem %= 60 * 1000
    seconds = rem // 1000
    ms = rem % 1000

    # For durations under 1 minute, just show milliseconds
    if not days and not hours and not minutes:
        return f"{sign}{total_ms}ms"

    # For longer durations, show full breakdown
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours or days:
        parts.append(f"{hours}h")
    if minutes or hours or days:
        parts.append(f"{minutes}m")
    if seconds or ms:
        parts.append(f"{seconds}s")
        if ms:
            parts.append(f"{ms}ms")

    return f"{sign}{' '.join(parts)}"


def format_epoch_seconds(value: Union[int, float]) -> str:
    """
    Interpret numeric value as epoch seconds and format as datetime.
    """
    try:
        dt = datetime.fromtimestamp(float(value), tz=timezone.utc)
    except (ValueError, OSError):  # out of range or bad value
        return str(value)
    return format_datetime(dt)


def format_value(v: Any) -> str:
    """
    Human-friendly formatting for common time-like values.
    - datetime → formatted date-time
    - timedelta → human-readable duration
    - int/float fields named like '*ts', '*_ts', '*_seconds' → epoch seconds
    - int/float fields named like '*_ms' → milliseconds duration
    Fallback: repr(v)
    """
    if isinstance(v, datetime):
        return format_datetime(v)
    if isinstance(v, timedelta):
        return format_timedelta(v)
    return repr(v)


def pretty_dataclass(obj: Any, indent: int = 0) -> str:
    """
    Recursively pretty-print a dataclass with time-aware formatting.
    Handles nested dataclasses, lists/tuples, and dicts.
    """
    spacer = "  " * indent
    if is_dataclass(obj):
        cls_name = obj.__class__.__name__
        lines = [f"{spacer}{cls_name}("]
        for f in fields(obj):
            raw = getattr(obj, f.name)
            val_str = _pretty_value(raw, indent + 1, field_name=f.name)
            lines.append(f"{spacer}  {f.name}={val_str},")
        lines.append(f"{spacer})")
        return "\n".join(lines)
    else:
        return _pretty_value(obj, indent)


def _pretty_value(v: Any, indent: int, field_name: str | None = None) -> str:
    spacer = "  " * indent

    # Dataclass
    if is_dataclass(v):
        return pretty_dataclass(v, indent)

    # Mapping
    if isinstance(v, Mapping):
        if not v:
            return "{}"
        lines = ["{"]
        for k, val in v.items():
            lines.append(f"{spacer}{repr(k)}: {_pretty_value(val, indent + 1)},")
        lines.append(f"{'  ' * (indent - 1)}}}" if indent > 0 else "}")
        return "\n".join(lines)

    # Sequence excluding str/bytes
    if isinstance(v, Sequence) and not isinstance(v, (str, bytes, bytearray)):
        if not v:
            return "[]"
        lines = ["["]
        for item in v:
            lines.append(f"{spacer}{_pretty_value(item, indent + 1)},")
        lines.append(f"{'  ' * (indent - 1)}]" if indent > 0 else "]")
        return "\n".join(lines)

    # Time-aware heuristics based on field name
    if field_name:
        # Epoch seconds
        if isinstance(v, (int, float)) and (
            field_name.endswith("ts")
            or field_name.endswith("_ts")
            or field_name.endswith("_seconds")
            or field_name.endswith("_secs")
        ):
            return format_epoch_seconds(v)
        # Milliseconds durations
        if isinstance(v, (int, float)) and (
            field_name.endswith("_ms")
            or field_name.endswith("Millis")
            or field_name.endswith("Milliseconds")
        ):
            td = timedelta(milliseconds=float(v))
            return format_timedelta(td)

    # Direct type-based formatting
    if isinstance(v, datetime):
        return format_datetime(v)
    if isinstance(v, timedelta):
        return format_timedelta(v)

    # Fallback
    return repr(v)


# Convenience mixin to add a .pretty() method to dataclasses
class PrettyMixin:
    def pretty(self) -> str:
        return pretty_dataclass(self)
