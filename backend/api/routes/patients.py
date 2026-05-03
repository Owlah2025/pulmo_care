from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date

from db.database import get_db
from db.models import Patient
from core.security import get_current_user, require_role

router = APIRouter(prefix="/api/v1/patients", tags=["patients"])


class PatientCreate(BaseModel):
    name: str
    date_of_birth: Optional[date] = None
    diagnosis: Optional[str] = None
    clinician_id: Optional[str] = None


class PatientResponse(BaseModel):
    id: str
    name: str
    date_of_birth: Optional[date]
    diagnosis: Optional[str]
    clinician_id: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=list[PatientResponse])
async def list_patients(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("Therapist", "Admin")),
):
    """List patients assigned to the current clinician only."""
    clinician_id = current_user.get("sub")

    if current_user.get("role") == "Admin":
        # Admins see all patients
        patients = db.query(Patient).all()
    else:
        # Therapists see only their assigned patients
        patients = db.query(Patient).filter(
            Patient.clinician_id == clinician_id
        ).all()
    return patients


@router.get("/unassigned", response_model=list[PatientResponse])
async def list_unassigned_patients(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("Therapist", "Admin")),
):
    """List patients not yet assigned to any clinician (for therapist to claim)."""
    patients = db.query(Patient).filter(Patient.clinician_id == None).all()
    return patients


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get a single patient. Patients can only read their own record."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    # Patients: only own record
    if current_user.get("role") == "Patient" and str(patient.id) != current_user.get("sub"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    # Therapists: only their assigned patients (unassigned patients → 403)
    if current_user.get("role") == "Therapist":
        if patient.clinician_id is None or str(patient.clinician_id) != current_user.get("sub"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your patient")
    return patient


@router.post("/", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("Therapist", "Admin")),
):
    """Register a new patient and auto-assign to the creating therapist."""
    data = payload.model_dump()
    # Auto-assign to creating therapist if not explicitly set
    if not data.get("clinician_id"):
        data["clinician_id"] = current_user.get("sub")
    patient = Patient(**data)
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.patch("/{patient_id}/assign", response_model=PatientResponse)
async def assign_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("Therapist", "Admin")),
):
    """Assign an unassigned patient to the current therapist."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.clinician_id and current_user.get("role") != "Admin":
        raise HTTPException(
            status_code=409,
            detail=f"Patient already assigned to clinician {patient.clinician_id}"
        )
    patient.clinician_id = current_user.get("sub")
    db.commit()
    db.refresh(patient)
    return patient


@router.delete("/{patient_id}/assign", status_code=204)
async def unassign_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("Admin")),
):
    """Unassign a patient from their clinician (Admin only)."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient.clinician_id = None
    db.commit()
