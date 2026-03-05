"""
Configuration settings for the FastAPI backend.
Uses Pydantic Settings for environment variable management.
"""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # App settings
    APP_NAME: str = "Test Case Generator API"
    DEBUG: bool = False
    SECRET_KEY: str = "change-this-in-production-use-openssl-rand-hex-32"
    
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    
    # Google OAuth settings
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"
    
    # Atlassian OAuth settings
    ATLASSIAN_CLIENT_ID: str = ""
    ATLASSIAN_CLIENT_SECRET: str = ""
    ATLASSIAN_REDIRECT_URI: str = "http://localhost:8000/api/auth/atlassian/callback"
    
    # AI Provider API Keys (optional - can be provided per request)
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    GOOGLE_AI_API_KEY: Optional[str] = None
    
    # Session settings
    SESSION_COOKIE_NAME: str = "testcase_session"
    SESSION_MAX_AGE: int = 86400  # 24 hours
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # Ignore old/unknown env variables


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
