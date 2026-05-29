"""WebSocket endpoint for real-time job progress updates."""
import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
log    = logging.getLogger("avsp.ws")

_connections: set[WebSocket] = set()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _connections.add(ws)
    log.info("WS client connected (%d total)", len(_connections))
    try:
        await ws.send_text(json.dumps({"type": "connected"}))
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    finally:
        _connections.discard(ws)
        log.info("WS client disconnected (%d remaining)", len(_connections))


async def broadcast(msg: dict):
    """Broadcast a message to all connected WebSocket clients."""
    if not _connections:
        return
    payload = json.dumps(msg)
    dead    = set()
    for ws in _connections:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    _connections.difference_update(dead)


def get_connection_count() -> int:
    return len(_connections)
