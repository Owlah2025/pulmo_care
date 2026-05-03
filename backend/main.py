from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from api.routes import auth, patients, sessions, vitals, pft, predictions, gamification, chatbot, gdpr, reports
from api.websockets.alerts import ws_alerts
from core.middleware import AuditMiddleware
from core.scheduler import start_scheduler

_scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle — starts APScheduler on boot."""
    global _scheduler
    _scheduler = start_scheduler()
    yield
    if _scheduler:
        _scheduler.shutdown(wait=False)


app = FastAPI(
    title="PULMO CARE API",
    description="Backend API for the PULMO CARE Platform — Home-Based Pulmonary Rehabilitation",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────
app.add_middleware(AuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REST Routes ──────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(sessions.router)
app.include_router(vitals.router)
app.include_router(pft.router)
app.include_router(predictions.router)
app.include_router(gamification.router)
app.include_router(chatbot.router)
app.include_router(gdpr.router)
app.include_router(reports.router)

# ── WebSocket ────────────────────────────────────────────────
@app.websocket("/ws/alerts/{clinician_id}")
async def alerts_ws(websocket: WebSocket, clinician_id: str):
    """Real-time alert stream for clinicians."""
    await ws_alerts(websocket, clinician_id)


# ── Health Check ─────────────────────────────────────────────
@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "message": "PULMO CARE API is running"}
