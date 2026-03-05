#!/usr/bin/env python3
"""
Test Case Generator API - Entry Point

Run with:
    python main.pyFacing issue even after signin, it's not sign in JIRA13:36I can see you've uploaded a video file (recording.webm), but I need to watch it to understand the issue you're facing with JIRA sign-in. Let me take a look at it.Viewed 4 files, ran 2 commandsViewed 4 files, ran 2 commandsI can clearly see the issue now. Here's what's happening in the recording:
The Problem: After successfully signing in with Atlassian (the toast shows ✅ "Successfully signed in with Atlassian!"), the Atlassian Account card does not update to show "Connected" — it still shows the "Sign In" button, and the "Continue to Jira Setup" button remains disabled/greyed out.
This is a UI state sync bug. The OAuth callback is completing successfully, but the frontend isn't re-fetching or updating the connection status after the popup/redirect returns.
Likely Root Causes:

Missing state refresh after OAuth callback — The success toast fires, but the component isn't re-checking the auth status from the backend. The Google account card shows "Connected" correctly, meaning the Atlassian one just isn't being refreshed post-OAuth.
OAuth popup vs. redirect — If the sign-in opens in a new tab/popup, the parent window may not be listening for the callback to update its state (missing postMessage listener or window.focus event handler).
The "Continue" button condition — It likely checks for both accounts being in a connected: true state, but the Atlassian status isn't being set after OAuth completes.

Fix to look for in your code:

After the Atlassian OAuth redirect/popup returns, trigger a re-fetch of the auth/connection status
Make sure the isConnected state for Atlassian is updated when the success callback fires — not just the toast
If using a popup, add a window.addEventListener('message', ...) to catch the OAuth result and refresh state

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
