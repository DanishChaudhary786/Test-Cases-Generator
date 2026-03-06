"""
OAuth authentication endpoints for Google and Atlassian.
"""

import secrets
from urllib.parse import urlencode
from fastapi import APIRouter, Request, HTTPException, Header
from fastapi.responses import RedirectResponse
import httpx
from typing import Optional

from app.core import settings, GOOGLE_SCOPES, ATLASSIAN_SCOPES
from app.core.endpoints import (
    GOOGLE_AUTH_URL,
    GOOGLE_TOKEN_URL,
    GOOGLE_USERINFO_URL,
    ATLASSIAN_AUTH_URL,
    ATLASSIAN_TOKEN_URL,
    ATLASSIAN_RESOURCES_URL,
    AuthRoutes,
    get_jira_user_url,
)
from app.core.token_store import (
    store_tokens, get_tokens, clear_tokens, create_session_id,
    store_oauth_state, get_session_for_state
)

router = APIRouter()

SESSION_ID_HEADER = "X-Session-ID"


def get_session_id(request: Request, x_session_id: Optional[str] = Header(None)) -> Optional[str]:
    """Get session ID from header or session cookie."""
    if x_session_id:
        return x_session_id
    return request.session.get("sid")


# ─────────────────────────────────────────────────────────────────────
# Google OAuth
# ─────────────────────────────────────────────────────────────────────

@router.get(AuthRoutes.GOOGLE)
async def google_auth(request: Request, sid: Optional[str] = None, x_session_id: Optional[str] = Header(None)):
    """Initiate Google OAuth flow."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    # Get or create session ID (prefer query param for browser redirects)
    session_id = sid or get_session_id(request, x_session_id)
    if not session_id:
        session_id = create_session_id()
    
    # Generate state and store it server-side with session ID
    state = secrets.token_urlsafe(32)
    store_oauth_state(state, session_id)
    
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get(AuthRoutes.GOOGLE_CALLBACK)
async def google_callback(request: Request, code: str = None, state: str = None, error: str = None):
    """Handle Google OAuth callback."""
    if error:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error={error}&provider=google"
        )
    
    # Verify state and get session ID from server-side store
    if not state:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error=no_state&provider=google"
        )
    
    session_id = get_session_for_state(state)
    if not session_id:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error=invalid_state&provider=google"
        )
    
    if not code:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error=no_code&provider=google"
        )
    
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            },
        )
        
        if token_response.status_code != 200:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}?error=token_exchange_failed&provider=google"
            )
        
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        
        # Get user info
        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        
        if userinfo_response.status_code != 200:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}?error=userinfo_failed&provider=google"
            )
        
        userinfo = userinfo_response.json()
    
    # Store tokens in server-side token store
    store_tokens(session_id, "google", {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "email": userinfo.get("email"),
        "name": userinfo.get("name"),
    })
    
    print(f"[DEBUG] Google callback - session_id: {session_id}")
    
    # Redirect with session_id in URL so frontend can store it
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}?success=google&sid={session_id}",
        status_code=303
    )


# ─────────────────────────────────────────────────────────────────────
# Atlassian OAuth
# ─────────────────────────────────────────────────────────────────────

@router.get(AuthRoutes.ATLASSIAN)
async def atlassian_auth(request: Request, sid: Optional[str] = None, x_session_id: Optional[str] = Header(None)):
    """Initiate Atlassian OAuth flow."""
    if not settings.ATLASSIAN_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Atlassian OAuth not configured")
    
    # Get or create session ID (prefer query param for browser redirects)
    session_id = sid or get_session_id(request, x_session_id)
    if not session_id:
        session_id = create_session_id()
    
    # Generate state and store it server-side with session ID
    state = secrets.token_urlsafe(32)
    store_oauth_state(state, session_id)
    
    params = {
        "audience": "api.atlassian.com",
        "client_id": settings.ATLASSIAN_CLIENT_ID,
        "scope": " ".join(ATLASSIAN_SCOPES),
        "redirect_uri": settings.ATLASSIAN_REDIRECT_URI,
        "state": state,
        "response_type": "code",
        "prompt": "consent",
    }
    
    auth_url = f"{ATLASSIAN_AUTH_URL}?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get(AuthRoutes.ATLASSIAN_CALLBACK)
async def atlassian_callback(request: Request, code: str = None, state: str = None, error: str = None):
    """Handle Atlassian OAuth callback."""
    if error:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error={error}&provider=atlassian"
        )
    
    # Verify state and get session ID from server-side store
    if not state:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error=no_state&provider=atlassian"
        )
    
    session_id = get_session_for_state(state)
    if not session_id:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error=invalid_state&provider=atlassian"
        )
    
    if not code:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}?error=no_code&provider=atlassian"
        )
    
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            ATLASSIAN_TOKEN_URL,
            json={
                "grant_type": "authorization_code",
                "client_id": settings.ATLASSIAN_CLIENT_ID,
                "client_secret": settings.ATLASSIAN_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.ATLASSIAN_REDIRECT_URI,
            },
            headers={"Content-Type": "application/json"},
        )
        
        if token_response.status_code != 200:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}?error=token_exchange_failed&provider=atlassian"
            )
        
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        
        # Get accessible resources (Jira cloud instances)
        resources_response = await client.get(
            ATLASSIAN_RESOURCES_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        
        if resources_response.status_code != 200:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}?error=resources_failed&provider=atlassian"
            )
        
        resources = resources_response.json()
        
        if not resources:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}?error=no_jira_access&provider=atlassian"
            )
        
        # Use the first accessible resource (Jira instance)
        cloud_id = resources[0].get("id")
        site_name = resources[0].get("name")
        site_url = resources[0].get("url")
        
        # Get user info from Jira
        me_response = await client.get(
            get_jira_user_url(cloud_id),
            headers={"Authorization": f"Bearer {access_token}"},
        )
        
        email = None
        display_name = None
        if me_response.status_code == 200:
            me_data = me_response.json()
            email = me_data.get("emailAddress")
            display_name = me_data.get("displayName")
    
    # Store tokens in server-side token store
    store_tokens(session_id, "atlassian", {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "cloud_id": cloud_id,
        "site_name": site_name,
        "site_url": site_url,
        "email": email,
        "name": display_name,
    })
    
    print(f"[DEBUG] Atlassian callback - stored in token store:")
    print(f"  - session_id: {session_id}")
    print(f"  - cloud_id: {cloud_id}")
    print(f"  - site_name: {site_name}")
    print(f"  - email: {email}")
    
    # Redirect with session_id in URL so frontend can store it
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}?success=atlassian&sid={session_id}",
        status_code=303
    )


# ─────────────────────────────────────────────────────────────────────
# Auth Status & Logout
# ─────────────────────────────────────────────────────────────────────

@router.get(AuthRoutes.STATUS)
async def auth_status(request: Request, x_session_id: Optional[str] = Header(None)):
    """Check authentication status for both providers."""
    session_id = get_session_id(request, x_session_id)
    
    # Debug: print session info
    print(f"[DEBUG] Auth status - Session ID: {session_id}")
    
    google_tokens = get_tokens(session_id, "google") if session_id else None
    atlassian_tokens = get_tokens(session_id, "atlassian") if session_id else None
    
    print(f"[DEBUG] Google tokens exist: {google_tokens is not None}")
    print(f"[DEBUG] Atlassian tokens exist: {atlassian_tokens is not None}")
    
    return {
        "google": {
            "authenticated": google_tokens is not None,
            "email": google_tokens.get("email") if google_tokens else None,
            "name": google_tokens.get("name") if google_tokens else None,
        },
        "atlassian": {
            "authenticated": atlassian_tokens is not None,
            "email": atlassian_tokens.get("email") if atlassian_tokens else None,
            "name": atlassian_tokens.get("name") if atlassian_tokens else None,
            "siteName": atlassian_tokens.get("site_name") if atlassian_tokens else None,
            "siteUrl": atlassian_tokens.get("site_url") if atlassian_tokens else None,
        },
    }


@router.post(AuthRoutes.LOGOUT)
async def logout(request: Request, provider: str = None, x_session_id: Optional[str] = Header(None)):
    """Clear authentication tokens."""
    session_id = get_session_id(request, x_session_id)
    
    if session_id:
        if provider == "google":
            clear_tokens(session_id, "google")
        elif provider == "atlassian":
            clear_tokens(session_id, "atlassian")
        else:
            clear_tokens(session_id)
            request.session.clear()
    
    return {"message": f"Logged out {'from ' + provider if provider else 'successfully'}"}


@router.get(AuthRoutes.GOOGLE_TOKEN)
async def get_google_token(request: Request, x_session_id: Optional[str] = Header(None)):
    """Get current Google access token (for debugging/internal use)."""
    session_id = get_session_id(request, x_session_id)
    google_tokens = get_tokens(session_id, "google") if session_id else None
    
    if not google_tokens or not google_tokens.get("access_token"):
        raise HTTPException(status_code=401, detail="Not authenticated with Google")
    return {"token": google_tokens["access_token"]}


@router.get(AuthRoutes.ATLASSIAN_TOKEN)
async def get_atlassian_token(request: Request, x_session_id: Optional[str] = Header(None)):
    """Get current Atlassian access token and cloud ID."""
    session_id = get_session_id(request, x_session_id)
    atlassian_tokens = get_tokens(session_id, "atlassian") if session_id else None
    
    if not atlassian_tokens or not atlassian_tokens.get("access_token"):
        raise HTTPException(status_code=401, detail="Not authenticated with Atlassian")
    return {
        "token": atlassian_tokens["access_token"],
        "cloudId": atlassian_tokens.get("cloud_id"),
    }
