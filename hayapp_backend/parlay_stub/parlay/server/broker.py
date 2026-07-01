def run_in_thread(*args, **kwargs):
    """Decorator — runs a function in a background thread."""
    def decorator(func):
        return func
    if args and callable(args[0]):
        return args[0]
    return decorator
