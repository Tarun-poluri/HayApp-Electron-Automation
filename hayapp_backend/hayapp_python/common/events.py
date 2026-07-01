import json
from datetime import datetime
from enum import StrEnum
from typing import Any, Optional


class DateTimeEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, datetime):
            return o.isoformat()

        return json.JSONEncoder.default(self, o)


class Event:

    def __init__(self, event: str, description: str, info: dict[str, dict[str, Any]] = None):
        self.event: str = event
        self.description: str = description
        self.info: dict[str, dict[str, Any]] = info if info is not None else {}

    @classmethod
    def from_event(cls, event: dict[str, dict[str, Any]]) -> Optional["Event"]:
        if event.get("EVENT") != cls.event:
            return None
        return Event(
            event=event.get("EVENT"),
            info=json.loads(event.get("INFO", "{}")),
            description=event.get("DESCRIPTION"),
        )

    def to_event(self) -> dict[str, dict[str, Any]]:
        self.info = json.dumps(self.info, cls=DateTimeEncoder)
        return {"info": self.info, "event": self.event, "description": self.description}


# region Image Events


class ImageEventType(StrEnum):
    IMAGE_DECODED = "image_decoded"
    IMAGE_ANALYZED = "image_analyzed"


class ImageEvent(Event):
    event = "IMAGE_EVENT"

    def __init__(self, event: str, description: str, info: dict[str, dict[str, Any]] = None):
        super().__init__(event=event, description=description, info=info)


class ImageDecodedEvent(ImageEvent):
    description = ImageEventType.IMAGE_DECODED.value
    info_image_key = "image"
    info_pix_per_mm_key = "pix_per_mm"
    info_check_empty_key = "check_empty"

    def __init__(self, image: str, pix_per_mm: float, check_empty: bool = False):
        self.image = image
        self.pix_per_mm = pix_per_mm
        self.check_empty = check_empty
        super().__init__(
            event=self.event,
            description=self.description,
            info={
                self.info_image_key: image,
                self.info_pix_per_mm_key: pix_per_mm,
                self.info_check_empty_key: check_empty,
            },
        )

    @classmethod
    def from_event(cls, event: dict[str, dict[str, Any]]) -> Optional["ImageDecodedEvent"]:
        if not (base_event := super().from_event(event)):
            return None
        return ImageDecodedEvent(
            image=base_event.info.get(cls.info_image_key),
            pix_per_mm=base_event.info.get(cls.info_pix_per_mm_key),
            check_empty=base_event.info.get(cls.info_check_empty_key),
        )


class ImageAnalyzedEvent(ImageEvent):
    description = ImageEventType.IMAGE_ANALYZED.value

    def __init__(self, result: dict[str, Any]):
        self.result = result
        super().__init__(event=self.event, description=self.description, info=result)

    @classmethod
    def from_event(cls, event: dict[str, dict[str, Any]]) -> Optional["ImageAnalyzedEvent"]:
        if not (base_event := super().from_event(event)):
            return None
        return ImageAnalyzedEvent(result=base_event.info)


# region Timer Events


class TimerEventType(StrEnum):
    NEEDLE_DEPOSITED = "needle_deposited"
    NEEDLE_MOVED_TO_IMAGING = "needle_moved_to_imaging"
    IMAGE_CAPTURED = "image_captured"  # same event for needle and reference
    IMAGE_DECODED = "image_decoded"  # same event for needle and reference
    IMAGE_ANALYZED = "image_analyzed"  # same event for needle and reference
    NEEDLE_MOVED_TO_SHARPS = "needle_moved_to_sharps"
    DEPOSIT_READY = "deposit_ready"


class TimerEvent(Event):
    event = "TIMER_EVENT"
    info_timestamp_key = "timestamp"
    info_execution_duration_ms_key = "execution_duration_ms"
    timestamp: datetime

    def __init__(
        self,
        timestamp: Optional[datetime] = None,
        execution_duration_ms: Optional[float] = None,
    ):
        # Use current time if no timestamp provided (evaluated at call time, not definition time)
        self.timestamp = timestamp if timestamp is not None else datetime.now()
        self.execution_duration_ms = execution_duration_ms
        super().__init__(
            event=self.__class__.event,
            description=self.__class__.description,
            info={
                self.info_timestamp_key: self.timestamp,
                self.info_execution_duration_ms_key: execution_duration_ms,
            },
        )

    @classmethod
    def from_event(cls, event: dict[str, dict[str, Any]]) -> Optional["TimerEvent"]:
        # if not (base_event := super().from_event(event)) or base_event.event != cls.event:
        if not (base_event := super().from_event(event)):
            return None
        timestamp = base_event.info.get(cls.info_timestamp_key)
        execution_duration_ms = base_event.info.get(cls.info_execution_duration_ms_key)
        event_type = TimerEventType(base_event.description)
        if event_type == TimerEventType.NEEDLE_DEPOSITED:
            return TimerNeedleDepositedEvent(timestamp, execution_duration_ms)
        elif event_type == TimerEventType.NEEDLE_MOVED_TO_IMAGING:
            return TimerNeedleMovedToImagingEvent(timestamp, execution_duration_ms)
        elif event_type == TimerEventType.IMAGE_CAPTURED:
            return TimerImageCapturedEvent(timestamp, execution_duration_ms)
        elif event_type == TimerEventType.IMAGE_DECODED:
            return TimerImageDecodedEvent(timestamp, execution_duration_ms)
        elif event_type == TimerEventType.IMAGE_ANALYZED:
            return TimerImageAnalyzedEvent(timestamp, execution_duration_ms)
        elif event_type == TimerEventType.NEEDLE_MOVED_TO_SHARPS:
            return TimerNeedleMovedToSharpsEvent(timestamp, execution_duration_ms)
        elif event_type == TimerEventType.DEPOSIT_READY:
            return TimerDepositReadyEvent(timestamp, execution_duration_ms)
        else:
            raise ValueError(f"Unknown timer event: {event_type.value}")


class TimerNeedleDepositedEvent(TimerEvent):
    description = TimerEventType.NEEDLE_DEPOSITED.value


class TimerNeedleMovedToImagingEvent(TimerEvent):
    description = TimerEventType.NEEDLE_MOVED_TO_IMAGING.value


class TimerImageCapturedEvent(TimerEvent):
    description = TimerEventType.IMAGE_CAPTURED.value


class TimerImageDecodedEvent(TimerEvent):
    description = TimerEventType.IMAGE_DECODED.value


class TimerImageAnalyzedEvent(TimerEvent):
    description = TimerEventType.IMAGE_ANALYZED.value


class TimerNeedleMovedToSharpsEvent(TimerEvent):
    description = TimerEventType.NEEDLE_MOVED_TO_SHARPS.value


class TimerDepositReadyEvent(TimerEvent):
    description = TimerEventType.DEPOSIT_READY.value


# endregion Timer Events


class HaystackEventType(StrEnum):
    HAYSTACK_CONNECTION = "haystack_connection"
    HAYSTACK_POST_STATUS = "haystack_post_status"


class HaystackConnectionEvent(Event):
    event = HaystackEventType.HAYSTACK_CONNECTION.value
    description = HaystackEventType.HAYSTACK_CONNECTION.value
    info_connected_key = "connected"
    info_new_haystack_key = "new_haystack"
    connected: bool
    new_haystack: bool

    def __init__(self, connected: bool, new_haystack: bool = False):
        self.connected = connected
        self.new_haystack = new_haystack
        super().__init__(
            event=self.event,
            description=self.description,
            info={self.info_connected_key: connected, self.info_new_haystack_key: new_haystack},
        )

    @classmethod
    def from_event(cls, event: dict[str, dict[str, Any]]) -> Optional["HaystackConnectionEvent"]:
        if not (base_event := super().from_event(event)):
            return None
        return HaystackConnectionEvent(
            connected=base_event.info.get(cls.info_connected_key),
            new_haystack=base_event.info.get(cls.info_new_haystack_key),
        )


class HaystackPostStatusEvent(Event):
    event = HaystackEventType.HAYSTACK_POST_STATUS.value
    description = HaystackEventType.HAYSTACK_POST_STATUS.value
    info_status_byte_key = "status_byte"
    info_vin_pass_key = "vin_pass"  # nosec B105
    info_motor_pass_key = "motor_pass"  # nosec B105
    info_tower_cap_pass_key = "tower_cap_pass"  # nosec B105
    info_rotation_pass_key = "rotation_pass"  # nosec B105

    POST_BIT_VIN = 0x1
    POST_BIT_MOTOR = 0x2
    POST_BIT_TOWER_CAP = 0x4
    POST_BIT_ROTATION = 0x8

    def __init__(self, status_byte: int):
        self.status_byte = status_byte
        self.vin_pass = bool(status_byte & self.POST_BIT_VIN)
        self.motor_pass = bool(status_byte & self.POST_BIT_MOTOR)
        self.tower_cap_pass = bool(status_byte & self.POST_BIT_TOWER_CAP)
        self.rotation_pass = bool(status_byte & self.POST_BIT_ROTATION)
        super().__init__(
            event=self.event,
            description=self.description,
            info={
                self.info_status_byte_key: status_byte,
                self.info_vin_pass_key: self.vin_pass,
                self.info_motor_pass_key: self.motor_pass,
                self.info_tower_cap_pass_key: self.tower_cap_pass,
                self.info_rotation_pass_key: self.rotation_pass,
            },
        )

    @classmethod
    def from_event(cls, event: dict[str, dict[str, Any]]) -> Optional["HaystackPostStatusEvent"]:
        if not (base_event := super().from_event(event)):
            return None
        return HaystackPostStatusEvent(
            status_byte=base_event.info.get(cls.info_status_byte_key, 0),
        )

    @property
    def all_passed(self) -> bool:
        return self.status_byte == 0x0F


class ErrorEvent(Event):
    event = "ERROR_EVENT"
    description = "Error Event"
    info_title_key = "title"
    info_msg_key = "msg"
    info_is_fatal_key = "is_fatal"

    def __init__(self, title: str, msg: str, is_fatal: bool = False):
        self.title = title
        self.msg = msg
        self.is_fatal = is_fatal
        super().__init__(
            event=self.event,
            description=self.description,
            info={
                self.info_title_key: self.title,
                self.info_msg_key: self.msg,
                self.info_is_fatal_key: self.is_fatal,
            },
        )

    @classmethod
    def from_event(cls, event: dict[str, dict[str, Any]]) -> Optional["ErrorEvent"]:
        if not (base_event := super().from_event(event)):
            return None
        return ErrorEvent(
            title=base_event.info.get(cls.info_title_key),
            msg=base_event.info.get(cls.info_msg_key),
            is_fatal=base_event.info.get(cls.info_is_fatal_key, False),
        )


class ScrConfirmedFieldCountEvent(Event):
    event = "SCR_CONFIRMED_FIELD_COUNT"
    description = "SCR confirmed field count"
    info_action_key = "action"

    def __init__(self, action: str):
        """
        Event for SCR field count confirmation.
        Args:
            action: One of 'next', 'complete', or 'retry'
        """
        self.action = action
        super().__init__(
            event=self.event,
            description=f"SCR confirmed - {action}",
            info={self.info_action_key: self.action},
        )

    @classmethod
    def from_event(
        cls, event: dict[str, dict[str, Any]]
    ) -> Optional["ScrConfirmedFieldCountEvent"]:
        if not (base_event := super().from_event(event)):
            return None
        return ScrConfirmedFieldCountEvent(
            action=base_event.info.get(cls.info_action_key),
        )


class TotalValidationStatus(StrEnum):
    """Status of total count validation."""

    CORRECT = "correct"
    TOO_LOW = "too_low"
    TOO_HIGH = "too_high"
    INCORRECT = "incorrect"


class ScrTotalConfirmationEvent(Event):
    event = "SCR_TOTAL_CONFIRMATION"
    description = "SCR total confirmation"
    info_confirmed_key = "confirmed"
    info_validation_status_key = "validation_status"

    def __init__(
        self,
        confirmed: bool,
        validation_status: TotalValidationStatus = TotalValidationStatus.INCORRECT,
    ):
        """
        Event for SCR total count confirmation.
        Args:
            confirmed: Whether SCR confirmed the total
            validation_status: Status of the count validation
                (correct, too_low, too_high, or incorrect)
        """
        self.confirmed = confirmed
        self.validation_status = validation_status
        super().__init__(
            event=self.event,
            description=self._get_description(),
            info={
                self.info_confirmed_key: self.confirmed,
                self.info_validation_status_key: self.validation_status.value,
            },
        )

    def _get_description(self) -> str:
        if not self.confirmed:
            return "SCR rejected total count"
        elif self.validation_status == TotalValidationStatus.TOO_LOW:
            return "Total too low"
        elif self.validation_status == TotalValidationStatus.TOO_HIGH:
            return "Total too high"
        else:
            return "Total matches scanned needles"

    @classmethod
    def from_event(cls, event: dict[str, dict[str, Any]]) -> Optional["ScrTotalConfirmationEvent"]:
        if not (base_event := super().from_event(event)):
            return None

        # Parse validation_status from string to enum
        validation_status_str = base_event.info.get(
            cls.info_validation_status_key, TotalValidationStatus.INCORRECT.value
        )
        try:
            validation_status = TotalValidationStatus(validation_status_str)
        except ValueError:
            validation_status = TotalValidationStatus.INCORRECT

        return ScrTotalConfirmationEvent(
            confirmed=base_event.info.get(cls.info_confirmed_key),
            validation_status=validation_status,
        )


class NeedleImageCapturedEvent(Event):
    """
    Fired after HayStack imaging completes (camera capture + imaging_complete).
    Does not drive CIR verification; used for UI/audit while deposit confirmation is pending.
    """

    event = "NEEDLE_IMAGE_CAPTURED"
    description = "Needle image captured"
    info_image_number_key = "image_number"
    info_received_time_key = "received_time"
    info_image_filename_used_key = "image_filename_used"

    def __init__(
        self,
        image_number: Optional[int],
        received_time: str,
        image_filename_used: str,
    ):
        self.image_number = image_number
        self.received_time = received_time
        self.image_filename_used = image_filename_used
        super().__init__(
            event=self.event,
            description=self.description,
            info={
                self.info_image_number_key: image_number,
                self.info_received_time_key: received_time,
                self.info_image_filename_used_key: image_filename_used,
            },
        )
