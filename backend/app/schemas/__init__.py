from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# ============ User Schemas ============
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    id: int
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserBrief(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


# ============ Token Schemas ============
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
    username: Optional[str] = None


# ============ Post Schemas ============
class PostBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)


class PostCreate(PostBase):
    pass


class PostUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1, max_length=500)


class PostResponse(PostBase):
    id: int
    image_url: Optional[str] = None
    author_id: int
    created_at: datetime
    updated_at: datetime
    likes_count: int = 0
    comments_count: int = 0
    author: UserBrief
    is_liked: bool = False

    class Config:
        from_attributes = True


class PostListResponse(BaseModel):
    posts: list[PostResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


# ============ Comment Schemas ============
class CommentBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=300)


class CommentCreate(CommentBase):
    pass


class CommentUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1, max_length=300)


class CommentResponse(CommentBase):
    id: int
    author_id: int
    post_id: int
    created_at: datetime
    updated_at: datetime
    author: UserBrief

    class Config:
        from_attributes = True


class CommentListResponse(BaseModel):
    comments: list[CommentResponse]
    total: int


# ============ Like Schemas ============
class LikeResponse(BaseModel):
    id: int
    user_id: int
    post_id: int
    created_at: datetime
    user: UserBrief

    class Config:
        from_attributes = True


class LikeStatusResponse(BaseModel):
    is_liked: bool
    likes_count: int


# ============ WebSocket Schemas ============
class WSMessage(BaseModel):
    type: str  # "new_post", "new_comment", "new_like", "unlike"
    data: dict


class WSNewPost(BaseModel):
    type: str = "new_post"
    post: PostResponse


class WSNewComment(BaseModel):
    type: str = "new_comment"
    comment: CommentResponse
    post_id: int


class WSLikeUpdate(BaseModel):
    type: str  # "new_like" or "unlike"
    post_id: int
    likes_count: int
    user: UserBrief


# ============ General Response Schemas ============
class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    detail: str
