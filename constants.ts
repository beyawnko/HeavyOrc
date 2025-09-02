


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

export const SESSION_ID_STORAGE_KEY = 'cipher:sessionId';
export const SESSION_CACHE_MAX_ENTRIES = 20;
export const SESSION_SUMMARY_CHAR_THRESHOLD = 4000;
export const SESSION_MESSAGE_MAX_CHARS = 4000;
export const SESSION_SUMMARY_KEEP_RATIO = 0.5;
export const SUMMARIZER_MAX_CHARS = 1000;
export const SESSION_ID_SECRET =
  (typeof process !== 'undefined' && process.env.SESSION_ID_SECRET) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SESSION_ID_SECRET) ||
  'dev-session-secret';

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
