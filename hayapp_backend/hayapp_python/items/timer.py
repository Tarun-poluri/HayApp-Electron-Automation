import csv
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from parlay import ParlayCommandItem, local_item, parlay_command

from hayapp_python.common.defs import Timer_item as item
from hayapp_python.common.events import TimerEvent, TimerEventType
from hayapp_python.common.pretty_dataclass import PrettyMixin


@dataclass
class TimerEventData(PrettyMixin):
    """
    Timer event data class
    """

    needle_deposited: Optional[datetime] = None
    needle_moved_to_imaging: Optional[datetime] = None
    needle_imaged: Optional[datetime] = None
    needle_decoded: Optional[datetime] = None
    needle_analyzed: Optional[datetime] = None
    needle_moved_to_sharps: Optional[datetime] = None
    reference_imaged: Optional[datetime] = None
    reference_analyzed: Optional[datetime] = None
    deposit_ready: Optional[datetime] = None
    needle_moved_to_imaging_exec_ms: Optional[float] = None
    needle_imaged_exec_ms: Optional[float] = None
    needle_decoded_exec_ms: Optional[float] = None
    needle_analyzed_exec_ms: Optional[float] = None
    needle_moved_to_sharps_exec_ms: Optional[float] = None
    reference_imaged_exec_ms: Optional[float] = None
    reference_analyzed_exec_ms: Optional[float] = None
    deposit_ready_exec_ms: Optional[float] = None

    @property
    def is_complete(self) -> bool:
        """
        Return True if the timer event is complete.
        """
        to_check = [self.needle_deposited, self.deposit_ready]
        if self.reference_imaged:
            to_check.append(self.reference_analyzed)
        return all(attr is not None for attr in to_check)


@dataclass
class TimerCompletedEvent(TimerEventData):
    needle_moved_to_imaging_duration: Optional[timedelta] = None
    needle_imaged_duration: Optional[timedelta] = None
    needle_decoded_duration: Optional[timedelta] = None
    needle_analyzed_duration: Optional[timedelta] = None
    needle_moved_to_sharps_duration: Optional[timedelta] = None
    reference_imaged_duration: Optional[timedelta] = None
    reference_analyzed_duration: Optional[timedelta] = None
    haystack_home_duration: Optional[timedelta] = None
    total_duration: Optional[timedelta] = None

    def __post_init__(self):
        self.needle_moved_to_imaging_duration = self.needle_moved_to_imaging - self.needle_deposited
        self.needle_imaged_duration = self.needle_imaged - self.needle_moved_to_imaging
        self.needle_decoded_duration = self.needle_decoded - self.needle_imaged
        self.needle_analyzed_duration = self.needle_analyzed - self.needle_decoded
        self.needle_moved_to_sharps_duration = self.needle_moved_to_sharps - self.needle_decoded
        self.haystack_home_duration = self.deposit_ready - self.needle_moved_to_sharps

        last_event_time = self.deposit_ready

        if self.reference_imaged:
            self.reference_imaged_duration = self.reference_imaged - self.needle_moved_to_sharps
            self.reference_analyzed_duration = self.reference_analyzed - self.reference_imaged

            last_event_time = max(self.deposit_ready, self.reference_analyzed)

        self.total_duration = last_event_time - self.needle_deposited


@local_item()
class Timer(ParlayCommandItem):
    """
    Timer Parlay adapter for timing events
    """

    def __init__(self, item_id=item.id, name=item.name):
        ParlayCommandItem.__init__(self, item_id=item.id, name=item.name)
        self.current_timer_event = TimerEventData()
        self.last_timer_event: Optional[TimerCompletedEvent] = None
        self.completed_timer_events: list[TimerCompletedEvent] = []
        self.subscribe(self._on_timer_event, MSG_TYPE="EVENT")

    def _on_timer_event(self, event: dict[str, dict[str, Any]]):
        """
        Handle a timer event and add the value to the current timer event.
        """
        if timer_event := TimerEvent.from_event(event.get("CONTENTS", {})):
            self._add_timer_value(
                timer_event.description, timer_event.timestamp, timer_event.execution_duration_ms
            )

    def _add_timer_value(
        self, event_name: str, time: str, execution_duration_ms: Optional[float] = None
    ):
        """
        Add a timer value to the current timer event.
        """
        if event_name is TimerEventType.NEEDLE_DEPOSITED.value:
            self.current_timer_event = TimerEventData()

        print(f"Adding timer value: {event_name} - {time}")
        # Add the timer value to the current timer event
        time = datetime.fromisoformat(time)

        if event_name in (
            TimerEventType.IMAGE_CAPTURED.value,
            TimerEventType.IMAGE_DECODED.value,
            TimerEventType.IMAGE_ANALYZED.value,
        ):
            self._handle_duplicate_event(event_name, time, execution_duration_ms)
        else:
            self.current_timer_event.__setattr__(event_name, time)
            if execution_duration_ms is not None:
                self.current_timer_event.__setattr__(f"{event_name}_exec_ms", execution_duration_ms)

        # Complete the timer event all fields are set
        if self.current_timer_event.is_complete:
            self._complete_timer_event()

    def _handle_duplicate_event(
        self, event_name: str, time: datetime, execution_duration_ms: Optional[float] = None
    ):
        """
        Handle a duplicate event and add the value to the current timer event.
        """
        if event_name == TimerEventType.IMAGE_CAPTURED.value:
            if not self.current_timer_event.needle_imaged:  # needle should come first
                self.current_timer_event.needle_imaged = time
                self.current_timer_event.needle_imaged_exec_ms = execution_duration_ms
            elif not self.current_timer_event.reference_imaged:  # reference should come second
                self.current_timer_event.reference_imaged = time
                self.current_timer_event.reference_imaged_exec_ms = execution_duration_ms
        elif event_name == TimerEventType.IMAGE_DECODED.value:
            if not self.current_timer_event.needle_decoded:
                self.current_timer_event.needle_decoded = time
                self.current_timer_event.needle_decoded_exec_ms = execution_duration_ms
        elif event_name == TimerEventType.IMAGE_ANALYZED.value:
            if not self.current_timer_event.needle_analyzed:  # needle should come first
                self.current_timer_event.needle_analyzed = time
                self.current_timer_event.needle_analyzed_exec_ms = execution_duration_ms
            elif not self.current_timer_event.reference_analyzed:  # reference should come second
                self.current_timer_event.reference_analyzed = time
                self.current_timer_event.reference_analyzed_exec_ms = execution_duration_ms

    def _complete_timer_event(self):
        """
        Complete the current timer event and add it to the completed timer events list.
        """
        completed_event = TimerCompletedEvent(**asdict(self.current_timer_event))
        self.current_timer_event = TimerEventData()
        self.completed_timer_events.append(completed_event)
        self.last_timer_event = completed_event

    @parlay_command()
    def get_last_event(self) -> Optional[str]:
        """
        Return the pretty string of the last timer event.
        """
        return self.completed_timer_events[-1].pretty() if self.completed_timer_events else None

    @parlay_command()
    def get_completed_averages(self) -> timedelta:
        """
        Calculate and return the average time deltas for deltas on completed timer events.
        """
        return sum(event.total_duration for event in self.completed_timer_events) / len(
            self.completed_timer_events
        )

    @parlay_command()
    def get_completed_timer_events(self) -> list[str]:
        """
        Return the completed timer events.
        """
        events = [event.pretty() for event in self.completed_timer_events]
        print(f"Completed timer events: {''.join(events)}")
        return events

    @parlay_command()
    def dump_completed_events_csv(self, filename: str = "completed_timer_events.csv") -> str:
        """
        Dump all completed timer events to a CSV file.
        Use [h]:mm:ss.000 format for time deltas in Google Sheets.
        Returns the path to the written CSV.
        """
        if not self.completed_timer_events:
            return "No completed timer events to dump."

        path = Path(filename).expanduser().resolve()

        rows = [asdict(e) for e in self.completed_timer_events]
        for row in rows:
            for key, val in row.items():
                if isinstance(val, timedelta):
                    row[key] = val.total_seconds() * 1000.0

        with path.open("w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

        return f"Wrote {len(rows)} completed timer events to {path}"
