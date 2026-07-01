# Minimal parlay stub for CI builds.
# Provides all symbols imported by the backend so PyInstaller can compile.
# Real hardware communication requires the actual parlay package.

import threading


class Broker:
    def __init__(self, *args, **kwargs):
        pass

    def start(self, *args, **kwargs):
        pass

    def stop(self, *args, **kwargs):
        pass


def start(*args, **kwargs):
    pass


def start_for_test(*args, **kwargs):
    pass


class ParlayCommandItem:
    def __init__(self, *args, **kwargs):
        pass


class ParlayProperty:
    def __init__(self, *args, **kwargs):
        pass


def local_item(*args, **kwargs):
    """Decorator — registers a class as a parlay item."""
    def decorator(cls):
        return cls
    if args and isinstance(args[0], type):
        return args[0]
    return decorator


def parlay_command(*args, **kwargs):
    """Decorator — marks a method as a parlay command handler."""
    def decorator(func):
        return func
    if args and callable(args[0]):
        return args[0]
    return decorator
