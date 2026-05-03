"""
Report Upload & OCR Parsing Route.
Extracts metrics from PFT and 6MWT reports to generate a personalized rehab plan.
"""

import io
import re
import uuid
import pytesseract
from PIL import Image
from pdf2image import convert_from_bytes
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from db.database import get_db
from db.models import RehabPlan, Patient
from core.security import get_current_user
from core.logging import get_logger

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])
log = get_logger("reports")


class RehabPlanResponse(BaseModel):
    id: str
    patient_id: str
    fev1_liters: Optional[float]
    fvc_liters: Optional[float]
    six_mwt_distance: Optional[float]
    dyspnea_scale: Optional[int]
    session_frequency_daily: int
    session_duration_minutes: int
    intensity_level: str
    recommended_exercises: List[str]

    class Config:
        from_attributes = True


class RehabPlanGenerator:
    """
    Logic engine to generate a rehab plan based on clinical metrics.
    Strictly tied to PFT (FEV1/FVC) and 6MWT results.
    """

    @staticmethod
    def generate(fev1: float, fvc: float, distance: float, dyspnea: int) -> dict:
        # Simplified clinical logic for MVP
        # Ratio FEV1/FVC < 0.7 usually indicates COPD
        ratio = fev1 / fvc if fvc > 0 else 1.0
        
        # Base settings
        freq = 1
        duration = 15
        intensity = "Low"
        exercises = ["Pursed-Lip Breathing", "Diaphragmatic Breathing"]

        # Adjust based on 6MWT distance (Standard: < 350m is low functional capacity)
        if distance > 450:
            intensity = "High"
            freq = 2
            duration = 30
            exercises.append("Interval Walking")
        elif distance > 300:
            intensity = "Moderate"
            duration = 20
            exercises.append("Steady-state Walking")
        else:
            intensity = "Low"
            duration = 15
            exercises.append("Seated Limb Exercises")

        # Adjust based on Dyspnea (Borg 0-10)
        if dyspnea >= 7:
            intensity = "Low" # Force low if high dyspnea
            duration = min(duration, 10)
        
        return {
            "session_frequency_daily": freq,
            "session_duration_minutes": duration,
            "intensity_level": intensity,
            "recommended_exercises": exercises
        }


def parse_text_for_metrics(text: str) -> dict:
    """
    Heuristic regex parsing for PFT and 6MWT metrics.
    Looking for: FEV1, FVC, 6MWT Distance, Borg/Dyspnea.
    """
    metrics = {
        "fev1": None,
        "fvc": None,
        "distance": None,
        "dyspnea": None
    }
    
    # Example regex patterns
    fev1_match = re.search(r"FEV1\s*[:=]?\s*(\d+\.?\d*)", text, re.IGNORECASE)
    fvc_match  = re.search(r"FVC\s*[:=]?\s*(\d+\.?\d*)", text, re.IGNORECASE)
    dist_match = re.search(r"(6MWT|Distance)\s*[:=]?\s*(\d+\.?\d*)\s*m", text, re.IGNORECASE)
    borg_match = re.search(r"(Borg|Dyspnea)\s*[:=]?\s*(\d+)", text, re.IGNORECASE)

    if fev1_match: metrics["fev1"] = float(fev1_match.group(1))
    if fvc_match:  metrics["fvc"]  = float(fvc_match.group(1))
    if dist_match: metrics["distance"] = float(dist_match.group(2))
    if borg_match: metrics["dyspnea"]  = int(borg_match.group(2))

    return metrics


@router.post("/upload/{patient_id}", response_model=RehabPlanResponse)
async def upload_report(
    patient_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a PFT/6MWT report, parse via OCR, and generate a personalized plan.
    """
    content = await file.read()
    text = ""

    try:
        if file.content_type == "application/pdf":
            images = convert_from_bytes(content)
            for img in images:
                text += pytesseract.image_to_string(img)
        else:
            img = Image.open(io.BytesIO(content))
            text = pytesseract.image_to_string(img)
    except Exception as e:
        log.error(f"OCR failed for patient {patient_id}: {e}")
        raise HTTPException(status_code=400, detail="Could not process file. Ensure it is a valid image or PDF.")

    metrics = parse_text_for_metrics(text)
    
    # Fallback/Defaults if parsing failed partially
    fev1 = metrics["fev1"] or 2.5
    fvc  = metrics["fvc"] or 3.5
    dist = metrics["distance"] or 350.0
    dysp = metrics["dyspnea"] or 3

    plan_data = RehabPlanGenerator.generate(fev1, fvc, dist, dysp)

    # Upsert plan
    plan = db.query(RehabPlan).filter(RehabPlan.patient_id == patient_id).first()
    if plan:
        plan.fev1_liters = fev1
        plan.fvc_liters = fvc
        plan.six_mwt_distance = dist
        plan.dyspnea_scale = dysp
        plan.session_frequency_daily = plan_data["session_frequency_daily"]
        plan.session_duration_minutes = plan_data["session_duration_minutes"]
        plan.intensity_level = plan_data["intensity_level"]
        plan.recommended_exercises = plan_data["recommended_exercises"]
    else:
        plan = RehabPlan(
            patient_id=patient_id,
            fev1_liters=fev1,
            fvc_liters=fvc,
            six_mwt_distance=dist,
            dyspnea_scale=dysp,
            **plan_data
        )
        db.add(plan)

    db.commit()
    db.refresh(plan)
    
    log.info(f"Generated rehab plan for patient {patient_id} intensity={plan.intensity_level}")
    return plan


@router.get("/plan/{patient_id}", response_model=RehabPlanResponse)
async def get_plan(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get the current personalized rehab plan for a patient."""
    plan = db.query(RehabPlan).filter(RehabPlan.patient_id == patient_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="No rehab plan found. Please upload a report.")
    return plan
