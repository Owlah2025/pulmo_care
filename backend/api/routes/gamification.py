from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, UTC

from db.database import get_db
from db.models import GamificationState
from core.security import get_current_user

router = APIRouter(prefix="/api/v1/gamification", tags=["gamification"])

BADGE_THRESHOLDS = {
    "bronze": 7,
    "silver": 30,
    "gold": 90,
}

TREE_STATES = [
    (7, "lush"),
    (5, "healthy"),
    (3, "wilting"),
    (1, "stressed"),
    (0, "dormant"),
]


def compute_tree_state(sessions_last_7_days: int) -> str:
    for threshold, state in TREE_STATES:
        if sessions_last_7_days >= threshold:
            return state
    return "dormant"


def compute_badge(streak_days: int) -> str:
    if streak_days >= BADGE_THRESHOLDS["gold"]:
        return "gold"
    elif streak_days >= BADGE_THRESHOLDS["silver"]:
        return "silver"
    elif streak_days >= BADGE_THRESHOLDS["bronze"]:
        return "bronze"
    return "none"


class GameStateResponse(BaseModel):
    patient_id: str
    current_streak_days: int
    longest_streak_days: int
    total_sessions: int
    total_xp: int
    badge_level: str
    tree_state: str

    class Config:
        from_attributes = True


class SessionCompletePayload(BaseModel):
    patient_id: str
    xp_earned: int
    sessions_last_7_days: int


@router.get("/{patient_id}", response_model=GameStateResponse)
async def get_game_state(
    patient_id: str,
    sessions_last_7_days: int = 0,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get gamification state for a patient including tree state."""
    state = db.query(GamificationState).filter(
        GamificationState.patient_id == patient_id
    ).first()
    if not state:
        raise HTTPException(status_code=404, detail="Gamification state not found")
    return GameStateResponse(
        patient_id=str(state.patient_id),
        current_streak_days=state.current_streak_days,
        longest_streak_days=state.longest_streak_days,
        total_sessions=state.total_sessions,
        total_xp=state.total_xp,
        badge_level=state.badge_level,
        tree_state=compute_tree_state(sessions_last_7_days),
    )


@router.post("/complete-session", response_model=GameStateResponse)
async def on_session_complete(
    payload: SessionCompletePayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Update gamification state after a patient completes a session.
    Recalculates streak, badge milestone, XP, and tree state.
    """
    state = db.query(GamificationState).filter(
        GamificationState.patient_id == payload.patient_id
    ).first()

    if not state:
        state = GamificationState(patient_id=payload.patient_id)
        db.add(state)

    state.total_sessions += 1
    state.total_xp += payload.xp_earned
    state.current_streak_days += 1
    state.longest_streak_days = max(state.longest_streak_days, state.current_streak_days)
    state.badge_level = compute_badge(state.current_streak_days)
    state.updated_at = datetime.now(UTC)

    db.commit()
    db.refresh(state)

    return GameStateResponse(
        patient_id=str(state.patient_id),
        current_streak_days=state.current_streak_days,
        longest_streak_days=state.longest_streak_days,
        total_sessions=state.total_sessions,
        total_xp=state.total_xp,
        badge_level=state.badge_level,
        tree_state=compute_tree_state(payload.sessions_last_7_days),
    )
