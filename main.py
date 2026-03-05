#!/usr/bin/env python3
"""
Test Case Generator API - Entry Point

Run with:
    python main.py

Or with uvicorn:
    uvicorn app.main:app --reload --port 8000
"""

import uvicorn
from app.core import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
