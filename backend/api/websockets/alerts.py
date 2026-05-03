"""
WebSocket endpoint for real-time clinician alert push.

Clinicians connect here and receive live alerts when:
- A patient's SpO2 drops below the safety threshold
- A nightly risk prediction returns High or Critical
"""

from fastapi import WebSocket, WebSocketDisconnect
import json
from typing import Dict

# In-memory registry: clinician_id -> WebSocket connection
_connections: Dict[str, WebSocket] = {}


async def ws_alerts(websocket: WebSocket, clinician_id: str):
    """WebSocket handler — register a clinician and stream alerts."""
    await websocket.accept()
    _connections[clinician_id] = websocket
    try:
        while True:
            # Keep connection alive; we push server-side, not request-reply
            await websocket.receive_text()
    except WebSocketDisconnect:
        _connections.pop(clinician_id, None)


async def push_alert(clinician_id: str, alert: dict):
    """Push a JSON alert to a specific connected clinician."""
    ws = _connections.get(clinician_id)
    if ws:
        try:
            await ws.send_text(json.dumps(alert))
        except Exception:
            _connections.pop(clinician_id, None)


async def broadcast_critical_alert(alert: dict):
    """Broadcast a critical alert to all connected clinicians."""
    disconnected = []
    for cid, ws in _connections.items():
        try:
            await ws.send_text(json.dumps(alert))
        except Exception:
            disconnected.append(cid)
    for cid in disconnected:
        _connections.pop(cid, None)
