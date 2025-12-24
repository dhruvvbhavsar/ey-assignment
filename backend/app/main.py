import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import auth, comments, likes, posts, websocket
from app.seed import seed_database

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events"""
    # Startup
    print("Starting up Twitter Lite API...")

    # Create database tables
    Base.metadata.create_all(bind=engine)
    print("Database tables created/verified")

    # Seed demo data if database is empty
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()

    # Ensure upload directory exists
    upload_path = Path(settings.upload_dir)
    upload_path.mkdir(parents=True, exist_ok=True)
    print(f"Upload directory ready: {upload_path}")

    # Mount static files for uploads AFTER directory is created
    app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")
    print("Static file serving enabled for uploads")

    yield

    # Shutdown
    print("Shutting down Twitter Lite API...")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="A Twitter-like social feed API with posts, comments, likes, and real-time updates",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Add rate limiter to app state
app.state.limiter = limiter

# Add rate limit exceeded handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add SlowAPI middleware for rate limiting
app.add_middleware(SlowAPIMiddleware)

# CORS middleware - settings.cors_origins is already validated as a list
cors_origins = (
    settings.cors_origins
    if isinstance(settings.cors_origins, list)
    else [settings.cors_origins]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions"""
    # Log the error for debugging
    print(f"Unhandled exception on {request.method} {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred"},
    )


# Include routers
app.include_router(auth.router)
app.include_router(posts.router, prefix="/api")
app.include_router(comments.router, prefix="/api")
app.include_router(likes.router, prefix="/api")
app.include_router(websocket.router)


# Health check endpoint
@app.get("/api/health", tags=["Health"])
async def health_check():
    """Health check endpoint for container orchestration"""
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": "1.0.0",
    }


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information"""
    return {
        "message": f"Welcome to {settings.app_name} API",
        "docs": "/api/docs",
        "health": "/api/health",
    }


# Rate limited test endpoint
@app.get("/api/rate-limit-test", tags=["Testing"])
@limiter.limit("5/minute")
async def rate_limit_test(request: Request):
    """Test endpoint for rate limiting (5 requests per minute)"""
    return {"message": "Rate limit test successful"}
