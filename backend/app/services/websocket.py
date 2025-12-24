import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""

    def __init__(self):
        # Store active connections: {user_id: [WebSocket, ...]}
        self.active_connections: dict[int, list[WebSocket]] = {}
        # Store all connections for broadcast
        self.all_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket, user_id: int | None = None):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.all_connections.append(websocket)

        if user_id is not None:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int | None = None):
        """Remove a WebSocket connection"""
        if websocket in self.all_connections:
            self.all_connections.remove(websocket)

        if user_id is not None and user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            # Clean up empty lists
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        """Send a message to a specific user's connections"""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Connection might be closed
                    pass

    async def broadcast(self, message: dict, exclude_user: int | None = None):
        """Broadcast a message to all connected clients"""
        disconnected = []

        for connection in self.all_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Mark for removal
                disconnected.append(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            if connection in self.all_connections:
                self.all_connections.remove(connection)

    async def broadcast_new_post(self, post_data: dict):
        """Broadcast a new post to all clients"""
        message = {"type": "new_post", "data": post_data}
        await self.broadcast(message)

    async def broadcast_new_comment(self, comment_data: dict, post_id: int):
        """Broadcast a new comment to all clients"""
        message = {"type": "new_comment", "data": comment_data, "post_id": post_id}
        await self.broadcast(message)

    async def broadcast_like_update(
        self, post_id: int, likes_count: int, user_data: dict, is_like: bool
    ):
        """Broadcast a like/unlike update to all clients"""
        message = {
            "type": "new_like" if is_like else "unlike",
            "data": {"post_id": post_id, "likes_count": likes_count, "user": user_data},
        }
        await self.broadcast(message)

    async def broadcast_post_deleted(self, post_id: int):
        """Broadcast a post deletion to all clients"""
        message = {"type": "post_deleted", "data": {"post_id": post_id}}
        await self.broadcast(message)

    async def broadcast_comment_deleted(self, comment_id: int, post_id: int):
        """Broadcast a comment deletion to all clients"""
        message = {
            "type": "comment_deleted",
            "data": {"comment_id": comment_id, "post_id": post_id},
        }
        await self.broadcast(message)

    def get_connection_count(self) -> int:
        """Get the total number of active connections"""
        return len(self.all_connections)

    def get_user_connection_count(self, user_id: int) -> int:
        """Get the number of connections for a specific user"""
        if user_id in self.active_connections:
            return len(self.active_connections[user_id])
        return 0


# Global connection manager instance
manager = ConnectionManager()
