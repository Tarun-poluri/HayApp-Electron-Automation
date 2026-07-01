class ITraceError(Exception):
    """Base exception for iTrace-related errors."""

    pass


class ITraceConfigError(ITraceError):
    """Raised when there's a configuration error."""

    pass


class ITraceDecodeError(ITraceError):
    """Raised when decoding fails."""

    pass


class ITraceDetectError(ITraceError):
    """Raised when detecting fails."""

    pass


class ITraceNotEnabledError(ITraceError):
    """Raised when iTrace functionality is not enabled."""

    pass


class ITraceCrashError(ITraceError):
    """Raised when the C++ library crashes (e.g., segfault).

    This exception indicates that the C++ library crashed in a subprocess,
    protecting the main Python process from termination.
    """

    pass


class ITraceTimeoutError(ITraceError):
    """Raised when a C++ library call times out."""

    pass
