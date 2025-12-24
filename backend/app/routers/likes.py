from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Like, Post, User
from app.schemas import LikeStatusResponse, MessageResponse
from app.services.auth import get_current_active_user
from app.services.websocket import manager

router = APIRouter(prefix="/likes", tags=["likes"])

# Rate limiter instance
limiter = Limiter(key_func=get_remote_address)


def get_user_data(user: User) -> dict:
    """Get user data dict for WebSocket broadcasts"""
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
    }


@router.post("/{post_id}", response_model=LikeStatusResponse)
@limiter.limit("60/minute")
async def like_post(
    request: Request,
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Like a post (rate limited: 60/minute)"""
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Check if already liked
    existing_like = (
        db.query(Like)
        .filter(Like.user_id == current_user.id, Like.post_id == post_id)
        .first()
    )

    if existing_like:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already liked this post",
        )

    # Create like
    new_like = Like(user_id=current_user.id, post_id=post_id)
    db.add(new_like)
    db.commit()

    # Get updated likes count
    likes_count = db.query(Like).filter(Like.post_id == post_id).count()

    # Broadcast like update via WebSocket
    await manager.broadcast_like_update(
        post_id, likes_count, get_user_data(current_user), is_like=True
    )

    return LikeStatusResponse(is_liked=True, likes_count=likes_count)


@router.delete("/{post_id}", response_model=LikeStatusResponse)
@limiter.limit("60/minute")
async def unlike_post(
    request: Request,
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Unlike a post (rate limited: 60/minute)"""
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Find the like
    existing_like = (
        db.query(Like)
        .filter(Like.user_id == current_user.id, Like.post_id == post_id)
        .first()
    )

    if not existing_like:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have not liked this post",
        )

    # Delete like
    db.delete(existing_like)
    db.commit()

    # Get updated likes count
    likes_count = db.query(Like).filter(Like.post_id == post_id).count()

    # Broadcast unlike update via WebSocket
    await manager.broadcast_like_update(
        post_id, likes_count, get_user_data(current_user), is_like=False
    )

    return LikeStatusResponse(is_liked=False, likes_count=likes_count)


@router.get("/{post_id}/status", response_model=LikeStatusResponse)
async def get_like_status(
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get like status for a post"""
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Check if user liked this post
    is_liked = (
        db.query(Like)
        .filter(Like.user_id == current_user.id, Like.post_id == post_id)
        .first()
        is not None
    )

    # Get likes count
    likes_count = db.query(Like).filter(Like.post_id == post_id).count()

    return LikeStatusResponse(is_liked=is_liked, likes_count=likes_count)


@router.post("/{post_id}/toggle", response_model=LikeStatusResponse)
@limiter.limit("60/minute")
async def toggle_like(
    request: Request,
    post_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Toggle like status for a post (rate limited: 60/minute)"""
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Check if already liked
    existing_like = (
        db.query(Like)
        .filter(Like.user_id == current_user.id, Like.post_id == post_id)
        .first()
    )

    user_data = get_user_data(current_user)

    if existing_like:
        # Unlike
        db.delete(existing_like)
        db.commit()
        likes_count = db.query(Like).filter(Like.post_id == post_id).count()
        await manager.broadcast_like_update(
            post_id, likes_count, user_data, is_like=False
        )
        return LikeStatusResponse(is_liked=False, likes_count=likes_count)
    else:
        # Like
        new_like = Like(user_id=current_user.id, post_id=post_id)
        db.add(new_like)
        db.commit()
        likes_count = db.query(Like).filter(Like.post_id == post_id).count()
        await manager.broadcast_like_update(
            post_id, likes_count, user_data, is_like=True
        )
        return LikeStatusResponse(is_liked=True, likes_count=likes_count)
