from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    comments = relationship(
        "Comment", back_populates="author", cascade="all, delete-orphan"
    )
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=True)
    author_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    author = relationship("User", back_populates="posts")
    comments = relationship(
        "Comment", back_populates="post", cascade="all, delete-orphan"
    )
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")

    # Composite index for efficient user posts queries (newest first)
    __table_args__ = (Index("ix_posts_author_created", "author_id", "created_at"),)

    @property
    def likes_count(self):
        return len(self.likes) if self.likes else 0

    @property
    def comments_count(self):
        return len(self.comments) if self.comments else 0

    def __repr__(self):
        return f"<Post(id={self.id}, author_id={self.author_id})>"


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    author_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    post_id = Column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    author = relationship("User", back_populates="comments")
    post = relationship("Post", back_populates="comments")

    # Composite index for efficient post comments queries (oldest first)
    __table_args__ = (Index("ix_comments_post_created", "post_id", "created_at"),)

    def __repr__(self):
        return f"<Comment(id={self.id}, author_id={self.author_id}, post_id={self.post_id})>"


class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    post_id = Column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="likes")
    post = relationship("Post", back_populates="likes")

    # Ensure a user can only like a post once + index for fast lookups
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="unique_user_post_like"),
        Index("ix_likes_post_user", "post_id", "user_id"),
    )

    def __repr__(self):
        return f"<Like(id={self.id}, user_id={self.user_id}, post_id={self.post_id})>"
