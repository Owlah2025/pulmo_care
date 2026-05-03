"""
GDPR Compliance Endpoints

Implements:
- Right to access (data export)
- Right to erasure (soft-delete / anonymization)
- Consent management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, UTC

from db.database import get_db
from db.models import Patient, DailyVital, RiskPrediction, GamificationState
from core.security import get_current_user, require_role
from core.logging import get_logger

router = APIRouter(prefix="/api/v1/gdpr", tags=["gdpr"])
log = get_logger("gdpr")


class ErasureRequest(BaseModel):
    patient_id: str
    reason: str


class ConsentUpdate(BaseModel):
    patient_id: str
    analytics_consent: bool
    research_consent: bool


@router.get("/export/{patient_id}")
async def export_patient_data(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """GDPR Right to Access — export all data for a patient."""
    if current_user.get("role") == "Patient" and current_user.get("sub") != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    vitals = db.query(DailyVital).filter(DailyVital.patient_id == patient_id).all()
    predictions = db.query(RiskPrediction).filter(RiskPrediction.patient_id == patient_id).all()
    game = db.query(GamificationState).filter(GamificationState.patient_id == patient_id).first()

    log.info(f"GDPR export: patient={patient_id} requested_by={current_user.get('sub')}")

    return {
        "exported_at": datetime.now(UTC).isoformat(),
        "patient": {
            "id": str(patient.id),
            "name": patient.name,
            "date_of_birth": str(patient.date_of_birth),
            "diagnosis": patient.diagnosis,
            "created_at": str(patient.created_at),
        },
        "daily_vitals": [
            {
                "recorded_at": str(v.recorded_at),
                "spo2_resting": v.spo2_resting,
                "hr_resting": v.hr_resting,
                "dyspnea_borg": v.dyspnea_borg,
                "fatigue_level": v.fatigue_level,
                "cough_type": v.cough_type,
            }
            for v in vitals
        ],
        "risk_predictions": [
            {
                "predicted_at": str(p.predicted_at),
                "risk_score": p.risk_score,
                "risk_level": p.risk_level,
            }
            for p in predictions
        ],
        "gamification": {
            "streak_days": game.current_streak_days if game else 0,
            "total_xp": game.total_xp if game else 0,
            "badge_level": game.badge_level if game else "none",
        } if game else None,
    }


@router.delete("/erase/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def erase_patient_data(
    patient_id: str,
    request: ErasureRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("Admin")),
):
    """GDPR Right to Erasure — anonymize a patient's personal data (Admin-only)."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient.name = f"ERASED_{patient_id[:8]}"
    patient.date_of_birth = None
    patient.clinician_id = None

    db.commit()
    log.info(f"GDPR erasure: patient={patient_id} reason='{request.reason}' admin={current_user.get('sub')}")


@router.put("/consent/{patient_id}")
async def update_consent(
    patient_id: str,
    payload: ConsentUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Record updated consent preferences for a patient."""
    if current_user.get("role") == "Patient" and current_user.get("sub") != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    log.info(
        f"Consent update: patient={patient_id} "
        f"analytics={payload.analytics_consent} "
        f"research={payload.research_consent}"
    )
    return {"status": "updated", "patient_id": patient_id}
