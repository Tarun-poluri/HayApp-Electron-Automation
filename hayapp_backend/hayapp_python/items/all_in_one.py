import logging
import shutil
import threading
import time
from dataclasses import asdict, dataclass, field
from typing import Optional

import pythoncom
import wmi
from parlay import ParlayCommandItem, ParlayProperty, local_item, parlay_command

from hayapp_python.common.config_manager import config
from hayapp_python.common.defs import AllInOne_item as item
from hayapp_python.common.events import ErrorEvent
from hayapp_python.common.parlay_mixin import ThreadSafePublishMixin

logger = logging.getLogger("hayapp")

# WMI BatteryStatus value indicating the system is connected to AC power
_BATTERY_STATUS_ON_AC = 2

# Factor to convert bytes to gigabytes
_GB_FACTOR = 1024**3


@dataclass
class StorageInfo:
    available_gb: float
    total_gb: float
    used_gb: float
    available_percent: float


@dataclass
class PowerInfo:
    power_source: str = field(default="unknown")
    battery_level: int = field(default=-1)


@local_item()
class AllInOneAdapter(ThreadSafePublishMixin, ParlayCommandItem):
    """
    Adapter for monitoring All-In-One PC system resources: power source
    (wall vs. battery) and storage space. Publishes error events when
    battery level or available storage drops below configurable thresholds,
    and fires an event whenever the device switches from wall to battery power.
    """

    power_source = ParlayProperty(default="unknown", val_type=str, read_only=True)
    battery_level = ParlayProperty(default=-1, val_type=int, read_only=True)
    storage_available_gb = ParlayProperty(default=-1.0, val_type=float, read_only=True)
    serial_number = ParlayProperty(default="", val_type=str, read_only=True)

    def __init__(self, item_id=item.id, name=item.name):
        ParlayCommandItem.__init__(self, item_id=item_id, name=name)

        self.serial_number = AllInOneAdapter._fetch_bios_serial()

        self._battery_low_threshold = config.all_in_one.battery_low_threshold
        self._storage_low_threshold_gb = config.all_in_one.storage_low_threshold_gb
        self._power_monitor_interval = config.all_in_one.power_monitor_interval

        self._previous_power_info: Optional[PowerInfo] = None
        self._power_monitor_thread: Optional[threading.Thread] = None
        self._start_power_monitor()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _start_power_monitor(self):
        self._should_monitor_power = True
        self._power_monitor_thread = threading.Thread(
            target=self._power_monitor_loop,
            daemon=True,
        )
        self._power_monitor_thread.start()

    def _stop_power_monitor(self):
        self._should_monitor_power = False
        if self._power_monitor_thread:
            self._power_monitor_thread.join(timeout=1.0)
            self._power_monitor_thread = None

    @staticmethod
    def _fetch_bios_serial() -> str:
        try:
            c = wmi.WMI()
            # Win32_BIOS returns a list of BIOS objects; we take the first
            for bios in c.Win32_BIOS():
                return bios.SerialNumber.strip()
        except Exception as e:
            return f"Error retrieving serial: {e}"
        return "Unknown"

    @staticmethod
    def _query_power_with_conn(c: wmi.WMI) -> PowerInfo:
        """
        Query WMI for the current power source and battery charge level using
        an existing, caller-managed WMI connection.

        Handles any number of batteries (e.g. 1 in development, 3 on the
        deployment device):
          - power_source is "wall" only when every battery reports AC;
            "battery" if any unit is discharging.
          - battery_level is the minimum across all batteries so that low-
            battery alerts fire on the weakest unit.

        :param c: An already-initialised ``wmi.WMI()`` connection.
        :return: PowerInfo with power_source ("wall"/"battery"/"unknown") and
                 battery_level (0-100, or -1 when unavailable).
        """
        batteries = list(c.Win32_Battery())
        if not batteries:
            return PowerInfo(power_source="wall")

        logger.debug(
            "AllInOne: %d battery unit(s) found: %s",
            len(batteries),
            [(b.Name, b.BatteryStatus, b.EstimatedChargeRemaining) for b in batteries],
        )

        # "wall" only when every unit is on AC; any discharging unit → "battery"
        on_ac = all(b.BatteryStatus == _BATTERY_STATUS_ON_AC for b in batteries)
        source = "wall" if on_ac else "battery"

        # Report the minimum charge so alerts are triggered by the weakest unit
        levels = [
            b.EstimatedChargeRemaining for b in batteries if b.EstimatedChargeRemaining is not None
        ]
        level = min(levels) if levels else -1

        return PowerInfo(power_source=source, battery_level=level)

    @staticmethod
    def _query_power() -> PowerInfo:
        """
        Query WMI for the current power source and battery charge level.

        Handles COM initialisation internally so it is safe to call from any
        thread (including the Parlay command thread).

        :return: PowerInfo with power_source ("wall"/"battery"/"unknown") and
                 battery_level (0-100, or -1 when unavailable).
        """
        pythoncom.CoInitialize()
        try:
            c = wmi.WMI()
            return AllInOneAdapter._query_power_with_conn(c)
        except Exception as e:
            logger.error(f"AllInOne: WMI power query failed: {e}")
            return PowerInfo()
        finally:
            pythoncom.CoUninitialize()

    @staticmethod
    def _query_storage() -> StorageInfo:
        """
        Return disk usage for the drive that holds application image data.

        :return: dict with available_gb, total_gb, used_gb, available_percent
        """
        try:
            usage = shutil.disk_usage(str(config.paths.image_path))
            available_gb = usage.free / _GB_FACTOR
            total_gb = usage.total / _GB_FACTOR
            used_gb = usage.used / _GB_FACTOR
            available_percent = (usage.free / usage.total) * 100
            return StorageInfo(
                available_gb=round(available_gb, 2),
                total_gb=round(total_gb, 2),
                used_gb=round(used_gb, 2),
                available_percent=round(available_percent, 1),
            )
        except Exception as e:
            logger.error(f"AllInOne: Storage query failed: {e}")
            return StorageInfo(error=str(e))

    def _publish_error(self, title: str, msg: str, is_fatal: bool = False):
        try:
            self.send_event(**ErrorEvent(title=title, msg=msg, is_fatal=is_fatal).to_event())
        except Exception as e:
            logger.warning(f"AllInOne: Could not publish error event '{title}': {e}")

    # ------------------------------------------------------------------
    # Parlay commands
    # ------------------------------------------------------------------

    @parlay_command()
    def get_power_source(self) -> dict:
        """
        Return the current power source.

        :return: dict with power_source and battery_level
        """
        return asdict(self._query_power())

    @parlay_command()
    def check_battery_low(self) -> bool:
        """
        Check if the battery level is below the configured threshold.

        :return: True if the battery level is below the configured threshold, False otherwise
        """
        low = False
        battery_level = self._query_power().battery_level
        if battery_level < self._battery_low_threshold:
            low = True
            logger.warning(
                f"Battery level {battery_level} is below the configured"
                f" threshold {self._battery_low_threshold}"
            )
            self._publish_error(
                title="Battery Low",
                msg=(
                    f"Battery level {battery_level} is below the configured"
                    f" threshold {self._battery_low_threshold}"
                ),
            )
        else:
            logger.info(
                f"Battery level {battery_level} is above the configured"
                f" threshold {self._battery_low_threshold}"
            )
        return low

    @parlay_command()
    def get_storage_space(self) -> dict:
        """
        Return storage space info for the application data drive.

        Publishes an error event if available space is below the configured
        threshold.

        :return: dict with available_gb, total_gb, used_gb, available_percent
        """
        info = self._query_storage()
        if isinstance(info.available_gb, float):
            self.storage_available_gb = info.available_gb
            if info.available_gb < self._storage_low_threshold_gb:
                logger.warning(
                    f"AllInOne: Storage {info.available_gb:.2f} GB available, "
                    f"below threshold {self._storage_low_threshold_gb} GB"
                )
                self._publish_error(
                    title="Storage Low",
                    msg=(
                        f"Available storage is {info.available_gb:.2f} GB, "
                        f"below threshold of {self._storage_low_threshold_gb} GB"
                    ),
                    is_fatal=True,
                )
            else:
                logger.info(
                    f"AllInOne: Storage {info.available_gb:.2f} GB available, "
                    f"above threshold {self._storage_low_threshold_gb} GB"
                )

        return asdict(info)

    # ------------------------------------------------------------------
    # Background monitor
    # ------------------------------------------------------------------

    def _power_monitor_loop(self):
        """
        Poll the power source on a configurable interval and publish an
        error event whenever the device transitions from wall to battery.
        Also re-publishes the low-battery error while charge stays below
        threshold, clearing the alert once charge recovers.
        """
        pythoncom.CoInitialize()
        try:
            c = wmi.WMI()
            while self._should_monitor_power:
                try:
                    info = self._query_power_with_conn(c)

                    # Always keep the Parlay properties current regardless of
                    # whether the source has changed.
                    self.power_source = info.power_source
                    self.battery_level = info.battery_level

                    prev = self._previous_power_info
                    if prev is not None and prev.power_source != info.power_source:
                        if prev.power_source == "wall" and info.power_source == "battery":
                            logger.warning("AllInOne: Device switched to battery power")
                            self._publish_error(
                                title="Running on Battery",
                                msg="Device has switched from wall power to battery power",
                            )
                        elif prev.power_source == "battery" and info.power_source == "wall":
                            logger.warning("AllInOne: Device switched to wall power")
                        else:
                            logger.warning(
                                f"AllInOne: Device switched to unknown "
                                f"power source ({info.power_source})"
                            )

                    self._previous_power_info = info

                except Exception as e:
                    logger.error(f"AllInOne: Monitor loop error: {e}")

                time.sleep(self._power_monitor_interval)
        except Exception as e:
            logger.error(f"AllInOne: Failed to initialise WMI for monitor thread: {e}")
        finally:
            pythoncom.CoUninitialize()
