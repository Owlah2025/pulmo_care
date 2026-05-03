"""
Seed the PULMO CARE database with realistic demo data.
Run: python seed_demo.py
"""
import math
import random
from datetime import date, datetime, timedelta, timezone

from db.database import engine
from db.models import (Base, Clinician, DailyVital, GamificationState,
                       Patient, PFTResult, RiskPrediction)
from db.models import Session as BreathingSession
from db.database import SessionLocal

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()
random.seed(42)

# ── Clinician ─────────────────────────────────────────────────
clinician_id = "00000000-0000-0000-0000-000000000099"
from core.security import get_password_hash
clinician = Clinician(
    id=clinician_id, name="Dr. Sarah Mitchell",
    email="demo@pulmoclinic.com", role="Therapist",
    password_hash=get_password_hash("demo1234"),
)
db.add(clinician)
db.commit()

# ── Patients ──────────────────────────────────────────────────
PATIENTS = [
    dict(id="00000000-0000-0000-0000-000000000001", name="Ahmed Hassan",     dob=date(1955, 3, 12),  diag="COPD Stage III"),
    dict(id="00000000-0000-0000-0000-000000000002", name="Fatima Al-Rashid", dob=date(1962, 7, 8),   diag="ILD"),
    dict(id="00000000-0000-0000-0000-000000000003", name="Mohamed Ibrahim",  dob=date(1949, 11, 22), diag="COPD Stage II"),
    dict(id="00000000-0000-0000-0000-000000000004", name="Sara Khalil",      dob=date(1970, 5, 15),  diag="Asthma / COPD Overlap"),
    dict(id="00000000-0000-0000-0000-000000000005", name="Omar Farouk",      dob=date(1958, 9, 3),   diag="ILD"),
]

for p_data in PATIENTS:
    pat = Patient(
        id=p_data["id"], name=p_data["name"],
        date_of_birth=p_data["dob"], diagnosis=p_data["diag"],
        clinician_id=clinician_id,
    )
    db.add(pat)
db.commit()

# ── Daily Vitals (14 days per patient) ───────────────────────
VITALS_CONFIG = {
    "00000000-0000-0000-0000-000000000001": dict(spo2_base=87, hr_base=90, dysp_base=6),
    "00000000-0000-0000-0000-000000000002": dict(spo2_base=91, hr_base=82, dysp_base=4),
    "00000000-0000-0000-0000-000000000003": dict(spo2_base=93, hr_base=78, dysp_base=3),
    "00000000-0000-0000-0000-000000000004": dict(spo2_base=97, hr_base=72, dysp_base=2),
    "00000000-0000-0000-0000-000000000005": dict(spo2_base=90, hr_base=85, dysp_base=5),
}

for pid_str, cfg in VITALS_CONFIG.items():
    for day in range(14):
        ts = datetime.now(timezone.utc) - timedelta(days=13 - day)
        noise = random.uniform(-2, 2)
        db.add(DailyVital(
            patient_id=pid_str,
            recorded_at=ts,
            spo2_resting=round(cfg["spo2_base"] + math.sin(day * 0.6) * 2 + noise, 1),
            hr_resting=int(cfg["hr_base"] + math.cos(day * 0.4) * 5),
            dyspnea_borg=max(0, min(10, int(cfg["dysp_base"] + math.sin(day * 0.8) * 1.5))),
            fatigue_level=random.choice([1, 2, 2, 3, 3, 4]),
            cough_type=random.choice(["None", "None", "Dry", "Productive"]),
        ))
db.commit()

# ── PFT Results ───────────────────────────────────────────────
PFT_CONFIG = {
    "00000000-0000-0000-0000-000000000001": [
        dict(test_date=date(2025, 1, 15), fev1_liters=1.2, fev1_pct=52, fvc_liters=1.8, fvc_pct=68, ratio=0.68, dlco_pct=58),
        dict(test_date=date(2025, 4, 10), fev1_liters=1.1, fev1_pct=49, fvc_liters=1.7, fvc_pct=65, ratio=0.65, dlco_pct=55),
        dict(test_date=date(2025, 7, 20), fev1_liters=1.1, fev1_pct=48, fvc_liters=1.65, fvc_pct=64, ratio=0.64, dlco_pct=54),
        dict(test_date=date(2025, 10, 5), fev1_liters=1.05, fev1_pct=47, fvc_liters=1.6, fvc_pct=62, ratio=0.62, dlco_pct=52),
    ],
    "00000000-0000-0000-0000-000000000002": [
        dict(test_date=date(2025, 2, 10), fev1_liters=1.8, fev1_pct=65, fvc_liters=2.2, fvc_pct=72, ratio=0.78, dlco_pct=48),
        dict(test_date=date(2025, 5, 15), fev1_liters=1.75, fev1_pct=63, fvc_liters=2.15, fvc_pct=70, ratio=0.77, dlco_pct=46),
    ],
    "00000000-0000-0000-0000-000000000003": [
        dict(test_date=date(2025, 3, 20), fev1_liters=2.1, fev1_pct=72, fvc_liters=2.8, fvc_pct=82, ratio=0.72, dlco_pct=68),
        dict(test_date=date(2025, 9, 10), fev1_liters=2.0, fev1_pct=68, fvc_liters=2.7, fvc_pct=79, ratio=0.70, dlco_pct=65),
    ],
}

for pid_str, pfts in PFT_CONFIG.items():
    for pft in pfts:
        db.add(PFTResult(
            patient_id=pid_str, test_date=pft["test_date"],
            fev1_liters=pft["fev1_liters"], fev1_pct_predicted=pft["fev1_pct"],
            fvc_liters=pft["fvc_liters"], fvc_pct_predicted=pft["fvc_pct"],
            fev1_fvc_ratio=pft["ratio"], dlco_pct_predicted=pft["dlco_pct"],
        ))
db.commit()

# ── Breathing Sessions ────────────────────────────────────────
SESSION_CONFIG = {
    "00000000-0000-0000-0000-000000000001": 6,
    "00000000-0000-0000-0000-000000000002": 4,
    "00000000-0000-0000-0000-000000000003": 5,
    "00000000-0000-0000-0000-000000000004": 7,
    "00000000-0000-0000-0000-000000000005": 3,
}

for pid_str, session_count in SESSION_CONFIG.items():
    for i in range(session_count):
        start = datetime.now(timezone.utc) - timedelta(days=i, hours=random.randint(1, 5))
        db.add(BreathingSession(
            patient_id=pid_str,
            started_at=start,
            ended_at=start + timedelta(minutes=random.randint(15, 30)),
            exercise_type=random.choice(["diaphragmatic", "pursed_lip"]),
            total_breaths=random.randint(18, 32),
            good_breath_pct=round(random.uniform(55, 92), 1),
            avg_bpm=round(random.uniform(12, 20), 1),
            avg_depth_score=round(random.uniform(0.6, 0.95), 2),
            spo2_min=round(random.uniform(86, 94), 1),
            spo2_avg=round(random.uniform(90, 97), 1),
            session_terminated_early=random.random() < 0.1,
        ))
db.commit()

# ── Gamification State ────────────────────────────────────────
GAME_CONFIG = {
    "00000000-0000-0000-0000-000000000001": dict(streak=14, longest=30, sessions=85, xp=2100, badge="bronze"),
    "00000000-0000-0000-0000-000000000002": dict(streak=4,  longest=12, sessions=42, xp=980,  badge="none"),
    "00000000-0000-0000-0000-000000000003": dict(streak=8,  longest=20, sessions=61, xp=1450, badge="bronze"),
    "00000000-0000-0000-0000-000000000004": dict(streak=22, longest=40, sessions=102, xp=2890, badge="silver"),
    "00000000-0000-0000-0000-000000000005": dict(streak=3,  longest=15, sessions=35, xp=820,  badge="none"),
}

for pid_str, g in GAME_CONFIG.items():
    db.add(GamificationState(
        patient_id=pid_str,
        current_streak_days=g["streak"], longest_streak_days=g["longest"],
        total_sessions=g["sessions"], total_xp=g["xp"], badge_level=g["badge"],
    ))
db.commit()

# ── Risk Predictions ──────────────────────────────────────────
RISK_CONFIG = {
    "00000000-0000-0000-0000-000000000001": dict(score=0.82, level="Critical", alert_sent=True),
    "00000000-0000-0000-0000-000000000002": dict(score=0.65, level="High",     alert_sent=False),
    "00000000-0000-0000-0000-000000000003": dict(score=0.41, level="Moderate", alert_sent=False),
    "00000000-0000-0000-0000-000000000004": dict(score=0.18, level="Low",      alert_sent=False),
    "00000000-0000-0000-0000-000000000005": dict(score=0.72, level="High",     alert_sent=True),
}

for pid_str, r in RISK_CONFIG.items():
    db.add(RiskPrediction(
        patient_id=pid_str, risk_score=r["score"], risk_level=r["level"],
        top_features={"spo2_mean_7d": 89.2, "dyspnea_slope": 0.4},
        alert_sent=r["alert_sent"],
    ))
db.commit()
db.close()

print("✅ Demo data seeded successfully!")
print("  Clinician: Dr. Sarah Mitchell | email: demo@pulmoclinic.com | password: demo1234")
print("  Patients: 5 with 14 days of vitals, PFT, sessions & gamification")
