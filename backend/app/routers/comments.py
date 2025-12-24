from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Comment, Post, User
from app.schemas import (
    CommentCreate,
    CommentListResponse,
    CommentResponse,
    CommentUpdate,
    MessageResponse,
    UserBrief,
)
from app.services.auth import get_current_active_user
from app.services.websocket import manager

router = APIRouter(prefix="/comments", tags=["comments"])

# Rate limiter instance
limiter = Limiter(key_func=get_remote_address)


def comment_to_response(comment: Comment) -> CommentResponse:
    """Convert a Comment model to CommentResponse schema"""
    return CommentResponse(
        id=comment.id,
        content=comment.content,
        author_id=comment.author_id,
        post_id=comment.post_id,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author=UserBrief(
            id=comment.author.id,
            username=comment.author.username,
            display_name=comment.author.display_name,
            avatar_url=comment.author.avatar_url,
        ),
    )


@router.post(
    "/{post_id}", response_model=CommentResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("30/minute")
async def create_comment(
    request: Request,
    post_id: int,
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new comment on a post (rate limited: 30/minute)"""
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Create comment
    comment = Comment(
        content=comment_data.content,
        author_id=current_user.id,
        post_id=post_id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Load the author relationship for the response
    comment = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.id == comment.id)
        .first()
    )

    # Prepare response
    response = comment_to_response(comment)

    # Broadcast new comment via WebSocket
    await manager.broadcast_new_comment(
        comment_data=response.model_dump(mode="json"),
        post_id=post_id,
    )

    return response


@router.get("/post/{post_id}", response_model=CommentListResponse)
async def get_post_comments(
    post_id: int,
    db: Session = Depends(get_db),
):
    """Get all comments for a specific post"""
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Get comments with eager loading (oldest first for comments)
    comments = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
        .all()
    )

    comment_responses = [comment_to_response(comment) for comment in comments]

    return CommentListResponse(
        comments=comment_responses,
        total=len(comment_responses),
    )


@router.get("/{comment_id}", response_model=CommentResponse)
async def get_comment(
    comment_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific comment by ID"""
    comment = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.id == comment_id)
        .first()
    )
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    return comment_to_response(comment)


@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: int,
    comment_data: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update a comment (only by the author)"""
    comment = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.id == comment_id)
        .first()
    )
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    # Check if user is the author
    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own comments",
        )

    # Update comment
    if comment_data.content is not None:
        comment.content = comment_data.content

    db.commit()
    db.refresh(comment)

    # Reload with relationships
    comment = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.id == comment.id)
        .first()
    )

    return comment_to_response(comment)


@router.delete("/{comment_id}", response_model=MessageResponse)
async def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a comment (only by the author or post owner)"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    # Check if user is the author or the post owner
    post = db.query(Post).filter(Post.id == comment.post_id).first()
    if comment.author_id != current_user.id and post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own comments or comments on your posts",
        )

    post_id = comment.post_id

    # Delete comment
    db.delete(comment)
    db.commit()

    # Broadcast comment deletion via WebSocket
    await manager.broadcast_comment_deleted(comment_id=comment_id, post_id=post_id)

    return MessageResponse(message="Comment deleted successfully")
