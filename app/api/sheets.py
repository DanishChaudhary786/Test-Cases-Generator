"""
Google Sheets API endpoints.
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import List, Optional

from app.services.sheets_service import SheetsService
from app.core.endpoints import SheetsRoutes, get_sheet_url
from app.core.token_store import get_tokens

router = APIRouter()

SESSION_ID_KEY = "sid"


class CreateSubsheetRequest(BaseModel):
    """Request body for creating a new subsheet."""
    name: str


def get_session_id(request: Request, x_session_id: Optional[str] = Header(None)) -> Optional[str]:
    """Get session ID from header or session cookie."""
    if x_session_id:
        return x_session_id
    return request.session.get(SESSION_ID_KEY)


async def get_sheets_service(request: Request, x_session_id: Optional[str] = Header(None)) -> SheetsService:
    """Dependency to get authenticated SheetsService."""
    session_id = get_session_id(request, x_session_id)
    google_tokens = get_tokens(session_id, "google") if session_id else None
    
    if not google_tokens or not google_tokens.get("access_token"):
        raise HTTPException(
            status_code=401,
            detail="Not authenticated with Google. Please sign in first."
        )
    
    return SheetsService(
        access_token=google_tokens["access_token"],
        refresh_token=google_tokens.get("refresh_token"),
    )


@router.get(SheetsRoutes.LIST)
async def list_sheets(
    request: Request,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """List all Google Sheets accessible to the authenticated user."""
    try:
        spreadsheets = sheets.list_spreadsheets()
        return {"sheets": spreadsheets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(SheetsRoutes.SUBSHEETS)
async def get_subsheets(
    request: Request,
    sheet_id: str,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Get all subsheets (tabs) for a specific sheet."""
    try:
        subsheets = sheets.get_subsheets(sheet_id)
        return {"subsheets": subsheets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(SheetsRoutes.SUBSHEETS)
async def create_subsheet(
    request: Request,
    sheet_id: str,
    body: CreateSubsheetRequest,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Create a new subsheet (tab) in the specified sheet."""
    try:
        result = sheets.create_subsheet(sheet_id, body.name)
        return {"subsheet": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(SheetsRoutes.INFO)
async def get_sheet_info(
    request: Request,
    sheet_id: str,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Get information about a specific sheet including subsheets."""
    try:
        subsheets = sheets.get_subsheets(sheet_id)
        return {
            "id": sheet_id,
            "subsheets": subsheets,
            "url": get_sheet_url(sheet_id),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
