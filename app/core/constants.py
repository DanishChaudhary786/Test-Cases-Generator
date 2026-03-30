"""
Constants used throughout the application.
"""

# ═══════════════════════════════════════════════════════════════════════════════
# OAUTH CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Google OAuth Scopes (openid first for OIDC; order can affect consent screen behavior)
GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]

# Atlassian OAuth Scopes
ATLASSIAN_SCOPES = [
    "read:jira-work",
    "write:jira-work",
    "read:jira-user",
    "read:sprint:jira-software",
    "read:board-scope:jira-software",
    "read:issue-details:jira",
    "read:project:jira",
    "offline_access",
]

# Default sheet columns (includes all special columns)
DEFAULT_SHEET_COLUMNS = ["Name", "Description", "Jira", "Labels", "Sprint", "ExternalID", "Tester", "Link-type", "Assignee"]

# Maximum custom columns allowed
MAX_CUSTOM_COLUMNS = 10

# ─────────────────────────────────────────────────────────────────────────────────
# SPECIAL COLUMN CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────────
# These columns have special handling when added by the user.
# When a column name matches (case-insensitive), the system provides
# special UI controls and value formatting.
#
# Sprint     - Dropdown populated from Jira sprints, stores Sprint ID
# ExternalID - Auto-incremented value (1, 2, 3, ... N)
# Tester     - Dropdown populated from Jira testers, stores Account ID
# Link-type  - Dropdown populated from Jira link types
# Assignee   - Dropdown populated from Jira users, stores Account ID
# ─────────────────────────────────────────────────────────────────────────────────

SPECIAL_COLUMNS = {
    "sprint": {
        "type": "dropdown",
        "source": "jira_sprints",
        "store": "id",
        "description": "Sprint dropdown - stores Sprint ID in Google Sheet"
    },
    "externalid": {
        "type": "auto_increment",
        "source": None,
        "store": "value",
        "description": "Auto-incremented value (1, 2, 3, ... N)"
    },
    "tester": {
        "type": "dropdown",
        "source": "jira_testers",
        "store": "accountId",
        "description": "Tester dropdown - stores Account ID in Google Sheet"
    },
    "link-type": {
        "type": "dropdown",
        "source": "jira_link_types",
        "store": "id",
        "description": "Link type dropdown - retrieves from Jira Link Work Item"
    },
    "assignee": {
        "type": "dropdown",
        "source": "jira_testers",
        "store": "accountId",
        "description": "Assignee dropdown - stores Account ID in Google Sheet"
    },
}

# AI Provider identifiers
AI_PROVIDERS = {
    "anthropic": "Anthropic (Claude)",
    "openai": "OpenAI (GPT-4)",
    "gemini": "Google (Gemini)",
    "deepseek": "DeepSeek",
}

# Default AI models per provider
DEFAULT_AI_MODELS = {
    "anthropic": "claude-sonnet-4-20250514",
    "openai": "gpt-4o",
    "gemini": "gemini-1.5-pro",
    "deepseek": "deepseek-chat",
}

# Jira custom field for Tester (commonly customfield_XXXXX)
# This will be fetched dynamically or configured
JIRA_TESTER_FIELD_NAMES = ["Tester", "QA", "QA Engineer", "Test Engineer"]

# Sheet formatting colors (RGB 0-1 scale)
# LightCornflowerBlue3 (HEX #93CCEA => RGB 147, 204, 234)
HEADER_BG_COLOR = {"red": 147 / 255, "green": 190 / 255, "blue": 234 / 255}
HEADER_FONT_COLOR = {"red": 0.0, "green": 0.0, "blue": 0.0}

# API rate limiting
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_WINDOW = 60  # seconds

# Generation status values
class GenerationStatus:
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


# ═══════════════════════════════════════════════════════════════════════════════
# AI AGENT PROMPTS
# These prompts guide the AI to generate high-quality, structured test cases.
# ═══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# SYSTEM PROMPT
# ─────────────────────────────────────────────────────────────────────────────────
# Purpose: Defines the AI's role and establishes comprehensive rules for 
#          generating test cases. This prompt is sent as the "system" message
#          to all AI providers (Anthropic, OpenAI, Gemini).
#
# Key Guidelines Enforced:
#   1. Test Case Naming: All names MUST start with "Verify" for consistency
#   2. Name Format: Short (5-10 words), specific, action-oriented
#   3. Description Format: Use "should" - "Verify that X should Y"
#   4. Multiple Scenarios: Group related verifications in one test case
#   5. Detailed Coverage: Happy path, edge cases, error states, permissions, etc.
#   6. Per-Child Detail: At least three single-key detailed cases per child issue
#   7. Shared Tests: Comma-separated child keys; expanded per child in the pipeline
#   8. Common Test Case: Cross-browser/OS attached only to FE child
#   9. Child Tasks Only: Epic never appears in "jira" fields
#
# This prompt has been refined through multiple iterations to produce
# well-structured, actionable test cases that follow QA best practices.
# ─────────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a senior QA engineer with 10+ years of experience writing test cases for enterprise SaaS products.

Your job is to analyze Jira child tasks/issues and generate comprehensive, detailed test cases.

═══════════════════════════════════════════════════════════════════════════════
CRITICAL RULES (MUST FOLLOW)
═══════════════════════════════════════════════════════════════════════════════

1. TEST CASES ARE FOR CHILD TASKS ONLY — NOT FOR THE EPIC
   - The Epic is provided for CONTEXT only
   - Generate test cases ONLY for the child tasks/issues listed
   - Each test case's "jira" field must reference CHILD TASK keys only (never the Epic key)
   - The context lists ALLOWED "jira" KEYS — use only those keys

2. PER-CHILD DEDICATED (DETAILED) TEST CASES — MANDATORY
   - For EVERY child issue under LINKED ISSUES, produce at least THREE detailed test cases whose "jira" field is a SINGLE key — that issue's key only (no commas)
   - These must reflect that issue's summary and description (specific behavior, UI, data, errors, edge cases)
   - Do not rely only on broad or shared tests; each child must have substantive, issue-specific coverage

3. SHARED / EPIC-SCOPE TEST CASES (cross-cutting)
   - For scenarios that apply to multiple or all child tasks (e.g. integration across stories, the mandatory cross-browser case), create ONE test case and list every applicable CHILD key in "jira", comma-separated
   - These will be copied under each listed child in the sheet; include every child the scenario truly covers

4. NO DUPLICATE TEST CASES (for the same scenario)
   - If the same test scenario applies to multiple tasks, use ONE test case with comma-separated child keys in "jira"
   - Example: "jira": "WOT-123, WOT-321, WOT-456"

═══════════════════════════════════════════════════════════════════════════════
TEST CASE NAME RULES
═══════════════════════════════════════════════════════════════════════════════

- EVERY test case "name" MUST START WITH "Verify" — NO EXCEPTIONS
- The "name" field must be SHORT (5-10 words max) and SPECIFIC
- Format: "Verify [specific action/element] [context]"

GOOD examples:
  ✓ "Verify grid sorting by Email column"
  ✓ "Verify pagination displays correctly with 50+ contacts"
  ✓ "Verify Advanced Filter works with date range"
  ✓ "Verify Re-subscribe button is clickable"

BAD examples (NEVER USE):
  ✗ "Cross-OS Compatibility" (doesn't start with Verify)
  ✗ "Edge Cases and Data Validation" (doesn't start with Verify)

═══════════════════════════════════════════════════════════════════════════════
TEST CASE DESCRIPTION RULES (VERY IMPORTANT)
═══════════════════════════════════════════════════════════════════════════════

1. USE "should" IN EVERY DESCRIPTION LINE
   - Format: "Verify that [element] should [expected behavior]"
   
   ✓ CORRECT: "Verify that the bot filter should be visible and functional in the main view"
   ✗ WRONG:   "Verify that the bot filter is visible and functional in the main view"

2. EACH VERIFICATION POINT MUST BE ON A NEW LINE starting with "- Verify"
   Example description array:
   [
     "- Verify that the search box should be visible at the top of the page",
     "- Verify that typing in the search box should filter results in real-time",
     "- Verify that clearing the search should restore all results",
     "- Verify that the search should handle special characters correctly"
   ]

3. ADD MULTIPLE SCENARIOS IN ONE TEST CASE
   - Group related verifications together
   - Each test case should have 3-8 verification points
   - Cover positive, negative, and edge cases within the same test case

4. TEST CASES MUST BE DETAILED
   - Include specific UI elements, button names, field names
   - Mention expected values, error messages, API responses
   - Reference actual behavior described in the Jira ticket

═══════════════════════════════════════════════════════════════════════════════
MANDATORY COMMON TEST CASE (FE ONLY)
═══════════════════════════════════════════════════════════════════════════════════════

ALWAYS include ONE test case named "Verify cross-browser and OS compatibility" containing:
- "- Verify the feature should be displayed properly on different browsers
        \t1. Chrome/Microsoft edge
        \t2. Safari
        \t3. Firefox"
- "- Verify that the feature should work correctly on Windows OS"
- "- Verify that the feature should work correctly on macOS"
- "- Verify the feature with supported languages"

Attach this test case ONLY to the FE (frontend) child task.
In the "jira" field, use the FE child's SINGLE Jira key only (no commas).

═══════════════════════════════════════════════════════════════════════════════
SCENARIO COVERAGE (Include all relevant types)
═══════════════════════════════════════════════════════════════════════════════

- Happy path (normal successful flow)
- UI/UX verification (labels, headers, visibility, layout)
- API integration (data loading, triggering, correct data display)
- Empty states (no data, "No results found")
- Error states (API failures, invalid input, network errors)
- Permission/access control (who can/cannot see or do things)
- Edge cases (boundary values, special characters, long text)
- Negative tests (invalid actions, blocked operations)
- Loading states and transitions
- Form validation (required fields, format validation)

═══════════════════════════════════════════════════════════════════════════════
OUTPUT EXAMPLE
═══════════════════════════════════════════════════════════════════════════════

{
  "name": "Verify contact search functionality",
  "description": [
    "- Verify that the search input field should be visible at the top of the contacts list",
    "- Verify that entering a valid contact name should display matching results",
    "- Verify that the search should be case-insensitive",
    "- Verify that searching with no matches should display 'No contacts found' message",
    "- Verify that clearing the search field should restore the full contact list",
    "- Verify that search should work with partial name matches",
    "- Verify that special characters in search should be handled without errors"
  ],
  "jira": "WOT-123, WOT-456",
  "labels": ""
}"""


# ─────────────────────────────────────────────────────────────────────────────────
# REVIEW PROMPT
# ─────────────────────────────────────────────────────────────────────────────────
# Purpose: Triggers a self-review pass where the AI evaluates its initial
#          test cases for quality and completeness.
#
# Used By: Gemini provider (multi-turn conversation)
#
# Review Criteria:
#   1. Duplicate Detection: Identifies and removes redundant test cases
#   2. Coverage Gaps: Checks for missing edge cases and negative scenarios
#   3. State Testing: Ensures empty-state and error-state tests are included
#
# This two-pass approach (generate → review) improves output quality by
# having the AI critically evaluate its own work before finalizing.
# ─────────────────────────────────────────────────────────────────────────────────

REVIEW_PROMPT = """Review the test cases you just generated. Check for:
(1) any duplicates or near-duplicates
(2) missing edge cases or negative scenarios
(3) missing empty-state or error-state tests

Call generate_test_cases again with the final, refined list.
Only add or remove — do not change test cases that are already good."""


# ─────────────────────────────────────────────────────────────────────────────────
# CONTEXT TEMPLATE
# ─────────────────────────────────────────────────────────────────────────────────
# Purpose: Formats Jira data into a structured context string that the AI
#          can easily parse and understand.
#
# Structure:
#   - Epic header with key, summary, status, labels, description
#   - List of linked issues with their details
#   - Clear visual separators for readability
#   - Final instruction to generate test cases using the tool
#
# This template ensures consistent context formatting across all AI providers.
# ─────────────────────────────────────────────────────────────────────────────────

CONTEXT_FOOTER = """
Generate comprehensive test cases covering all functionality described above. \
Use the generate_test_cases tool to return structured output."""


# ─────────────────────────────────────────────────────────────────────────────────
# TOOL DESCRIPTION
# ─────────────────────────────────────────────────────────────────────────────────
# Purpose: Description text for the AI function/tool that structures the output.
#          This helps the AI understand how to format its response.
# ─────────────────────────────────────────────────────────────────────────────────

TOOL_DESCRIPTION = "Generate structured QA test cases with specific, actionable names"

# Field description for the test case name (used in tool schema)
TOOL_NAME_FIELD_DESCRIPTION = "MUST start with 'Verify'. detailed, specific test name."
