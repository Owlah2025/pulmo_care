from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date

from db.database import get_db
from db.models import PFTResult
from core.security import get_current_user

router = APIRouter(prefix="/api/v1/pft", tags=["pft"])


class PFTCreate(BaseModel):
    patient_id: str
    test_date: date
    fev1_liters: Optional[float] = None
    fev1_pct_predicted: Optional[float] = None
    fvc_liters: Optional[float] = None
    fvc_pct_predicted: Optional[float] = None
    fev1_fvc_ratio: Optional[float] = None
    dlco_pct_predicted: Optional[float] = None


class PFTResponse(BaseModel):
    id: str
    patient_id: str
    test_date: date
    fev1_liters: Optional[float]
    fev1_pct_predicted: Optional[float]
    fvc_liters: Optional[float]
    fvc_pct_predicted: Optional[float]
    fev1_fvc_ratio: Optional[float]
    dlco_pct_predicted: Optional[float]

    class Config:
        from_attributes = True


@router.post("/", response_model=PFTResponse, status_code=201)
async def create_pft(
    payload: PFTCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Record a new PFT (Pulmonary Function Test) result."""
    pft = PFTResult(**payload.model_dump())
    db.add(pft)
    db.commit()
    db.refresh(pft)
    return pft


@router.get("/patient/{patient_id}", response_model=list[PFTResponse])
async def get_pft_history(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve PFT history for a patient, ordered by date."""
    results = db.query(PFTResult).filter(
        PFTResult.patient_id == patient_id
    ).order_by(PFTResult.test_date.asc()).all()
    return results
