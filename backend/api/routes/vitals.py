from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

from db.database import get_db
from db.models import DailyVital
from core.security import get_current_user

router = APIRouter(prefix="/api/v1/vitals", tags=["vitals"])


class VitalsCreate(BaseModel):
    patient_id: str
    recorded_at: datetime
    spo2_resting: Optional[float] = None
    hr_resting: Optional[int] = None
    dyspnea_borg: Optional[int] = None       # Modified Borg Scale 0-10
    fatigue_level: Optional[int] = None      # 1-5
    cough_type: Optional[str] = None         # None/Dry/Productive/Wet


class VitalsResponse(BaseModel):
    id: str
    patient_id: str
    recorded_at: datetime
    spo2_resting: Optional[float]
    hr_resting: Optional[int]
    dyspnea_borg: Optional[int]
    fatigue_level: Optional[int]
    cough_type: Optional[str]

    class Config:
        from_attributes = True


@router.post("/", response_model=VitalsResponse, status_code=status.HTTP_201_CREATED)
async def log_vitals(
    payload: VitalsCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Log daily vitals for a patient (SpO2, dyspnea, fatigue, cough, etc.)."""
    vital = DailyVital(**payload.model_dump())
    db.add(vital)
    db.commit()
    db.refresh(vital)
    return vital


@router.get("/patient/{patient_id}", response_model=list[VitalsResponse])
async def get_patient_vitals(
    patient_id: str,
    days: int = 14,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve the last N days of vitals for a patient (defaults to 14 days)."""
    since = datetime.utcnow() - timedelta(days=days)
    vitals = db.query(DailyVital).filter(
        DailyVital.patient_id == patient_id,
        DailyVital.recorded_at >= since,
    ).order_by(DailyVital.recorded_at.asc()).all()
    return vitals
