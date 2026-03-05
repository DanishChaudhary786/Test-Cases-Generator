import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { WizardState, WizardAction } from '../types';
import { DEFAULT_COLUMNS } from '../constants';

/** LocalStorage key for persisting wizard state across page refreshes */
const STORAGE_KEY = 'testCaseGenerator_wizardState';

const defaultState: WizardState = {
  currentStep: 0,
  authStatus: null,
  selectedSprint: null,
  selectedLabels: [],
  selectedEpic: null,
  selectedTester: null,
  selectedTasks: [],
  selectedSheet: null,
  selectedSubsheet: null,
  newSubsheetName: '',
  columns: DEFAULT_COLUMNS,
  columnDefaults: {},
  aiProvider: 'anthropic',
  aiApiKey: '',
  generationJobId: null,
  generationMessages: [],
  generationResult: null,
  generationError: null,
};

// Keys to persist in localStorage (excluding auth status and generation state)
const PERSISTED_KEYS: (keyof WizardState)[] = [
  'currentStep',
  'selectedSprint',
  'selectedLabels',
  'selectedEpic',
  'selectedTester',
  'selectedTasks',
  'selectedSheet',
  'selectedSubsheet',
  'newSubsheetName',
  'columns',
  'columnDefaults',
  'aiProvider',
];

function loadPersistedState(): Partial<WizardState> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load persisted wizard state:', e);
  }
  return {};
}

function savePersistedState(state: WizardState) {
  try {
    const toPersist: Partial<WizardState> = {};
    for (const key of PERSISTED_KEYS) {
      (toPersist as Record<string, unknown>)[key] = state[key];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
  } catch (e) {
    console.warn('Failed to save wizard state:', e);
  }
}

const initialState: WizardState = {
  ...defaultState,
  ...loadPersistedState(),
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_AUTH_STATUS':
      return { ...state, authStatus: action.payload };
    case 'SET_SPRINT':
      return { ...state, selectedSprint: action.payload, selectedEpic: null, selectedTasks: [] };
    case 'SET_LABELS':
      return { ...state, selectedLabels: action.payload, selectedEpic: null, selectedTasks: [] };
    case 'SET_EPIC':
      return { ...state, selectedEpic: action.payload, selectedTasks: [] };
    case 'SET_TESTER':
      return { ...state, selectedTester: action.payload };
    case 'SET_TASKS':
      return { ...state, selectedTasks: action.payload };
    case 'SET_SHEET':
      return { ...state, selectedSheet: action.payload, selectedSubsheet: null };
    case 'SET_SUBSHEET':
      return { ...state, selectedSubsheet: action.payload };
    case 'SET_NEW_SUBSHEET_NAME':
      return { ...state, newSubsheetName: action.payload };
    case 'SET_COLUMNS': {
      // When columns are removed, also clean up orphaned column defaults
      const newDefaults = { ...state.columnDefaults };
      Object.keys(newDefaults).forEach(key => {
        const index = parseInt(key);
        if (index >= action.payload.length) {
          delete newDefaults[index];
        }
      });
      return { ...state, columns: action.payload, columnDefaults: newDefaults };
    }
    case 'SET_COLUMN_DEFAULT': {
      const { index, value } = action.payload;
      if (value.trim() === '') {
        const newDefaults = { ...state.columnDefaults };
        delete newDefaults[index];
        return { ...state, columnDefaults: newDefaults };
      }
      return { 
        ...state, 
        columnDefaults: { ...state.columnDefaults, [index]: value } 
      };
    }
    case 'REMOVE_COLUMN_DEFAULT': {
      const newDefaults = { ...state.columnDefaults };
      delete newDefaults[action.payload];
      return { ...state, columnDefaults: newDefaults };
    }
    case 'SET_AI_PROVIDER':
      return { ...state, aiProvider: action.payload };
    case 'SET_AI_API_KEY':
      return { ...state, aiApiKey: action.payload };
    case 'SET_GENERATION_JOB_ID':
      return { ...state, generationJobId: action.payload };
    case 'ADD_GENERATION_MESSAGE':
      return { ...state, generationMessages: [...state.generationMessages, action.payload] };
    case 'SET_GENERATION_RESULT':
      return { ...state, generationResult: action.payload };
    case 'SET_GENERATION_ERROR':
      return { ...state, generationError: action.payload };
    case 'RESET_GENERATION':
      return { 
        ...state, 
        generationJobId: null, 
        generationMessages: [], 
        generationResult: null, 
        generationError: null 
      };
    default:
      return state;
  }
}

interface WizardContextType {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  canProceedToStep: (step: number) => boolean;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
}

const WizardContext = createContext<WizardContextType | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  // Persist state changes to localStorage
  useEffect(() => {
    savePersistedState(state);
  }, [state]);

  const canProceedToStep = (step: number): boolean => {
    if (step === 0) return true;
    
    if (step === 1) {
      return !!(state.authStatus?.google.authenticated && state.authStatus?.atlassian.authenticated);
    }
    
    if (step === 2) {
      return !!(state.selectedEpic && state.selectedTasks.length > 0);
    }
    
    if (step === 3) {
      return !!(state.selectedSheet && (state.selectedSubsheet || state.newSubsheetName));
    }
    
    return false;
  };

  const goToStep = (step: number) => {
    if (step >= 0 && step <= 3) {
      dispatch({ type: 'SET_STEP', payload: step });
    }
  };

  const nextStep = () => {
    if (canProceedToStep(state.currentStep + 1)) {
      goToStep(state.currentStep + 1);
    }
  };

  const prevStep = () => {
    goToStep(state.currentStep - 1);
  };

  return (
    <WizardContext.Provider value={{ state, dispatch, canProceedToStep, goToStep, nextStep, prevStep }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
