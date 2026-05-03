"""
Backend tests: exacerbation prediction and safety watchdog.
"""
import pytest
from core.safety_watchdog import SafetyWatchdog
from ml.exacerbation_model.predict import predict_risk
from api.routes.predictions import score_to_level


# ── Safety Watchdog ───────────────────────────────────────────────────────────

class TestSafetyWatchdog:
    def test_safe_reading_returns_none(self):
        wd = SafetyWatchdog()
        result = wd.record(spo2=97.0)
        assert result is None

    def test_hard_stop_below_88(self):
        wd = SafetyWatchdog()
        result = wd.record(spo2=87.5)
        assert result == "HARD_STOP"

    def test_rapid_desaturation_triggers(self):
        from datetime import datetime, timedelta
        wd = SafetyWatchdog()
        base_time = datetime(2025, 1, 1, 12, 0, 0)
        wd.record(spo2=96.0, timestamp=base_time)
        wd.record(spo2=95.0, timestamp=base_time + timedelta(seconds=20))
        # 4% drop within 60 seconds should trigger
        result = wd.record(spo2=91.0, timestamp=base_time + timedelta(seconds=50))
        assert result == "RAPID_DESATURATION"

    def test_slow_drop_does_not_trigger(self):
        from datetime import datetime, timedelta
        wd = SafetyWatchdog()
        base_time = datetime(2025, 1, 1, 12, 0, 0)
        # Drop over 90 seconds (outside window) — should not trigger rapid
        wd.record(spo2=96.0, timestamp=base_time)
        result = wd.record(spo2=91.0, timestamp=base_time + timedelta(seconds=90))
        assert result is None  # Previous reading pruned; hard stop not triggered (>88)


# ── Risk Scoring ──────────────────────────────────────────────────────────────

class TestRiskScoring:
    def test_empty_window_returns_low_score(self):
        score, _ = predict_risk([])
        assert 0.0 <= score <= 1.0

    def test_low_spo2_raises_score(self):
        vitals = [{"spo2_resting": 89, "dyspnea_borg": 3, "cough_type": "None"}]
        score, _ = predict_risk(vitals)
        assert score >= 0.3  # Should at minimum be Moderate

    def test_critical_vitals_produce_high_score(self):
        vitals = [{"spo2_resting": 87, "dyspnea_borg": 9, "cough_type": "Productive"}]
        score, _ = predict_risk(vitals)
        assert score >= 0.6

    @pytest.mark.parametrize("score,expected_level", [
        (0.1, "Low"),
        (0.35, "Moderate"),
        (0.65, "High"),
        (0.85, "Critical"),
    ])
    def test_risk_level_thresholds(self, score, expected_level):
        assert score_to_level(score) == expected_level
