import axios from 'axios';

// Use environment variable for API URL, fallback to relative path for dev proxy
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Session ID management for cross-domain auth
const SESSION_ID_KEY = 'testcase_session_id';

export const getSessionId = (): string | null => {
  return localStorage.getItem(SESSION_ID_KEY);
};

export const setSessionId = (sid: string): void => {
  localStorage.setItem(SESSION_ID_KEY, sid);
};

export const clearSessionId = (): void => {
  localStorage.removeItem(SESSION_ID_KEY);
};

// Check URL for session ID after OAuth redirect
export const extractSessionIdFromUrl = (): void => {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get('sid');
  if (sid) {
    setSessionId(sid);
    // Clean up URL
    params.delete('sid');
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
    window.history.replaceState({}, '', newUrl);
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add session ID to all requests
api.interceptors.request.use((config) => {
  const sessionId = getSessionId();
  if (sessionId) {
    config.headers['X-Session-ID'] = sessionId;
  }
  return config;
});

// Auth API
export const authApi = {
  getStatus: () => api.get('/auth/status').then(res => res.data),
  logout: (provider?: string) => {
    if (!provider) {
      clearSessionId();
    }
    return api.post('/auth/logout', null, { params: { provider } });
  },
  getGoogleAuthUrl: () => `${API_BASE_URL}/auth/google`,
  getAtlassianAuthUrl: () => `${API_BASE_URL}/auth/atlassian`,
};

// Jira API
export const jiraApi = {
  getBoards: () => api.get('/jira/boards').then(res => res.data),
  getSprints: (boardId?: number) => 
    api.get('/jira/sprints', { params: { board_id: boardId } }).then(res => res.data),
  getLabels: () => api.get('/jira/labels').then(res => res.data),
  getEpics: (sprintId?: string, labels?: string[]) => 
    api.get('/jira/epics', { 
      params: { sprint_id: sprintId, labels: labels?.join(',') } 
    }).then(res => res.data),
  getTasks: (epicKey?: string, tester?: string) => 
    api.get('/jira/tasks', { params: { epic_key: epicKey, tester } }).then(res => res.data),
  getTesters: () => api.get('/jira/testers').then(res => res.data),
  getLinkTypes: () => api.get('/jira/link-types').then(res => res.data),
  getUsers: (query?: string) => 
    api.get('/jira/users', { params: { query } }).then(res => res.data),
  getIssue: (issueKey: string) => api.get(`/jira/issue/${issueKey}`).then(res => res.data),
  getEpicWithChildren: (epicKey: string) => 
    api.get(`/jira/epic/${epicKey}/children`).then(res => res.data),
};

// Sheets API
export const sheetsApi = {
  listSheets: () => api.get('/sheets/list').then(res => res.data),
  getSubsheets: (sheetId: string) => 
    api.get(`/sheets/${sheetId}/subsheets`).then(res => res.data),
  createSubsheet: (sheetId: string, name: string) => 
    api.post(`/sheets/${sheetId}/subsheets`, { name }).then(res => res.data),
};

// Generate API
export interface GenerateRequest {
  epic_key: string;
  task_keys: string[];
  sheet_id: string;
  subsheet_name: string;
  columns: string[];
  column_defaults?: Record<number, string>;
  ai_provider: string;
  ai_api_key?: string;
}

export const generateApi = {
  start: (data: GenerateRequest) => 
    api.post('/generate', data).then(res => res.data),
  getStatus: (jobId: string) => 
    api.get(`/generate/status/${jobId}`).then(res => res.data),
  streamUrl: (jobId: string) => `${API_BASE_URL}/generate/stream/${jobId}`,
  cancel: (jobId: string) => 
    api.delete(`/generate/${jobId}`).then(res => res.data),
};

export default api;
