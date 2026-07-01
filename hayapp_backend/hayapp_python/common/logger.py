import asyncio
import json
import logging
import sys
import threading
import time

from hayapp_python.items.models import Case


def init_logger(log_file):
    """
    Configure a dedicated 'hayapp' logger to log both to console and to the specified file.
    """
    format_str = (
        "%(asctime)s %(filename)+25s:%(lineno)-5d %(name)-25s [%(levelname)+s]   %(message)-s"
    )
    logger = logging.getLogger("hayapp")
    logger.setLevel(logging.DEBUG)

    logger.handlers.clear()

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setLevel(logging.INFO)
    stream_handler.setFormatter(logging.Formatter(format_str))

    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.INFO)
    file_formatter = logging.Formatter("%(asctime)sZ | %(message)s", "%Y-%m-%dT%H:%M:%S")
    file_formatter.converter = time.gmtime
    file_handler.setFormatter(file_formatter)

    logger.addHandler(stream_handler)
    logger.addHandler(file_handler)

    logger.propagate = False
    return logger


def get_latest_staff(case: Case):
    def latest_worker(staff_list):
        if not staff_list:
            return None
        staff_with_signin = [s for s in staff_list if hasattr(s, "signin") and s.signin]
        if not staff_with_signin:
            return None
        latest_staff = max(staff_with_signin, key=lambda s: s.signin)
        # Just return user_id, since we don't want to access reference_data.json
        return f"user_id: {getattr(latest_staff, 'user_id', 'unknown')}"

    def latest_surgeon(surgeon_list):
        if not surgeon_list:
            return None
        latest_surgeon = surgeon_list[-1]
        # Just return surgeon_id
        return f"surgeon_id: {getattr(latest_surgeon, 'surgeon_id', 'unknown')}"

    if not case or not hasattr(case, "staff"):
        return "anonymous"
    cir = latest_worker(getattr(case.staff, "cir", []))
    scr = latest_worker(getattr(case.staff, "scr", []))
    surgeon = latest_surgeon(getattr(case.staff, "surgeon", []))
    return f"cir: {cir or 'none'}, scr: {scr or 'none'}, surgeon: {surgeon or 'none'}"


def log_command(command_name, case=None, result=None):
    logger = logging.getLogger("hayapp")
    user_str = get_latest_staff(case) if case else "anonymous"
    if result is not None:
        try:
            result_str = json.dumps(result, default=str)[:500]
        except Exception:
            result_str = str(result)[:500]
        logger.info(f"COMMAND/EVENT: {command_name} | STAFF: {user_str} | RETURN: {result_str}")
    else:
        logger.info(f"COMMAND/EVENT: {command_name} | STAFF: {user_str}")


def install_global_exception_logging(logger):

    # Unwrap ExceptionGroup and log only the first leaf exception traceback
    # This prevenst long traceback in the log files
    def _leaf_exception(exc_value: BaseException):
        current = exc_value
        while isinstance(current, BaseExceptionGroup) and current.exceptions:
            current = current.exceptions[0]
        return current

    def _normalize_exception(exc_type, exc_value, exc_traceback):
        if exc_value is None:
            return exc_type, exc_value, exc_traceback
        leaf = _leaf_exception(exc_value)
        return type(leaf), leaf, leaf.__traceback__ or exc_traceback

    def _handle_uncaught_exception(exc_type, exc_value, exc_traceback):
        if issubclass(exc_type, KeyboardInterrupt):
            return sys.__excepthook__(exc_type, exc_value, exc_traceback)
        log_exc_type, log_exc_value, log_exc_traceback = _normalize_exception(
            exc_type, exc_value, exc_traceback
        )
        logger.error(
            "Uncaught exception",
            exc_info=(log_exc_type, log_exc_value, log_exc_traceback),
        )

    def _handle_thread_exception(args: threading.ExceptHookArgs):
        if args.exc_type is KeyboardInterrupt:
            return
        log_exc_type, log_exc_value, log_exc_traceback = _normalize_exception(
            args.exc_type, args.exc_value, args.exc_traceback
        )
        logger.error(
            f"Uncaught exception in thread '{args.thread.name}'",
            exc_info=(log_exc_type, log_exc_value, log_exc_traceback),
        )

    def _handle_asyncio_exception(loop, context):
        exception = context.get("exception")
        if exception is not None:
            leaf = _leaf_exception(exception)
            logger.error("Unhandled asyncio exception", exc_info=leaf)
        else:
            logger.error(
                f"Unhandled asyncio error: {context.get('message', 'Unknown asyncio error')}"
            )

    sys.excepthook = _handle_uncaught_exception
    threading.excepthook = _handle_thread_exception
    asyncio.get_event_loop_policy().get_event_loop().set_exception_handler(
        _handle_asyncio_exception
    )
