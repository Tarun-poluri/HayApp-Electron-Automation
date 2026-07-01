import hashlib
import json
import os
import shutil
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Optional, Type

from hayapp_python.common.config_manager import config


def get_utc_iso_timestamp(timestamp: Optional[int] = None) -> str:
    """
    Returns the current UTC time as an ISO 8601 string.
    Example: '2025-11-04T15:23:45.123456+00:00'
    """
    if timestamp:
        return datetime.fromtimestamp(timestamp / 1000).isoformat()
    return datetime.now(tz=timezone.utc).isoformat()


def get_utc_time_string(timestamp: Optional[int] = None) -> str:
    """
    Returns the current UTC time as a formatted string: '03:45:12 PM'
    """
    if timestamp:
        return datetime.fromtimestamp(timestamp / 1000).strftime("%I:%M:%S %p")
    return datetime.now(tz=timezone.utc).strftime("%I:%M:%S %p")


def get_local_time_string(timestamp: Optional[int] = None) -> str:
    """
    Returns the current local time as a formatted string: '03:45:12 PM'
    """
    if timestamp:
        return datetime.fromtimestamp(timestamp / 1000).strftime("%I:%M:%S %p")
    return datetime.now().strftime("%I:%M:%S %p")


def hash_password(password, salt=""):
    if not isinstance(password, str):
        password = str(password)
    if salt:
        password = salt + password
    print(password)
    return hashlib.sha512(password.encode("utf-8")).hexdigest()


def calculate_md5(file_path):
    md5_hash = hashlib.md5(usedforsecurity=False)
    try:
        with open(file_path, "rb") as f:
            # Read the file in chunks to handle large files
            for chunk in iter(lambda: f.read(4096), b""):
                md5_hash.update(chunk)
    except FileNotFoundError:
        return None
    return md5_hash.hexdigest()


@contextmanager
def change_directory(path: Path):
    """
    Context manager for temporarily changing working directory.

    Args:
        path: Directory to change to

    Yields:
        None
    """
    original_dir = Path.cwd()
    try:
        path.mkdir(parents=True, exist_ok=True)
        os.chdir(path)
        yield
    finally:
        os.chdir(original_dir)


def find_in_enum(enum: Type[Enum], user_value: int | str | Enum) -> Optional[str]:
    """
    Find a value in an enum.
    :param enum: Enum
    :param user_value: Value string, int, or Enum
    :return: Value or None if not found
    """
    if isinstance(user_value, str):
        user_value_upper = user_value.upper()
        try:
            return enum[user_value_upper].value
        except KeyError:
            print(f"Invalid value: {user_value_upper}, must be one of: {[e.value for e in enum]}")
            return None
    elif isinstance(user_value, int):
        # Search by value
        for e in enum:
            if e.value == user_value:
                return e.value
        print(f"Invalid int value: {user_value}, must be one of: {[e.value for e in enum]}")
        return None
    elif isinstance(user_value, enum):
        # If it's an instance of the enum itself
        return user_value.value
    else:
        print(f"Invalid type for user_value: {type(user_value).__name__}")
        return None


def update_subdict(
    data: dict[str, Any], path: list[str], value: Any, create_missing: bool = True
) -> dict[str, Any]:
    """
    Update a nested dictionary at the given path with the provided value.

    Args:
        data: The dictionary to mutate.
        path: Either a list/iterable of keys, or a dot-delimited string ("a.b.c").
        value: The value to set at the final key.
        create_missing: If True, create any missing intermediate dictionaries.
                        If False, raise a KeyError when encountering a missing key.

    Returns:
        The original dictionary (mutated in place for convenience).

    Raises:
        TypeError: If a non-dict is encountered before reaching the final key.
        KeyError: If create_missing=False and a key along the path is missing.
        ValueError: If the path is empty.
    """
    keys = [str(k) for k in path]
    if not keys:
        raise ValueError("Path must contain at least one key")

    current = data
    # Traverse to the parent of the final key
    for i, key in enumerate(keys[:-1]):
        if not isinstance(current, dict):
            raise TypeError(
                f"Encountered non-dict at path segment {i} ('{key}'); cannot descend further"
            )

        if key not in current:
            if create_missing:
                current[key] = {}
            else:
                raise KeyError(f"Missing key '{key}' at path segment {i}")

        # After ensuring existence, verify it's a dict (for descent)
        if not isinstance(current[key], dict):
            if create_missing:
                # Overwrite non-dict with dict to continue; safer alternative is to raise.
                # Choose behavior explicitly; here we raise to prevent silent data loss.
                raise TypeError(
                    f"Existing value at '{key}' is not a dict (type={type(current[key]).__name__});"
                    " cannot create nested key under a non-dict"
                )
            else:
                raise TypeError(
                    f"Existing value at '{key}' is not a dict; "
                    "cannot descend without create_missing"
                )

        current = current[key]

    # Set the final value
    final_key = keys[-1]
    if not isinstance(current, dict):
        raise TypeError(f"Final parent is not a dict; cannot set key '{final_key}'")
    current[final_key] = value
    return data


def collect_detector_data(
    image_path: str, config_path: str, reference_image_path: str, output_str: str
) -> Path:
    """
    Collect input and output data for needle detector

    Args:
        image_path: Path to the input image
        config_path: Path to the config file
        reference_image_path: Path to the reference image
        output_str: Output string from needle detector

    Returns:
        None
    """
    # Skip if output_str is None (detection failed)
    if output_str is None:
        return

    stub_name = os.path.basename(image_path).split(".")[0]
    image_name = os.path.basename(image_path)
    output_image_name = os.path.basename(image_path) + "-out.png"
    output_image_path = os.path.join(os.path.dirname(image_path), output_image_name)
    config_name = os.path.basename(config_path)
    reference_image_name = os.path.basename(reference_image_path) if reference_image_path else None

    target_dir = config.paths.processed_images_path / stub_name
    if not target_dir.exists():
        target_dir.mkdir(parents=True)

    target_image_path = target_dir / image_name
    target_output_image_path = target_dir / output_image_name
    target_config_path = target_dir / config_name
    target_reference_image_path = (
        target_dir / reference_image_name if reference_image_name else None
    )
    target_output_path = target_dir / f"{stub_name}_detector_output.txt"
    with open(target_output_path, "w", encoding="utf-8") as file:
        file.write(output_str)

    copy_file(image_path, target_image_path)
    # Output image may not exist if detection failed
    if os.path.exists(output_image_path):
        copy_file(output_image_path, target_output_image_path)
    copy_file(config_path, target_config_path)
    if reference_image_path and target_reference_image_path:
        copy_file(reference_image_path, target_reference_image_path)


def collect_decoder_data(image_path: str, config_path: str, output_str: str) -> None:
    """
    Collect input and output data for decoder

    Args:
        image_path: Path to the input image
        config_path: Path to the config file
        output_str: Output string from decoder

    Returns:
        None
    """
    # Skip if output_str is None (decode failed)
    if output_str is None:
        return

    stub_name = os.path.basename(image_path).split(".")[0]
    image_name = os.path.basename(image_path)
    config_name = os.path.basename(config_path)

    target_dir = config.paths.processed_images_path / stub_name
    if not target_dir.exists():
        target_dir.mkdir(parents=True)

    target_image_path = target_dir / image_name
    target_config_path = target_dir / config_name
    target_output_path = target_dir / f"{stub_name}_decoder_output.txt"
    with open(target_output_path, "w", encoding="utf-8") as file:
        file.write(output_str)

    copy_file(image_path, target_image_path)
    copy_file(config_path, target_config_path)


def copy_file(source_path: str | Path, target_path: Path):
    """
    Copy a file from the source path to the target path

    Args:
        source_path: Path to the source file
        target_path: Path to the target file

    Returns:
        None
    """
    if not target_path.exists():
        shutil.copy(source_path, target_path)


def use_thread(func: Callable, *args, **kwargs) -> None:
    """
    Run a function in a separate thread

    Args:
        func: Function to run
        args: Arguments to pass to the function
        kwargs: Keyword arguments to pass to the function

    Returns:
        Thread object
    """
    thread = threading.Thread(target=func, args=args, kwargs=kwargs, daemon=True)
    thread.start()
    return thread


class _ScientificFloatEncoder(json.JSONEncoder):
    """JSON encoder that writes floats as:
    - whole numbers with one decimal place (e.g. 1.0, 0.0, 2.0)
    - scientific notation for all other floats.
    """

    def iterencode(self, obj, _one_shot=False):
        yield from self._encode(obj, level=0)

    def _encode(self, obj, level=0):
        indent = self.indent

        if isinstance(obj, float):
            # Whole-number floats -> fixed one decimal place (two significant digits like 1.0)
            if obj.is_integer():
                yield f"{obj:.1f}"
            else:
                # Non-integer floats -> scientific notation
                yield f"{obj:.16e}"

        elif isinstance(obj, dict):
            if not obj:
                yield "{}"
                return
            yield "{"
            items = list(obj.items())
            for i, (k, v) in enumerate(items):
                if indent is not None:
                    yield "\n" + " " * (indent * (level + 1))
                yield from self._encode(k, level + 1)
                yield ": "
                yield from self._encode(v, level + 1)
                if i < len(items) - 1:
                    yield "," if indent is not None else ", "
            if indent is not None:
                yield "\n" + " " * (indent * level)
            yield "}"

        elif isinstance(obj, (list, tuple)):
            if not obj:
                yield "[]"
                return
            yield "["
            for i, v in enumerate(obj):
                if indent is not None:
                    yield "\n" + " " * (indent * (level + 1))
                yield from self._encode(v, level + 1)
                if i < len(obj) - 1:
                    yield "," if indent is not None else ", "
            if indent is not None:
                yield "\n" + " " * (indent * level)
            yield "]"

        else:
            # Delegate to standard json for strings, ints, bools, None, etc.
            yield json.dumps(obj)
