
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

export const GEMINI_FLASH_MODEL = "gemini-2.5-flash";
export const GEMINI_PRO_MODEL = "gemini-2.5-pro";

// OpenAI Models
export const OPENAI_AGENT_MODEL = "gpt-5";
export const OPENAI_ARBITER_MODEL = "gpt-5";

// Hypothetical model names for the UI, mapped to existing OpenAI models.
export const OPENAI_ARBITER_GPT5_MEDIUM_REASONING = "gpt-5-medium-reasoning";
export const OPENAI_ARBITER_GPT5_HIGH_REASONING = "gpt-5-high-reasoning";

// Prompt engineering for reasoning
export const OPENAI_REASONING_PROMPT_PREFIX = "You are a world-class expert. Reason step-by-step before providing your answer. ";
export const ARBITER_HIGH_REASONING_PROMPT_MODIFIER = `
Your reasoning and synthesis abilities are paramount. Before writing the final answer, explicitly outline the key points from each draft, identify convergences and divergences, and then construct a synthesis that resolves contradictions and builds upon the strongest arguments. Your final output should only be the synthesized answer itself.`;
