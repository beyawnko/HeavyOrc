


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
  ERROR = 'ERROR',
  WARNING = 'WARNING',
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

export const ERROR_CODES: Record<string, ErrorCodeMetaData> = {
  EMPTY_PROMPT: {
    code: 'ERR_EMPTY_PROMPT',
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.VALIDATION,
  },
  OPENAI_API_KEY_MISSING: {
    code: 'ERR_OPENAI_KEY_MISSING',
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.VALIDATION,
  },
  OPENROUTER_API_KEY_MISSING: {
    code: 'ERR_OPENROUTER_KEY_MISSING',
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.VALIDATION,
  },
  INVALID_SESSION_ID: {
    code: 'ERR_INVALID_SESSION',
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.SECURITY,
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'ERR_RATE_LIMIT',
    severity: ErrorSeverity.WARNING,
    category: ErrorCategory.RATE_LIMIT,
  },
  NETWORK_ERROR: {
    code: 'ERR_NETWORK',
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.SYSTEM,
  },
  SERVER_ERROR: {
    code: 'ERR_SERVER',
    severity: ErrorSeverity.ERROR,
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
  [ERROR_CODES.INVALID_SESSION_ID.code]: 'Invalid session identifier format',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED.code]:
    'Rate limit exceeded. Please try again later.',
  [ERROR_CODES.NETWORK_ERROR.code]:
    'Network error occurred. Please check your connection.',
  [ERROR_CODES.SERVER_ERROR.code]:
    'Server error occurred. Please try again later.',
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

export const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (SESSION_ID_SECRET === 'dev-session-secret') {
  console.warn(
    'SESSION_ID_SECRET is using a default development value; set a strong secret in production.',
  );
}

// Cache tuning
export const MEMORY_PRESSURE_THRESHOLD = 0.9; // 90% of available storage
export const MEMORY_PRESSURE_EVICT_RATIO = 0.5; // evict 50% of entries
export const MEMORY_PRESSURE_CHECK_INTERVAL = 50; // check heap every 50 ops

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
