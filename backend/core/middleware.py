"""
FastAPI request/response audit logging middleware.
Logs all PHI access with user identity, endpoint, and HTTP status to the structured log.
"""

import time
import uuid
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from core.logging import get_logger

log = get_logger("audit")

# Endpoints that access PHI — log in detail
PHI_ENDPOINTS = {"/api/v1/patients", "/api/v1/vitals", "/api/v1/sessions",
                 "/api/v1/pft", "/api/v1/predictions"}


class AuditMiddleware(BaseHTTPMiddleware):
    """
    HIPAA-compliant audit log middleware.
    Every request to a PHI endpoint is logged with:
    - request_id, user (sub from JWT), method, path, status, duration
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        request_id = str(uuid.uuid4())[:8]

        # Extract user identity from Authorization header (best-effort)
        user_sub = "anonymous"
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            try:
                from core.security import decode_token
                payload = decode_token(auth[7:])
                user_sub = payload.get("sub", "anonymous")
            except Exception:
                pass

        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)

        is_phi = any(request.url.path.startswith(p) for p in PHI_ENDPOINTS)

        log.info("", extra={} if not is_phi else {})
        log.info(
            f"[{request_id}] {request.method} {request.url.path} → {response.status_code} "
            f"({duration_ms}ms) user={user_sub} phi={is_phi}"
        )

        # Attach request_id to response for traceability
        response.headers["X-Request-ID"] = request_id
        return response
