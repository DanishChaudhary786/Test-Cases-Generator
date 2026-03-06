/**
 * ═══════════════════════════════════════════════════════════════════════════
 * APPLICATION CONSTANTS
 * Central location for all UI text, labels, and configuration values.
 * This makes it easy to maintain consistency and update text across the app.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION CONFIG
// Core application settings and limits
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum number of columns allowed in sheet configuration */
export const MAX_COLUMNS = 10;

/** Default column names for new sheet configurations (includes all special columns) */
export const DEFAULT_COLUMNS = ['Name', 'Description', 'Jira', 'Labels', 'Sprint', 'ExternalID', 'Tester', 'Link-type', 'Assignee'];

/** 
 * Columns that are auto-populated by AI from Jira data.
 * Users cannot set default values for these columns.
 */
export const AI_POPULATED_COLUMNS = ['name', 'description', 'jira'];

// ─────────────────────────────────────────────────────────────────────────────
// SPECIAL COLUMN CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
// These columns have special handling when added by the user.
// When a column name matches (case-insensitive), the system provides
// special UI controls (dropdowns, auto-increment) instead of text input.
// ─────────────────────────────────────────────────────────────────────────────

export interface SpecialColumnConfig {
  /** Type of input control: dropdown or auto-increment */
  type: 'dropdown' | 'auto_increment';
  /** Data source for dropdown options */
  source: 'jira_sprints' | 'jira_testers' | 'jira_link_types' | 'jira_users' | null;
  /** Which field to store in Google Sheet */
  store: 'id' | 'accountId' | 'value';
  /** Human-readable description of the column */
  description: string;
}

/**
 * Special columns configuration.
 * When a user adds a column with one of these names (case-insensitive),
 * the system provides special UI controls and data handling.
 * 
 * Sprint     - Dropdown with sprints from Jira, stores Sprint ID
 * ExternalID - Auto-incremented value (1, 2, 3, ... N) for each test case
 * Tester     - Dropdown with testers from Jira, stores Account ID
 * Link-type  - Dropdown with link types from Jira Link Work Item
 * Assignee   - Dropdown with users from Jira, stores Account ID
 */
export const SPECIAL_COLUMNS: Record<string, SpecialColumnConfig> = {
  'sprint': {
    type: 'dropdown',
    source: 'jira_sprints',
    store: 'id',
    description: 'Sprint dropdown - stores Sprint ID in Google Sheet',
  },
  'externalid': {
    type: 'auto_increment',
    source: null,
    store: 'value',
    description: 'Auto-incremented value (1, 2, 3, ... N)',
  },
  'tester': {
    type: 'dropdown',
    source: 'jira_testers',
    store: 'accountId',
    description: 'Tester dropdown - stores Account ID in Google Sheet',
  },
  'link-type': {
    type: 'dropdown',
    source: 'jira_link_types',
    store: 'id',
    description: 'Link type dropdown - retrieves from Jira Link Work Item',
  },
  'assignee': {
    type: 'dropdown',
    source: 'jira_testers',
    store: 'accountId',
    description: 'Assignee dropdown - stores Account ID in Google Sheet',
  },
} as const;

/**
 * Check if a column name is a special column
 * @param columnName - The column name to check (case-insensitive)
 * @returns The special column config if found, undefined otherwise
 */
export const getSpecialColumnConfig = (columnName: string): SpecialColumnConfig | undefined => {
  return SPECIAL_COLUMNS[columnName.toLowerCase()];
};

// ─────────────────────────────────────────────────────────────────────────────
// AI PROVIDERS
// Available AI providers for test case generation
// ─────────────────────────────────────────────────────────────────────────────

export const AI_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)', description: 'Recommended' },
  { value: 'openai', label: 'OpenAI (GPT-4)' },
  { value: 'gemini', label: 'Google (Gemini)' },
  { value: 'deepseek', label: 'DeepSeek' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// STEP TITLES & DESCRIPTIONS
// Header text for each wizard step
// ─────────────────────────────────────────────────────────────────────────────

export const STEP_CONTENT = {
  /** Step 1: Authentication */
  AUTH: {
    TITLE: 'Sign in to Get Started',
    DESCRIPTION: 'We need access to your Google account for writing test cases to Google Sheets, and your Atlassian account for fetching Jira data.',
  },
  
  /** Step 2: Jira Configuration */
  JIRA: {
    TITLE: 'Configure Jira Source',
    DESCRIPTION: 'Select the sprint, labels, and epic to generate test cases from. Test cases will be created for the selected child tasks.',
  },
  
  /** Step 3: Google Sheet Configuration */
  SHEET: {
    TITLE: 'Configure Google Sheet',
    DESCRIPTION: 'Select where to write the generated test cases and customize the columns.',
  },
  
  /** Step 4: Test Case Generation */
  GENERATE: {
    TITLE: 'Generate Test Cases',
    DESCRIPTION: 'Configure AI provider and start generating test cases from your Jira data.',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// FORM LABELS
// Labels for form inputs and select dropdowns
// ─────────────────────────────────────────────────────────────────────────────

export const LABELS = {
  /** Authentication step labels */
  GOOGLE_ACCOUNT: 'Google Account',
  ATLASSIAN_ACCOUNT: 'Atlassian Account',
  
  /** Jira step labels */
  SPRINT: 'Sprint',
  LABELS: 'Labels',
  EPIC: 'Epic',
  TESTER: 'Tester (Optional)',
  CHILD_TASKS: 'Child Tasks',
  
  /** Sheet config step labels */
  GOOGLE_SHEET: 'Google Sheet',
  SUBSHEET_TAB: 'Subsheet (Tab)',
  CREATE_NEW_SUBSHEET: 'Create New Subsheet',
  COLUMN_CONFIGURATION: 'Column Configuration',
  
  /** Generate step labels */
  AI_PROVIDER: 'AI Provider',
  API_KEY: 'API Key (Optional)',
  GENERATION_SUMMARY: 'Generation Summary',
  GENERATION_LOG: 'Generation Log',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDERS
// Placeholder text for input fields and select dropdowns
// ─────────────────────────────────────────────────────────────────────────────

export const PLACEHOLDERS = {
  /** Select dropdown placeholders */
  SELECT_SHEET: 'Select a sheet...',
  SELECT_SUBSHEET: 'Select a subsheet...',
  SELECT_SPRINT: 'Select a sprint...',
  SELECT_LABELS: 'Select labels...',
  SELECT_EPIC: 'Select an epic...',
  SELECT_TESTER: 'Filter by tester...',
  
  /** Input field placeholders */
  ENTER_SUBSHEET_NAME: 'Enter subsheet name...',
  ENTER_DEFAULT_VALUE: 'Enter default value for all rows...',
  API_KEY_HINT: 'Uses server default if empty',
  COLUMN_PLACEHOLDER: (index: number) => `Column ${index + 1}`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON LABELS
// Text displayed on buttons throughout the application
// ─────────────────────────────────────────────────────────────────────────────

export const BUTTONS = {
  /** Navigation buttons */
  BACK: 'Back',
  CONTINUE_TO_JIRA: 'Continue to Jira Setup',
  CONTINUE_TO_SHEET: 'Continue to Sheet Config',
  CONTINUE_TO_GENERATE: 'Continue to Generate',
  
  /** Action buttons */
  SIGN_IN: 'Sign in',
  CREATE: 'Create',
  CANCEL: 'Cancel',
  NEW_TAB: 'New Tab',
  ADD_COLUMN: 'Add Column',
  RESET_TO_DEFAULT: 'Reset to Default',
  SELECT_ALL: 'Select All',
  DESELECT_ALL: 'Deselect All',
  LOAD_FILTERED_EPICS: 'Load Filtered Epics',
  LOAD_ALL_EPICS: 'Load All Epics',
  
  /** Generation buttons */
  START_GENERATION: 'Start Generation',
  GENERATING: 'Generating...',
  OPEN_SHEET: 'Open Sheet',
  GENERATE_AGAIN: 'Generate Again',
  TRY_AGAIN: 'Try Again',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TOOLTIPS
// Hover text for icons and interactive elements
// ─────────────────────────────────────────────────────────────────────────────

export const TOOLTIPS = {
  /** Column configuration tooltips */
  AI_POPULATED_COLUMN: 'This column is auto-populated by AI',
  ADD_DEFAULT_VALUE: 'Add default value',
  DEFAULT_VALUE_SET: (value: string) => `Default: ${value}`,
  CLEAR_DEFAULT_VALUE: 'Clear default value',
  
  /** Auth tooltips */
  SIGN_OUT: 'Sign out',
  
  /** Sheet config tooltips */
  COLUMN_MAX_REACHED: `Maximum ${MAX_COLUMNS} columns allowed`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// STATUS MESSAGES
// Text displayed for various states (loading, empty, connected, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS = {
  /** Connection status */
  CONNECTED: 'Connected',
  
  /** Auth descriptions */
  GOOGLE_REQUIRED: 'Required for Google Sheets access',
  ATLASSIAN_REQUIRED: 'Required for Jira access',
  
  /** Loading states */
  LOADING_TASKS: 'Loading tasks...',
  
  /** Empty states */
  NO_TASKS_FOUND: 'No tasks found for this epic',
  
  /** Selection states */
  TASKS_SELECTED: (count: number) => `${count} task${count > 1 ? 's' : ''} selected`,
  TEST_CASES_WILL_BE_WRITTEN: 'Test cases will be written to:',
  
  /** Column configuration */
  COLUMN_CONFIG_DESCRIPTION: (max: number) => `Customize the columns for your test cases (max ${max})`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS MESSAGES
// Toast and inline success messages
// ─────────────────────────────────────────────────────────────────────────────

export const SUCCESS = {
  /** Auth success */
  SIGNED_IN_GOOGLE: 'Successfully signed in with Google!',
  SIGNED_IN_ATLASSIAN: 'Successfully signed in with Atlassian!',
  
  /** Sheet success */
  SUBSHEET_CREATED: (name: string) => `Created subsheet: ${name}`,
  
  /** Generation success */
  GENERATION_COMPLETE: 'Test cases generated successfully!',
  GENERATION_COMPLETE_TITLE: 'Generation Complete!',
  TEST_CASES_GENERATED: (count: number) => `${count} test cases generated`,
  ROWS_WRITTEN: (count: number, tabName: string) => `${count} rows written to "${tabName}"`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ERROR MESSAGES
// Error text for failures and validation issues
// ─────────────────────────────────────────────────────────────────────────────

export const ERRORS = {
  /** Auth errors */
  SIGN_IN_FAILED: (provider: string, error: string) => `Failed to sign in with ${provider}: ${error}`,
  
  /** API errors */
  LOAD_SPRINTS_FAILED: (message: string) => `Error loading sprints: ${message}`,
  LOAD_LABELS_FAILED: (message: string) => `Error loading labels: ${message}`,
  LOAD_EPICS_FAILED: (message: string) => `Error loading epics: ${message}`,
  
  /** Sheet errors */
  CREATE_SUBSHEET_FAILED: (message: string) => `Failed to create subsheet: ${message}`,
  
  /** Generation errors */
  START_GENERATION_FAILED: (message: string) => `Failed to start generation: ${message}`,
  GENERATION_FAILED: 'Generation failed. Check the logs for details.',
  GENERATION_FAILED_TITLE: 'Generation Failed',
  CONNECTION_LOST: 'Connection lost. Please try again.',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// INFO MESSAGES
// Informational text and notes displayed to users
// ─────────────────────────────────────────────────────────────────────────────

export const INFO = {
  /** Jira setup info box */
  IMPORTANT_NOTE: 'Important Note',
  TASK_GENERATION_INFO: 'Test cases are generated for child tasks, not the Epic itself. The Epic is analyzed for context, but test cases are attributed to individual tasks.',
  
  /** Task selection */
  SELECT_TASKS_DESCRIPTION: 'Select tasks to generate test cases for',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY LABELS
// Labels used in the generation summary section
// ─────────────────────────────────────────────────────────────────────────────

export const SUMMARY_LABELS = {
  EPIC: 'Epic:',
  TASKS: 'Tasks:',
  SHEET: 'Sheet:',
  TAB: 'Tab:',
} as const;
