import asyncio
import json
import uuid
from collections import defaultdict
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings

router = APIRouter()

from app.core.redis import redis_client

# Track active websocket connections for workshop telemetry
active_connections: Set[WebSocket] = set()

# Track chat connections per room: {"all": {ws1, ws2}, "supervisor": {ws3}}
chat_connections: Dict[str, Set[WebSocket]] = defaultdict(set)

STREAM_KEY = "workshop_telemetry"
GROUP_NAME = "workshop_consumers"


async def initialize_redis_stream():
    try:
        await redis_client.xgroup_create(STREAM_KEY, GROUP_NAME, mkstream=True)
    except Exception as e:
        if "BUSYGROUP" not in str(e):
            print(f"Error creating consumer group: {e}")


async def redis_stream_listener():
    consumer_name = f"consumer-{uuid.uuid4()}"
    await initialize_redis_stream()

    while True:
        try:
            # Read new messages from the stream
            messages = await redis_client.xreadgroup(
                GROUP_NAME, consumer_name, {STREAM_KEY: ">"}, count=10, block=1000
            )
            for stream, msgs in messages:
                for msg_id, msg_data in msgs:
                    # Broadcast to all local websockets
                    for connection in list(active_connections):
                        try:
                            await connection.send_json(msg_data)
                        except Exception:
                            active_connections.discard(connection)

                    # Acknowledge message processing
                    await redis_client.xack(STREAM_KEY, GROUP_NAME, msg_id)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Redis stream error: {e}")
            await asyncio.sleep(2)


async def chat_pubsub_listener():
    """
    Subscribe to Redis Pub/Sub channels for chat rooms.
    Uses get_message() polling (more reliable than async-for listen() with
    Sentinel clients) to broadcast incoming messages to all locally-connected
    WebSocket clients subscribed to that room.
    """
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("chat:all", "chat:supervisor")
    print("[chat] Pub/Sub listener started, subscribed to chat:all and chat:supervisor")
    try:
        while True:
            try:
                raw = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=0.05
                )
                if raw and raw.get("type") == "message":
                    channel: str = raw["channel"]
                    room = channel.split(":")[-1]  # "chat:all" → "all"
                    try:
                        message = json.loads(raw["data"])
                    except (json.JSONDecodeError, TypeError):
                        pass
                    else:
                        dead = set()
                        for ws in list(chat_connections.get(room, set())):
                            try:
                                await ws.send_json(message)
                            except Exception:
                                dead.add(ws)
                        for ws in dead:
                            chat_connections[room].discard(ws)
                # Yield to the event loop between polls
                await asyncio.sleep(0.01)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                print(f"[chat] Pub/Sub poll error: {e}")
                await asyncio.sleep(1)
    except asyncio.CancelledError as e:
        print(f"[chat] Pub/Sub listener cancelled: {type(e)}")
        raise
    except BaseException as e:
        print(f"[chat] Pub/Sub listener exited with unexpected BaseException: {type(e)}: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        try:
            await pubsub.unsubscribe("chat:all", "chat:supervisor")
            await pubsub.close()
        except Exception:
            pass
        print("[chat] Pub/Sub listener stopped")


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    try:
        while True:
            # In a real app, clients might send heartbeat or commands
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.discard(websocket)


async def broadcast_event(event_type: str, payload: dict):
    """
    Publish an event to the Redis Stream.
    Other containers will pick this up and broadcast to their WebSockets.
    """
    await redis_client.xadd(
        STREAM_KEY, {"type": event_type, "payload": json.dumps(payload)}
    )
