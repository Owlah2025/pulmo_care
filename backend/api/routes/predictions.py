from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from pydantic import ConfigDict
from typing import Optional, Any
from datetime import datetime

from db.database import get_db
from db.models import RiskPrediction
from core.security import get_current_user

router = APIRouter(prefix="/api/v1/predictions", tags=["predictions"])


class VitalsWindow(BaseModel):
    patient_id: str
    vitals_window: list[dict]  # Last 7 days of daily_vitals records


class PredictionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_id: str
    predicted_at: datetime
    risk_score: float
    risk_level: str
    top_features: Optional[Any]
    alert_sent: bool


RISK_THRESHOLDS = {
    "Low": (0.0, 0.30),
    "Moderate": (0.30, 0.60),
    "High": (0.60, 0.80),
    "Critical": (0.80, 1.01),
}


def score_to_level(score: float) -> str:
    for level, (low, high) in RISK_THRESHOLDS.items():
        if low <= score < high:
            return level
    return "Low"


@router.post("/score", response_model=PredictionResponse)
async def score_patient(
    payload: VitalsWindow,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Compute exacerbation risk score for a patient.
    Uses ML model if trained, otherwise rule-based fallback.
    """
    from ml.exacerbation_model.predict import predict_risk

    risk_score, top_features = predict_risk(payload.vitals_window)
    risk_level = score_to_level(risk_score)

    record = RiskPrediction(
        patient_id=payload.patient_id,
        risk_score=risk_score,
        risk_level=risk_level,
        top_features=top_features,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/patient/{patient_id}/latest", response_model=PredictionResponse)
async def get_latest_prediction(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get the most recent risk prediction for a patient."""
    prediction = db.query(RiskPrediction).filter(
        RiskPrediction.patient_id == patient_id
    ).order_by(RiskPrediction.predicted_at.desc()).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="No predictions found for this patient")
    return prediction


@router.get("/patient/{patient_id}/history", response_model=list[PredictionResponse])
async def get_prediction_history(
    patient_id: str,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get prediction history for trend charts."""
    predictions = db.query(RiskPrediction).filter(
        RiskPrediction.patient_id == patient_id
    ).order_by(RiskPrediction.predicted_at.desc()).limit(limit).all()
    return predictions
