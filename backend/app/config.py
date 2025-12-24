from functools import lru_cache
from typing import List, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:postgres@db:5432/twitter_lite"

    # JWT
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # App
    app_name: str = "Twitter Lite"
    debug: bool = True

    # File uploads
    upload_dir: str = "/app/uploads"
    max_file_size: int = 5 * 1024 * 1024  # 5MB
    allowed_extensions: set = {"jpg", "jpeg", "png", "gif", "webp"}

    # Rate limiting
    rate_limit_posts: str = "10/minute"
    rate_limit_comments: str = "30/minute"
    rate_limit_likes: str = "60/minute"

    # CORS - can be a list or a JSON string
    cors_origins: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:80",
        "http://localhost",
        "http://frontend:80",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list"""
        if isinstance(v, str):
            # Try to parse as JSON
            import json

            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass

            # Try comma-separated
            if "," in v:
                return [origin.strip() for origin in v.split(",") if origin.strip()]

            # Single origin
            return [v] if v else []

        return v if v else []

    @field_validator("allowed_extensions", mode="before")
    @classmethod
    def parse_allowed_extensions(cls, v):
        """Parse allowed extensions from string or set"""
        if isinstance(v, str):
            return set(ext.strip().lower() for ext in v.split(",") if ext.strip())
        if isinstance(v, list):
            return set(v)
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra environment variables
        case_sensitive = False  # Allow case-insensitive env vars


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
