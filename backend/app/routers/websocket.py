from typing import Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.services.websocket import manager

router = APIRouter(prefix="/ws", tags=["websocket"])


async def get_user_from_token(token: str, db: Session) -> Optional[User]:
    """Extract user from JWT token for WebSocket authentication"""
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        user_id: int = payload.get("sub")
        if user_id is None:
            return None
        user = db.query(User).filter(User.id == user_id).first()
        return user
    except JWTError:
        return None


@router.websocket("/feed")
async def websocket_feed(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    WebSocket endpoint for real-time feed updates.

    Connect with optional authentication:
    - ws://host/ws/feed?token=<jwt_token>  (authenticated)
    - ws://host/ws/feed  (anonymous, read-only)

    Messages sent to clients:
    - new_post: When a new post is created
    - new_comment: When a new comment is added
    - new_like: When someone likes a post
    - unlike: When someone unlikes a post
    - post_deleted: When a post is deleted
    - comment_deleted: When a comment is deleted
    """
    user = None
    user_id = None

    # Try to authenticate if token provided
    if token:
        user = await get_user_from_token(token, db)
        if user:
            user_id = user.id

    # Accept connection
    await manager.connect(websocket, user_id)

    try:
        # Send initial connection success message
        await websocket.send_json(
            {
                "type": "connected",
                "data": {
                    "authenticated": user is not None,
                    "user_id": user_id,
                    "message": "Connected to feed updates",
                },
            }
        )

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for any message from client (could be ping/pong or other)
                data = await websocket.receive_json()

                # Handle ping messages to keep connection alive
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})

                # Handle subscription requests (for future use)
                elif data.get("type") == "subscribe":
                    # Could implement topic-based subscriptions here
                    await websocket.send_json(
                        {
                            "type": "subscribed",
                            "data": {"topic": data.get("topic", "feed")},
                        }
                    )

            except Exception:
                # If we can't parse JSON, just continue
                # Client might have sent text or binary data
                pass

    except WebSocketDisconnect:
        # Client disconnected
        manager.disconnect(websocket, user_id)
    except Exception:
        # Any other error, clean up connection
        manager.disconnect(websocket, user_id)


@router.websocket("/notifications/{user_id}")
async def websocket_notifications(
    websocket: WebSocket,
    user_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    WebSocket endpoint for user-specific notifications.
    Requires authentication.

    Connect: ws://host/ws/notifications/{user_id}?token=<jwt_token>

    Messages sent to clients:
    - notification: Personal notifications (mentions, replies, etc.)
    """
    # Verify token and user
    user = await get_user_from_token(token, db)

    if not user or user.id != user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(websocket, user_id)

    try:
        await websocket.send_json(
            {
                "type": "connected",
                "data": {
                    "user_id": user_id,
                    "message": "Connected to personal notifications",
                },
            }
        )

        while True:
            try:
                data = await websocket.receive_json()

                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})

            except Exception:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception:
        manager.disconnect(websocket, user_id)
