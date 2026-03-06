"""
API endpoints - External and Internal routes.
"""

# ═════════════════════════════════════════════════════════════════════
# EXTERNAL API ENDPOINTS (Third-party services)
# ═════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────
# Google OAuth Endpoints
# ─────────────────────────────────────────────────────────────────────
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_SHEETS_BASE_URL = "https://docs.google.com/spreadsheets/d"

# ─────────────────────────────────────────────────────────────────────
# Atlassian OAuth Endpoints
# ─────────────────────────────────────────────────────────────────────
ATLASSIAN_AUTH_URL = "https://auth.atlassian.com/authorize"
ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"

# ─────────────────────────────────────────────────────────────────────
# Atlassian/Jira API Base URLs
# ─────────────────────────────────────────────────────────────────────
ATLASSIAN_API_BASE = "https://api.atlassian.com"

def get_jira_api_url(cloud_id: str) -> str:
    """Get Jira REST API base URL for a specific cloud instance."""
    return f"{ATLASSIAN_API_BASE}/ex/jira/{cloud_id}/rest/api/3"

def get_jira_agile_url(cloud_id: str) -> str:
    """Get Jira Agile API base URL for a specific cloud instance."""
    return f"{ATLASSIAN_API_BASE}/ex/jira/{cloud_id}/rest/agile/1.0"

def get_jira_user_url(cloud_id: str) -> str:
    """Get Jira user info (myself) URL."""
    return f"{ATLASSIAN_API_BASE}/ex/jira/{cloud_id}/rest/api/3/myself"

def get_sheet_url(sheet_id: str, tab_id: int = None) -> str:
    """Get Google Sheet URL with optional tab/subsheet ID."""
    url = f"{GOOGLE_SHEETS_BASE_URL}/{sheet_id}"
    if tab_id is not None:
        url += f"#gid={tab_id}"
    return url


# ═════════════════════════════════════════════════════════════════════
# INTERNAL API ROUTES (Application routes)
# ═════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────
# Auth Routes
# ─────────────────────────────────────────────────────────────────────
class AuthRoutes:
    PREFIX = "/auth"
    GOOGLE = "/google"
    GOOGLE_CALLBACK = "/google/callback"
    ATLASSIAN = "/atlassian"
    ATLASSIAN_CALLBACK = "/atlassian/callback"
    STATUS = "/status"
    LOGOUT = "/logout"
    GOOGLE_TOKEN = "/google/token"
    ATLASSIAN_TOKEN = "/atlassian/token"

# ─────────────────────────────────────────────────────────────────────
# Jira Routes
# ─────────────────────────────────────────────────────────────────────
class JiraRoutes:
    PREFIX = "/jira"
    BOARDS = "/boards"
    SPRINTS = "/sprints"
    LABELS = "/labels"
    EPICS = "/epics"
    TASKS = "/tasks"
    TESTERS = "/testers"
    LINK_TYPES = "/link-types"
    USERS = "/users"
    ISSUE = "/issue/{issue_key}"
    EPIC_CHILDREN = "/epic/{epic_key}/children"

# ─────────────────────────────────────────────────────────────────────
# Sheets Routes
# ─────────────────────────────────────────────────────────────────────
class SheetsRoutes:
    PREFIX = "/sheets"
    LIST = "/list"
    SUBSHEETS = "/{sheet_id}/subsheets"
    INFO = "/{sheet_id}/info"

# ─────────────────────────────────────────────────────────────────────
# Generate Routes
# ─────────────────────────────────────────────────────────────────────
class GenerateRoutes:
    PREFIX = "/generate"
    ROOT = ""
    PROVIDERS = "/providers"
    STATUS = "/status/{job_id}"
    STREAM = "/stream/{job_id}"
    CANCEL = "/{job_id}"
