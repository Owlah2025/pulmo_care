from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from db.database import get_db
from db.models import Clinician, Patient, GamificationState
from core.security import (
    create_access_token, create_refresh_token, decode_token,
    verify_password, get_password_hash, get_current_user
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "Therapist"


@router.post("/token", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Authenticate user with email + password and return JWT tokens.
    Demo credentials: demo@pulmoclinic.com / demo1234
    """
    clinician = db.query(Clinician).filter(Clinician.email == form_data.username).first()
    if not clinician or not clinician.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not verify_password(form_data.password, clinician.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token_data = {"sub": str(clinician.id), "role": clinician.role, "name": clinician.name}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new clinician account."""
    existing = db.query(Clinician).filter(Clinician.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    clinician = Clinician(
        name=payload.name, email=payload.email,
        role=payload.role,
        password_hash=get_password_hash(payload.password),
    )
    db.add(clinician)
    db.commit()
    db.refresh(clinician)
    token_data = {"sub": str(clinician.id), "role": clinician.role, "name": clinician.name}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    payload = decode_token(request.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    token_data = {"sub": payload["sub"], "role": payload.get("role"), "name": payload.get("name")}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.get("/me")
async def get_me(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return the currently authenticated clinician's profile."""
    clinician_id = current_user.get("sub")
    clinician = db.query(Clinician).filter(Clinician.id == clinician_id).first()
    if not clinician:
        return {"name": current_user.get("name", "Clinician"), "role": current_user.get("role"), "id": clinician_id}
    return {"id": str(clinician.id), "name": clinician.name, "email": clinician.email, "role": clinician.role}


# ── Patient Auth (separate from Clinician auth) ─────────────────

class PatientRegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    date_of_birth: Optional[str] = None
    diagnosis: Optional[str] = None


class PatientLoginResponse(TokenResponse):
    patient_id: str
    patient_name: str


@router.post("/patient/register", response_model=PatientLoginResponse, status_code=201)
async def patient_register(payload: PatientRegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new patient account.
    Patients self-register; a clinician can later link them.
    """
    existing = db.query(Patient).filter(Patient.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    import uuid as uuid_mod
    patient = Patient(
        id=str(uuid_mod.uuid4()),
        name=payload.name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        diagnosis=payload.diagnosis,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    # Create gamification state
    game = GamificationState(patient_id=patient.id)
    db.add(game)
    db.commit()

    token_data = {"sub": str(patient.id), "role": "Patient", "name": patient.name}
    return PatientLoginResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        patient_id=str(patient.id),
        patient_name=patient.name,
    )


@router.post("/patient/token", response_model=PatientLoginResponse)
async def patient_login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticate a patient with email + password."""
    patient = db.query(Patient).filter(Patient.email == form_data.username).first()
    if not patient or not patient.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(form_data.password, patient.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token_data = {"sub": str(patient.id), "role": "Patient", "name": patient.name}
    return PatientLoginResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        patient_id=str(patient.id),
        patient_name=patient.name,
    )


@router.get("/patient/me")
async def patient_me(db: Session = Depends(get_db)):
    """Return all registered patients for demo purposes."""
    patients = db.query(Patient).filter(Patient.email.isnot(None)).all()
    return [{"id": p.id, "name": p.name, "email": p.email, "diagnosis": p.diagnosis} for p in patients]
