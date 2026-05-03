from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from db.database import get_db
from db.models import Session as BreathingSession
from core.security import get_current_user

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])


class SessionCreate(BaseModel):
    patient_id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    exercise_type: str  # 'diaphragmatic' | 'pursed_lip'
    total_breaths: Optional[int] = None
    good_breath_pct: Optional[float] = None
    avg_bpm: Optional[float] = None
    avg_depth_score: Optional[float] = None
    spo2_min: Optional[float] = None
    spo2_avg: Optional[float] = None
    session_terminated_early: bool = False
    termination_reason: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    patient_id: str
    started_at: datetime
    ended_at: Optional[datetime]
    exercise_type: str
    total_breaths: Optional[int]
    good_breath_pct: Optional[float]
    avg_bpm: Optional[float]
    avg_depth_score: Optional[float]
    spo2_min: Optional[float]
    spo2_avg: Optional[float]
    session_terminated_early: bool
    termination_reason: Optional[str]

    class Config:
        from_attributes = True


@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def upload_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Upload a completed breathing session from the mobile app."""
    session = BreathingSession(**payload.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/patient/{patient_id}", response_model=list[SessionResponse])
async def get_patient_sessions(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve all sessions for a patient."""
    sessions = db.query(BreathingSession).filter(
        BreathingSession.patient_id == patient_id
    ).order_by(BreathingSession.started_at.desc()).all()
    return sessions
