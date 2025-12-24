from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Post, User
from app.schemas import (
    MessageResponse,
    PostListResponse,
    PostResponse,
    UserBrief,
)
from app.services.auth import get_current_user, get_current_user_optional
from app.services.file_upload import file_upload_service
from app.services.websocket import manager

router = APIRouter(prefix="/posts", tags=["posts"])

# Rate limiter instance
limiter = Limiter(key_func=get_remote_address)


def post_to_response(post: Post, current_user_id: Optional[int] = None) -> PostResponse:
    """Convert a Post model to PostResponse schema"""
    is_liked = False
    if current_user_id and post.likes:
        is_liked = any(like.user_id == current_user_id for like in post.likes)

    return PostResponse(
        id=post.id,
        content=post.content,
        image_url=post.image_url,
        author_id=post.author_id,
        created_at=post.created_at,
        updated_at=post.updated_at,
        likes_count=len(post.likes) if post.likes else 0,
        comments_count=len(post.comments) if post.comments else 0,
        author=UserBrief(
            id=post.author.id,
            username=post.author.username,
            display_name=post.author.display_name,
            avatar_url=post.author.avatar_url,
        ),
        is_liked=is_liked,
    )


@router.get("", response_model=PostListResponse)
async def get_posts(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Posts per page"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Get paginated feed of posts (newest first)"""
    # Calculate offset
    offset = (page - 1) * page_size

    # Get total count
    total = db.query(func.count(Post.id)).scalar() or 0

    # Get posts with eager loading to avoid N+1 queries
    posts = (
        db.query(Post)
        .options(
            joinedload(Post.author),
            joinedload(Post.likes),
            joinedload(Post.comments),
        )
        .order_by(desc(Post.created_at))
        .offset(offset)
        .limit(page_size)
        .all()
    )

    # Convert to response
    current_user_id = current_user.id if current_user else None
    post_responses = [post_to_response(post, current_user_id) for post in posts]

    return PostListResponse(
        posts=post_responses,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(posts)) < total,
    )


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Get a single post by ID"""
    post = (
        db.query(Post)
        .options(
            joinedload(Post.author),
            joinedload(Post.likes),
            joinedload(Post.comments),
        )
        .filter(Post.id == post_id)
        .first()
    )

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    current_user_id = current_user.id if current_user else None
    return post_to_response(post, current_user_id)


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_post(
    request: Request,
    content: str = Form(..., min_length=1, max_length=500),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new post with optional image (rate limited: 10/minute)"""
    # Upload image if provided
    image_url = None
    if image and image.filename:
        image_url = await file_upload_service.upload_image(image)

    # Create post
    post = Post(
        content=content,
        image_url=image_url,
        author_id=current_user.id,
    )

    db.add(post)
    db.commit()
    db.refresh(post)

    # Load relationships for response
    post = (
        db.query(Post)
        .options(
            joinedload(Post.author),
            joinedload(Post.likes),
            joinedload(Post.comments),
        )
        .filter(Post.id == post.id)
        .first()
    )

    response = post_to_response(post, current_user.id)

    # Broadcast new post via WebSocket
    await manager.broadcast_new_post(response.model_dump(mode="json"))

    return response


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: int,
    content: str = Form(..., min_length=1, max_length=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a post (only content, not image)"""
    post = db.query(Post).filter(Post.id == post_id).first()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    if post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own posts",
        )

    # Update content
    post.content = content

    db.commit()
    db.refresh(post)

    # Load relationships for response
    post = (
        db.query(Post)
        .options(
            joinedload(Post.author),
            joinedload(Post.likes),
            joinedload(Post.comments),
        )
        .filter(Post.id == post.id)
        .first()
    )

    return post_to_response(post, current_user.id)


@router.delete("/{post_id}", response_model=MessageResponse)
async def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a post"""
    post = db.query(Post).filter(Post.id == post_id).first()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    if post.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own posts",
        )

    # Delete associated image if exists
    if post.image_url:
        file_upload_service.delete_image(post.image_url)

    db.delete(post)
    db.commit()

    # Broadcast deletion via WebSocket
    await manager.broadcast_post_deleted(post_id)

    return MessageResponse(message="Post deleted successfully")


@router.get("/user/{user_id}", response_model=PostListResponse)
async def get_user_posts(
    user_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Get posts by a specific user"""
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    offset = (page - 1) * page_size

    # Get total count for this user
    total = (
        db.query(func.count(Post.id)).filter(Post.author_id == user_id).scalar() or 0
    )

    # Get posts with eager loading
    posts = (
        db.query(Post)
        .options(
            joinedload(Post.author),
            joinedload(Post.likes),
            joinedload(Post.comments),
        )
        .filter(Post.author_id == user_id)
        .order_by(desc(Post.created_at))
        .offset(offset)
        .limit(page_size)
        .all()
    )

    current_user_id = current_user.id if current_user else None
    post_responses = [post_to_response(post, current_user_id) for post in posts]

    return PostListResponse(
        posts=post_responses,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(posts)) < total,
    )
