"""
Nightly Risk Scoring Scheduler
Uses APScheduler to run the exacerbation prediction model every night at 02:00.
Results are cached in Redis for 6 hours (TTL) to avoid re-computation.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from db.database import SessionLocal
from db.models import Patient, DailyVital, RiskPrediction, Session as BreathingSession
from ml.exacerbation_model.predict import predict_risk
from api.routes.predictions import score_to_level
from api.websockets.alerts import push_alert

log = logging.getLogger(__name__)

try:
    import redis as redis_lib
    _redis = redis_lib.Redis(host="localhost", port=6379, db=0, decode_responses=True)
    _redis.ping()
    REDIS_AVAILABLE = True
except Exception:
    REDIS_AVAILABLE = False
    _redis = None

CACHE_TTL_SECONDS = 6 * 3600   # 6-hour cache
ALERT_THRESHOLD_PUSH  = "Moderate"   # Push notification threshold
ALERT_THRESHOLD_SMS   = "Critical"   # SMS + call fallback threshold

RISK_ORDER = {"Low": 0, "Moderate": 1, "High": 2, "Critical": 3}


def _get_cache_key(patient_id: str) -> str:
    return f"pulmo:risk:{patient_id}:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"


def _cache_score(patient_id: str, score: float, level: str):
    if not REDIS_AVAILABLE:
        return
    key = _get_cache_key(patient_id)
    _redis.setex(key, CACHE_TTL_SECONDS, json.dumps({"score": score, "level": level}))


def _get_cached_score(patient_id: str) -> dict | None:
    if not REDIS_AVAILABLE:
        return None
    key = _get_cache_key(patient_id)
    raw = _redis.get(key)
    return json.loads(raw) if raw else None


def score_all_patients():
    """
    Nightly job: score every active patient and persist predictions.
    High/Critical patients get a real-time WebSocket alert to their clinician.
    """
    log.info("Nightly scoring started")
    db: Session = SessionLocal()

    try:
        patients = db.query(Patient).all()
        for patient in patients:
            patient_id = str(patient.id)

            # Check Redis cache first (in case of re-run within 6h)
            cached = _get_cached_score(patient_id)
            if cached:
                log.info(f"Cache hit for patient {patient_id}: {cached['level']}")
                continue

            # Fetch last 7 days of vitals
            from datetime import timedelta
            since = datetime.now(timezone.utc) - timedelta(days=7)
            vitals = db.query(DailyVital).filter(
                DailyVital.patient_id == patient.id,
                DailyVital.recorded_at >= since,
            ).order_by(DailyVital.recorded_at.asc()).all()

            vitals_window = [
                {
                    "spo2_resting": v.spo2_resting,
                    "hr_resting": v.hr_resting,
                    "dyspnea_borg": v.dyspnea_borg,
                    "fatigue_level": v.fatigue_level,
                    "cough_type": v.cough_type,
                }
                for v in vitals
            ]

            risk_score, top_features = predict_risk(vitals_window)
            risk_level = score_to_level(risk_score)

            # Persist prediction
            record = RiskPrediction(
                patient_id=patient.id,
                risk_score=risk_score,
                risk_level=risk_level,
                top_features=top_features,
            )
            db.add(record)

            # Cache the result
            _cache_score(patient_id, risk_score, risk_level)

            # Push alert to clinician if threshold met
            if RISK_ORDER.get(risk_level, 0) >= RISK_ORDER.get(ALERT_THRESHOLD_PUSH, 1):
                import asyncio
                alert = {
                    "id": str(record.id) if record.id else patient_id,
                    "type": f"risk_{risk_level.lower()}",
                    "patient_id": patient_id,
                    "patient_name": patient.name,
                    "message": f"Nightly ML risk score: {risk_level} ({risk_score * 100:.0f}%). Review required.",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                # Fire-and-forget to clinician (no clinician_id lookup yet — broadcast)
                try:
                    asyncio.get_event_loop().run_until_complete(
                        push_alert("demo-clinician", alert)
                    )
                except Exception:
                    pass  # WebSocket not connected — alert will appear on next login

                # For Critical: also flag alert_sent on the record
                if risk_level == "Critical":
                    record.alert_sent = True

            log.info(f"Scored patient {patient.name}: {risk_level} ({risk_score:.2f})")

        db.commit()
    except Exception as exc:
        db.rollback()
        log.exception(f"Nightly scoring failed: {exc}")
    finally:
        db.close()

    log.info("Nightly scoring complete")


def generate_weekly_reports():
    """
    Weekly job: Generate clinical summary reports for all patients.
    Aggregates adherence, safety events, and risk trends.
    """
    log.info("Weekly report generation started")
    db: Session = SessionLocal()

    try:
        patients = db.query(Patient).all()
        for patient in patients:
            # 1. Fetch data for last 7 days
            since = datetime.now(timezone.utc) - timedelta(days=7)

            sessions = db.query(BreathingSession).filter(
                BreathingSession.patient_id == patient.id,
                BreathingSession.started_at >= since
            ).all()

            vitals = db.query(DailyVital).filter(
                DailyVital.patient_id == patient.id,
                DailyVital.recorded_at >= since
            ).all()

            predictions = db.query(RiskPrediction).filter(
                RiskPrediction.patient_id == patient.id,
                RiskPrediction.predicted_at >= since
            ).all()

            # 2. Compute Aggregates
            total_sessions = len(sessions)
            avg_good_breath = sum(s.good_breath_pct or 0 for s in sessions) / total_sessions if total_sessions > 0 else 0
            avg_spo2 = sum(v.spo2_resting or 0 for v in vitals) / len(vitals) if vitals else 0
            max_risk = max([p.risk_level for p in predictions], key=lambda x: RISK_ORDER.get(x, 0)) if predictions else "Low"

            # 3. "Send" Report (Log it for MVP)
            report_summary = (
                f"WEEKLY CLINICAL SUMMARY: {patient.name}\n"
                f"----------------------------------------\n"
                f"Adherence: {total_sessions}/7 sessions completed\n"
                f"Quality: {avg_good_breath:.1f}% Avg Good Breaths\n"
                f"Safety: {avg_spo2:.1f}% Avg Resting SpO2\n"
                f"Risk Status: {max_risk}\n"
                f"----------------------------------------"
            )
            log.info(report_summary)

    except Exception as exc:
        log.exception(f"Weekly report failed: {exc}")
    finally:
        db.close()
    log.info("Weekly report generation complete")


def start_scheduler() -> BackgroundScheduler:
    """Start the APScheduler with nightly and weekly jobs."""
    scheduler = BackgroundScheduler(timezone="UTC")
    
    # Nightly prediction job
    scheduler.add_job(
        score_all_patients,
        trigger=CronTrigger(hour=2, minute=0),
        id="nightly_risk_scoring",
        replace_existing=True,
    )
    
    # Weekly summary report job (Every Monday at 08:00 UTC)
    scheduler.add_job(
        generate_weekly_reports,
        trigger=CronTrigger(day_of_week='mon', hour=8, minute=0),
        id="weekly_clinical_reports",
        replace_existing=True,
    )
    
    scheduler.start()
    log.info("APScheduler started — nightly scoring at 02:00, weekly reports Mon 08:00")
    return scheduler
