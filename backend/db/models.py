import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, Date, DateTime, ForeignKey, JSON, TypeDecorator
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class UUIDType(TypeDecorator):
    """
    Platform-independent UUID type.
    Uses PostgreSQL's UUID natively; stores as String(36) in SQLite.
    """
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value  # Return as string — consistent across backends


class Clinician(Base):
    __tablename__ = "clinicians"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=True)   # Added for real auth
    role = Column(String, default="Therapist")       # Therapist, Admin
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    patients = relationship("Patient", back_populates="clinician")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=True)   # For patient login
    password_hash = Column(String, nullable=True)        # For patient login
    date_of_birth = Column(Date)
    diagnosis = Column(String)  # COPD / ILD / etc.
    clinician_id = Column(UUIDType, ForeignKey("clinicians.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clinician = relationship("Clinician", back_populates="patients")
    sessions = relationship("Session", back_populates="patient")
    daily_vitals = relationship("DailyVital", back_populates="patient")
    risk_predictions = relationship("RiskPrediction", back_populates="patient")
    pft_results = relationship("PFTResult", back_populates="patient")
    rehab_plan = relationship("RehabPlan", back_populates="patient", uselist=False)
    gamification_state = relationship("GamificationState", back_populates="patient", uselist=False)


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(UUIDType, ForeignKey("patients.id"))
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    exercise_type = Column(String)  # 'diaphragmatic' | 'pursed_lip'
    total_breaths = Column(Integer)
    good_breath_pct = Column(Float)
    avg_bpm = Column(Float)
    avg_depth_score = Column(Float)
    spo2_min = Column(Float)
    spo2_avg = Column(Float)
    session_terminated_early = Column(Boolean, default=False)
    termination_reason = Column(String)

    patient = relationship("Patient", back_populates="sessions")


class DailyVital(Base):
    __tablename__ = "daily_vitals"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(UUIDType, ForeignKey("patients.id"))
    recorded_at = Column(DateTime(timezone=True))
    spo2_resting = Column(Float)
    hr_resting = Column(Integer)
    dyspnea_borg = Column(Integer)
    fatigue_level = Column(Integer)
    cough_type = Column(String)

    patient = relationship("Patient", back_populates="daily_vitals")


class RiskPrediction(Base):
    __tablename__ = "risk_predictions"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(UUIDType, ForeignKey("patients.id"))
    predicted_at = Column(DateTime(timezone=True), server_default=func.now())
    risk_score = Column(Float)
    risk_level = Column(String)
    top_features = Column(JSON)
    alert_sent = Column(Boolean, default=False)

    patient = relationship("Patient", back_populates="risk_predictions")


class PFTResult(Base):
    __tablename__ = "pft_results"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(UUIDType, ForeignKey("patients.id"))
    test_date = Column(Date)
    fev1_liters = Column(Float)
    fev1_pct_predicted = Column(Float)
    fvc_liters = Column(Float)
    fvc_pct_predicted = Column(Float)
    fev1_fvc_ratio = Column(Float)
    dlco_pct_predicted = Column(Float)

    patient = relationship("Patient", back_populates="pft_results")


class RehabPlan(Base):
    __tablename__ = "rehab_plans"

    id = Column(UUIDType, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(UUIDType, ForeignKey("patients.id"))
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

    # Inputs from OCR
    fev1_liters = Column(Float)
    fvc_liters = Column(Float)
    six_mwt_distance = Column(Float)
    dyspnea_scale = Column(Integer)

    # Generated plan details
    session_frequency_daily = Column(Integer)
    session_duration_minutes = Column(Integer)
    intensity_level = Column(String)  # Low, Moderate, High
    recommended_exercises = Column(JSON)  # List of strings

    patient = relationship("Patient", back_populates="rehab_plan")


class GamificationState(Base):
    __tablename__ = "gamification_state"

    patient_id = Column(UUIDType, ForeignKey("patients.id"), primary_key=True)
    current_streak_days = Column(Integer, default=0)
    longest_streak_days = Column(Integer, default=0)
    total_sessions = Column(Integer, default=0)
    total_xp = Column(Integer, default=0)
    badge_level = Column(String, default='none')
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", back_populates="gamification_state")
