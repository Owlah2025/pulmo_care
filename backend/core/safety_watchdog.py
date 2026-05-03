"""
Safety watchdog logic — mirrors the mobile-side safety_watchdog.dart.
This module validates session data server-side and generates safety events.
"""
from datetime import datetime, timedelta, UTC
from typing import Optional


SPO2_HARD_STOP_THRESHOLD = 88.0       # Absolute minimum SpO2
SPO2_RAPID_DROP_THRESHOLD = 4.0       # % drop within the rolling window
RAPID_DROP_WINDOW_SECONDS = 60        # Seconds to check for rapid desaturation


class SafetyWatchdog:
    """
    Stateful safety watchdog for real-time SpO2 monitoring.
    Tracks readings in a rolling window and flags dangerous conditions.
    """

    def __init__(self):
        self._readings: list[tuple[datetime, float]] = []  # (timestamp, spo2)

    def record(self, spo2: float, timestamp: Optional[datetime] = None) -> Optional[str]:
        """
        Record a new SpO2 reading and check safety thresholds.

        Returns:
            - None if safe
            - "HARD_STOP" if SpO2 < 88%
            - "RAPID_DESATURATION" if SpO2 dropped >= 4% within 60 seconds
        """
        ts = timestamp or datetime.now(UTC)
        self._readings.append((ts, spo2))
        self._prune_old_readings(ts)

        if spo2 < SPO2_HARD_STOP_THRESHOLD:
            return "HARD_STOP"

        if self._rapid_desaturation_detected(spo2):
            return "RAPID_DESATURATION"

        return None

    def _prune_old_readings(self, now: datetime):
        cutoff = now - timedelta(seconds=RAPID_DROP_WINDOW_SECONDS)
        self._readings = [(ts, v) for ts, v in self._readings if ts >= cutoff]

    def _rapid_desaturation_detected(self, current_spo2: float) -> bool:
        if len(self._readings) < 2:
            return False
        oldest_spo2 = self._readings[0][1]
        return (oldest_spo2 - current_spo2) >= SPO2_RAPID_DROP_THRESHOLD
