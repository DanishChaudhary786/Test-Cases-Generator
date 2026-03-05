"""Core module - configuration, constants, and endpoints."""

from .config import settings, get_settings
from .constants import (
    GOOGLE_SCOPES,
    ATLASSIAN_SCOPES,
    DEFAULT_SHEET_COLUMNS,
    MAX_CUSTOM_COLUMNS,
    SPECIAL_COLUMNS,
    AI_PROVIDERS,
    DEFAULT_AI_MODELS,
    GenerationStatus,
    # AI Prompts
    SYSTEM_PROMPT,
    REVIEW_PROMPT,
    CONTEXT_FOOTER,
    TOOL_DESCRIPTION,
    TOOL_NAME_FIELD_DESCRIPTION,
)
from .endpoints import (
    # External API URLs
    GOOGLE_AUTH_URL,
    GOOGLE_TOKEN_URL,
    GOOGLE_USERINFO_URL,
    GOOGLE_SHEETS_BASE_URL,
    ATLASSIAN_AUTH_URL,
    ATLASSIAN_TOKEN_URL,
    ATLASSIAN_RESOURCES_URL,
    ATLASSIAN_API_BASE,
    # URL builders
    get_jira_api_url,
    get_jira_agile_url,
    get_jira_user_url,
    get_sheet_url,
    # Internal route classes
    AuthRoutes,
    JiraRoutes,
    SheetsRoutes,
    GenerateRoutes,
)

__all__ = [
    # Config
    "settings",
    "get_settings",
    # Constants
    "GOOGLE_SCOPES",
    "ATLASSIAN_SCOPES",
    "DEFAULT_SHEET_COLUMNS",
    "MAX_CUSTOM_COLUMNS",
    "SPECIAL_COLUMNS",
    "AI_PROVIDERS",
    "DEFAULT_AI_MODELS",
    "GenerationStatus",
    # AI Prompts
    "SYSTEM_PROMPT",
    "REVIEW_PROMPT",
    "CONTEXT_FOOTER",
    "TOOL_DESCRIPTION",
    "TOOL_NAME_FIELD_DESCRIPTION",
    # External Endpoints
    "GOOGLE_AUTH_URL",
    "GOOGLE_TOKEN_URL",
    "GOOGLE_USERINFO_URL",
    "GOOGLE_SHEETS_BASE_URL",
    "ATLASSIAN_AUTH_URL",
    "ATLASSIAN_TOKEN_URL",
    "ATLASSIAN_RESOURCES_URL",
    "ATLASSIAN_API_BASE",
    # URL builders
    "get_jira_api_url",
    "get_jira_agile_url",
    "get_jira_user_url",
    "get_sheet_url",
    # Internal Routes
    "AuthRoutes",
    "JiraRoutes",
    "SheetsRoutes",
    "GenerateRoutes",
]
