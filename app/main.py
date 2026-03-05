"""
FastAPI application entry point.
Test Case Generator API - converts Jira data to test cases using AI.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core import settings
from app.api import auth, jira, sheets, generate

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    logger.info(f"Starting {settings.APP_NAME}...")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}...")


app = FastAPI(
    title=settings.APP_NAME,
    description="API for generating test cases from Jira using AI and writing to Google Sheets",
    version="1.0.0",
    lifespan=lifespan,
)

# Build allowed origins list
allowed_origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
# Remove duplicates and empty strings
allowed_origins = list(set(filter(None, allowed_origins)))

# CORS middleware for frontend communication (added first, runs after session)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session middleware for OAuth state management (added second, runs first)
# Use https_only in production (when not in DEBUG mode)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY,
    session_cookie=settings.SESSION_COOKIE_NAME,
    max_age=settings.SESSION_MAX_AGE,
    same_site="none" if not settings.DEBUG else "lax",
    https_only=not settings.DEBUG,
)

# Include API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(jira.router, prefix="/api/jira", tags=["Jira"])
app.include_router(sheets.router, prefix="/api/sheets", tags=["Google Sheets"])
app.include_router(generate.router, prefix="/api/generate", tags=["Generation"])


@app.get("/")
async def root():
    """Root endpoint - API health check."""
    return {
        "name": settings.APP_NAME,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
