export interface AuthStatus {
  google: {
    authenticated: boolean;
    email?: string;
    name?: string;
  };
  atlassian: {
    authenticated: boolean;
    email?: string;
    name?: string;
    siteName?: string;
    siteUrl?: string;
  };
}

export interface Sprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
}

export interface Epic {
  key: string;
  summary: string;
  description: string;
  labels: string[];
  type: string;
  status: string;
  priority: string;
}

export interface Task {
  key: string;
  summary: string;
  description: string;
  labels: string[];
  type: string;
  status: string;
  priority: string;
}

export interface Tester {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

export interface Sheet {
  id: string;
  name: string;
  modifiedTime?: string;
  url?: string;
}

export interface Subsheet {
  id: number;
  name: string;
  index: number;
}

export interface GenerationResult {
  success: boolean;
  test_cases_count: number;
  rows_written: number;
  tab_name: string;
  sheet_id: string;
  sheet_url: string;
}

export interface WizardState {
  currentStep: number;
  
  // Step 1: Auth
  authStatus: AuthStatus | null;
  
  // Step 2: Jira Setup
  selectedSprint: Sprint | null;
  selectedLabels: string[];
  selectedEpic: Epic | null;
  selectedTester: Tester | null;
  selectedTasks: Task[];
  
  // Step 3: Sheet Config
  selectedSheet: Sheet | null;
  selectedSubsheet: Subsheet | null;
  newSubsheetName: string;
  columns: string[];
  columnDefaults: Record<number, string>;
  
  // Step 4: Generate
  aiProvider: 'anthropic' | 'openai' | 'gemini' | 'deepseek';
  aiApiKey: string;
  generationJobId: string | null;
  generationMessages: string[];
  generationResult: GenerationResult | null;
  generationError: string | null;
}

export type WizardAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_AUTH_STATUS'; payload: AuthStatus }
  | { type: 'SET_SPRINT'; payload: Sprint | null }
  | { type: 'SET_LABELS'; payload: string[] }
  | { type: 'SET_EPIC'; payload: Epic | null }
  | { type: 'SET_TESTER'; payload: Tester | null }
  | { type: 'SET_TASKS'; payload: Task[] }
  | { type: 'SET_SHEET'; payload: Sheet | null }
  | { type: 'SET_SUBSHEET'; payload: Subsheet | null }
  | { type: 'SET_NEW_SUBSHEET_NAME'; payload: string }
  | { type: 'SET_COLUMNS'; payload: string[] }
  | { type: 'SET_COLUMN_DEFAULT'; payload: { index: number; value: string } }
  | { type: 'REMOVE_COLUMN_DEFAULT'; payload: number }
  | { type: 'SET_AI_PROVIDER'; payload: 'anthropic' | 'openai' | 'gemini' | 'deepseek' }
  | { type: 'SET_AI_API_KEY'; payload: string }
  | { type: 'SET_GENERATION_JOB_ID'; payload: string | null }
  | { type: 'ADD_GENERATION_MESSAGE'; payload: string }
  | { type: 'SET_GENERATION_RESULT'; payload: GenerationResult | null }
  | { type: 'SET_GENERATION_ERROR'; payload: string | null }
  | { type: 'RESET_GENERATION' };
