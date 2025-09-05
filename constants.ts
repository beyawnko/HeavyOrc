


export const ARBITER_PERSONA = `You are a world-class arbiter and editor. Your task is to synthesize multiple expert drafts into a single, coherent, and comprehensive answer that is superior to any individual draft.

Instructions:
1.  Read the original user question carefully.
2.  Review all the provided candidate answers, labeled A, B, C, etc.
3.  Identify the strengths, weaknesses, and unique insights from each draft.
4.  Synthesize the best elements from all drafts into a single, well-structured, and easy-to-read response.
5.  Do NOT simply list the drafts. Create a new, unified answer.
6.  If drafts contradict, use your judgment to determine the most likely correct information or acknowledge the controversy.
7.  Ensure your final answer directly and thoroughly addresses the original user's question.
8.  Do not include headings like "Final Answer" or "Synthesized Response". Begin the response directly.`;

export enum ErrorSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO',
}

export enum ErrorCategory {
  SECURITY = 'SECURITY',
  VALIDATION = 'VALIDATION',
  RATE_LIMIT = 'RATE_LIMIT',
  SYSTEM = 'SYSTEM',
}

export interface ErrorCodeMetaData {
  code: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
}

export const ERROR_CODES = {
  EMPTY_PROMPT: {
    code: 'ERR_EMPTY_PROMPT',
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.VALIDATION,
  },
  OPENAI_API_KEY_MISSING: {
    code: 'ERR_OPENAI_KEY_MISSING',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.VALIDATION,
  },
  OPENROUTER_API_KEY_MISSING: {
    code: 'ERR_OPENROUTER_KEY_MISSING',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.VALIDATION,
  },
  INVALID_SESSION_ID: {
    code: 'ERR_INVALID_SESSION',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SECURITY,
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'ERR_RATE_LIMIT',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.RATE_LIMIT,
  },
  NETWORK_ERROR: {
    code: 'ERR_NETWORK',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SYSTEM,
  },
  SERVER_ERROR: {
    code: 'ERR_SERVER',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SYSTEM,
  },
  UNAUTHORIZED: {
    code: 'ERR_UNAUTHORIZED',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SECURITY,
  },
  FORBIDDEN: {
    code: 'ERR_FORBIDDEN',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SECURITY,
  },
  TIMEOUT: {
    code: 'ERR_TIMEOUT',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.SYSTEM,
  },
  CONNECTION_REFUSED: {
    code: 'ERR_CONNECTION_REFUSED',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SYSTEM,
  },
  DNS_FAILURE: {
    code: 'ERR_DNS_FAILURE',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SYSTEM,
  },
} as const;

export const ERRORS = {
  [ERROR_CODES.EMPTY_PROMPT.code]:
    'A user prompt is required to process this request. Please provide non-empty prompt text.',
  [ERROR_CODES.OPENAI_API_KEY_MISSING.code]:
    'Please set your OpenAI API key in the settings to use OpenAI models.',
  [ERROR_CODES.OPENROUTER_API_KEY_MISSING.code]:
    'Please set your OpenRouter API key in the settings to use OpenRouter models.',
  [ERROR_CODES.INVALID_SESSION_ID.code]:
    'Invalid session identifier format - expected UUID v4 like 123e4567-e89b-12d3-a456-426614174000',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED.code]:
    'Rate limit exceeded. Please try again later.',
  [ERROR_CODES.NETWORK_ERROR.code]:
    'Network error occurred. Please check your connection.',
  [ERROR_CODES.SERVER_ERROR.code]:
    'Server error occurred. Please try again later.',
  [ERROR_CODES.UNAUTHORIZED.code]:
    'Authentication required to perform this action.',
  [ERROR_CODES.FORBIDDEN.code]:
    'You do not have permission to perform this action.',
  [ERROR_CODES.TIMEOUT.code]: 'Request timed out. Please try again.',
  [ERROR_CODES.CONNECTION_REFUSED.code]:
    'Unable to connect to server. Please check your connection.',
  [ERROR_CODES.DNS_FAILURE.code]:
    'Unable to resolve server address. Please check your network settings.',
} as const;

export const SESSION_ID_STORAGE_KEY = 'cipher:sessionId';
export const SESSION_CACHE_MAX_ENTRIES = 20;
export const SESSION_CACHE_MAX_SESSIONS = 100;
export const SESSION_SUMMARY_CHAR_THRESHOLD = 4000;
export const SESSION_MESSAGE_MAX_CHARS = 4000;
export const SESSION_SUMMARY_KEEP_RATIO = 0.5;
export const SUMMARIZER_MAX_CHARS = 1000;
export const SESSION_SUMMARY_DEBOUNCE_MS = 500;
export const SESSION_IMPORTS_PER_MINUTE = 5;
export const SESSION_CONTEXT_TTL_MS = 86_400_000; // 24 hours
export const SESSION_ID_SECRET =
  (typeof process !== 'undefined' && process.env.SESSION_ID_SECRET) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SESSION_ID_SECRET) ||
  'dev-session-secret';

export const SESSION_ID_KEY_SALT =
  (typeof process !== 'undefined' && process.env.SESSION_ID_KEY_SALT) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SESSION_ID_KEY_SALT) ||
  'cipher-session-salt';

export const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (SESSION_ID_SECRET === 'dev-session-secret') {
  console.warn(
    'SESSION_ID_SECRET is using a default development value; set a strong secret in production.',
  );
}

// Cache tuning
const envNumber = (key: string, viteKey: string, fallback: number): number => {
  const v =
    (typeof process !== 'undefined' && process.env[key]) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.[viteKey]);
  const num = Number(v);
  return v == null || v === '' || isNaN(num) ? fallback : num;
};

export const MEMORY_PRESSURE_THRESHOLD = envNumber(
  'MEMORY_PRESSURE_THRESHOLD',
  'VITE_MEMORY_PRESSURE_THRESHOLD',
  0.9,
); // 90% of available storage
export const MEMORY_PRESSURE_EVICT_RATIO = envNumber(
  'MEMORY_PRESSURE_EVICT_RATIO',
  'VITE_MEMORY_PRESSURE_EVICT_RATIO',
  0.5,
); // evict 50% of entries
export const MEMORY_PRESSURE_CHECK_INTERVAL = envNumber(
  'MEMORY_PRESSURE_CHECK_INTERVAL',
  'VITE_MEMORY_PRESSURE_CHECK_INTERVAL',
  1000,
); // minimum ms between heap checks

export const GEMINI_FLASH_MODEL = "gemini-2.5-flash";
export const GEMINI_PRO_MODEL = "gemini-2.5-pro";

// OpenAI Models
export const OPENAI_AGENT_MODEL = "gpt-5";
export const OPENAI_GPT5_MINI_MODEL = "gpt-5-mini";
export const OPENAI_ARBITER_MODEL = "gpt-5";
export const OPENAI_JUDGE_MODEL = OPENAI_GPT5_MINI_MODEL; // For DeepConf judge and mini agents.

// OpenRouter Models - Using popular models as examples
export const OPENROUTER_GPT_4O = "openai/gpt-4o";
export const OPENROUTER_GEMINI_FLASH_1_5 = "google/gemini-flash-1.5";
export const OPENROUTER_CLAUDE_3_HAIKU = "anthropic/claude-3-haiku-20240307";

// Prompt engineering for reasoning
export const OPENAI_REASONING_PROMPT_PREFIX = "You are a world-class expert. Reason step-by-step before providing your answer. ";
export const ARBITER_HIGH_REASONING_PROMPT_MODIFIER = `
Your reasoning and synthesis abilities are paramount. Before writing the final answer, explicitly outline the key points from each draft, identify convergences and divergences, and then construct a synthesis that resolves contradictions and builds upon the strongest arguments. Your final output should only be the synthesized answer itself.`;
