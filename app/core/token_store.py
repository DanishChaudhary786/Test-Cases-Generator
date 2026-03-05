"""
In-memory token store for OAuth tokens.
Session cookies have size limits (~4KB), so we store tokens server-side.
"""

from typing import Dict, Optional
import secrets

# In-memory store (in production, use Redis or similar)
_token_store: Dict[str, Dict] = {}


def create_session_id() -> str:
    """Generate a unique session ID."""
    return secrets.token_urlsafe(32)


def store_tokens(session_id: str, provider: str, tokens: Dict) -> None:
    """Store tokens for a session."""
    if session_id not in _token_store:
        _token_store[session_id] = {}
    _token_store[session_id][provider] = tokens


def get_tokens(session_id: str, provider: str) -> Optional[Dict]:
    """Get tokens for a session."""
    if session_id in _token_store and provider in _token_store[session_id]:
        return _token_store[session_id][provider]
    return None


def clear_tokens(session_id: str, provider: Optional[str] = None) -> None:
    """Clear tokens for a session."""
    if session_id in _token_store:
        if provider:
            _token_store[session_id].pop(provider, None)
        else:
            del _token_store[session_id]


def get_all_sessions() -> Dict:
    """Get all sessions (for debugging)."""
    return _token_store
