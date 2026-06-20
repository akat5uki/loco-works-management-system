"""
Chat feature: WebSocket-based real-time chat rooms.

Rooms:
  - "all"        → accessible by every authenticated employee
  - "supervisor" → accessible only by Supervisors (category_id == 1)

Message history: last 100 messages per room stored in Redis list (ephemeral).
Multi-container broadcasting: Redis Pub/Sub channels `chat:all` and `chat:supervisor`.
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.redis import redis_client
from app.features.employees.models import Employee, Designation

router = APIRouter()

ROOM_ALL = "all"
ROOM_SUPERVISOR = "supervisor"
VALID_ROOMS = {ROOM_ALL, ROOM_SUPERVISOR}
MAX_HISTORY = 100


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _authenticate_ws(websocket: WebSocket) -> dict | None:
    """
    Extract and validate the session cookie from a WebSocket handshake.
    Returns the JWT payload dict on success, or None on failure.
    """
    token = (
        websocket.cookies.get("session_id_strict")
        or websocket.cookies.get("session_id_embed")
    )
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        ticket_number_raw = payload.get("sub")
        if not ticket_number_raw:
            return None
        # Validate against Redis session store
        session_key = f"session:{ticket_number_raw}"
        stored_token = await redis_client.get(session_key)
        if not stored_token or stored_token != token:
            return None
        return payload
    except JWTError:
        return None


async def _load_employee(ticket_number: int) -> Employee | None:
    """Load Employee with designation + category eagerly from DB."""
    from app.core.database import AsyncSessionLocalPrimary
    async with AsyncSessionLocalPrimary() as db:
        result = await db.execute(
            select(Employee)
            .options(joinedload(Employee.designation).joinedload(Designation.category))
            .where(Employee.ticket_number == ticket_number)
        )
        return result.scalar_one_or_none()


def _is_supervisor(employee: Employee) -> bool:
    return (
        employee.designation is not None
        and employee.designation.category_id == 1
    )


def _redis_history_key(room: str) -> str:
    return f"chat:room:{room}:messages"


def _redis_pubsub_channel(room: str) -> str:
    return f"chat:{room}"


async def _get_history(room: str) -> list[dict]:
    """Fetch last MAX_HISTORY messages for a room (stored newest-first → reverse)."""
    raw = await redis_client.lrange(_redis_history_key(room), 0, MAX_HISTORY - 1)
    messages = [json.loads(m) for m in raw]
    messages.reverse()  # oldest first for display
    return messages


async def _store_and_publish(room: str, message: dict):
    """Push message to Redis list (capped at MAX_HISTORY) and publish via Pub/Sub."""
    key = _redis_history_key(room)
    payload = json.dumps(message)
    pipe = redis_client.pipeline()
    pipe.lpush(key, payload)
    pipe.ltrim(key, 0, MAX_HISTORY - 1)
    await pipe.execute()
    await redis_client.publish(_redis_pubsub_channel(room), payload)


# ---------------------------------------------------------------------------
# REST fallback: GET /chat/history/{room}
# ---------------------------------------------------------------------------

@router.get("/history/{room}")
async def get_chat_history(room: str):
    """REST fallback to load chat history (used on initial page mount)."""
    if room not in VALID_ROOMS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    messages = await _get_history(room)
    return {"room": room, "messages": messages}


# ---------------------------------------------------------------------------
# WebSocket: /chat/ws/{room}
# ---------------------------------------------------------------------------

@router.websocket("/ws/{room}")
async def chat_websocket(websocket: WebSocket, room: str):
    if room not in VALID_ROOMS:
        await websocket.close(code=4004, reason="Room not found")
        return

    # 1. Authenticate
    payload = await _authenticate_ws(websocket)
    if not payload:
        await websocket.close(code=4001, reason="Unauthenticated")
        return

    ticket_number = int(payload["sub"])
    employee = await _load_employee(ticket_number)
    if not employee:
        await websocket.close(code=4001, reason="User not found")
        return

    # 2. Enforce room access
    if room == ROOM_SUPERVISOR and not _is_supervisor(employee):
        await websocket.close(code=4003, reason="Access denied")
        return

    # 3. Accept connection
    await websocket.accept()

    # Register with the room connection registry (in realtime router)
    from app.features.realtime.router import chat_connections
    chat_connections[room].add(websocket)

    sender_info = {
        "sender_ticket": employee.ticket_number,
        "sender_name": employee.name,
        "sender_designation": (
            employee.designation.designation_name if employee.designation else "Unknown"
        ),
        "is_supervisor": _is_supervisor(employee),
    }

    try:
        # 4. Send history
        history = await _get_history(room)
        await websocket.send_json({"type": "history", "messages": history})

        # 5. Notify others that this user joined
        join_msg = {
            "type": "system",
            "text": f"{employee.name} joined the chat",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await websocket.send_json(join_msg)

        # 6. Listen for incoming messages
        while True:
            data = await websocket.receive_json()
            if data.get("type") != "message":
                continue
            text = str(data.get("text", "")).strip()
            if not text or len(text) > 1000:
                continue

            message = {
                "id": str(uuid.uuid4()),
                "type": "message",
                "room": room,
                "text": text,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                **sender_info,
            }
            await _store_and_publish(room, message)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[chat] WebSocket error for {ticket_number}: {e}")
    finally:
        chat_connections[room].discard(websocket)
