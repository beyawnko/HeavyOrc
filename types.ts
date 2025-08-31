import {
    GEMINI_FLASH_MODEL,
    GEMINI_PRO_MODEL,
    OPENAI_AGENT_MODEL,
    OPENAI_GPT5_MINI_MODEL,
    OPENAI_ARBITER_MODEL,
} from './constants';
import { z } from 'zod';

export type ApiProvider = 'gemini' | 'openai' | 'openrouter';
export type AgentStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'QUEUED';

export interface Expert {
  id: string;
  name: string;
  persona: string;
}

export interface AgentState {
  id: string;
  name: string;
  persona: string;
  status: AgentStatus;
  content: string;
  error: string | null;
  model: string;
  provider: ApiProvider;
}

export interface ImageState {
  id: string; // Unique identifier for each image
  file: File;
  base64: string;
}

// New types for direct manipulation UI
export type GeminiModel = typeof GEMINI_FLASH_MODEL | typeof GEMINI_PRO_MODEL;
export type OpenAIModel = typeof OPENAI_AGENT_MODEL | typeof OPENAI_GPT5_MINI_MODEL;
export type OpenRouterModel = string; // e.g., "openai/gpt-4o"
export type AgentModel = GeminiModel | OpenAIModel | OpenRouterModel;

export type GeminiThinkingEffort = 'dynamic' | 'high' | 'medium' | 'low' | 'none';
export type GenerationStrategy = 'single' | 'deepconf-offline' | 'deepconf-online';

export interface GeminiAgentSettings {
    effort: GeminiThinkingEffort;
    generationStrategy: GenerationStrategy;
    confidenceSource: 'judge';
    traceCount: number;
    deepConfEta: 10 | 90;
    tau: number;
    groupWindow: number;
}

export interface OpenAIAgentSettings {
    effort: 'medium' | 'high';
    verbosity: 'low' | 'medium' | 'high';
    generationStrategy: GenerationStrategy;
    confidenceSource: 'judge';
    traceCount: number;
    deepConfEta: 10 | 90;
    tau: number;
    groupWindow: number;
}

export interface OpenRouterAgentSettings {
    temperature: number;
    topP: number;
    topK: number;
    frequencyPenalty: number;
    presencePenalty: number;
    repetitionPenalty: number;
    maxTokens?: number;
}

const CommonAgentSettingsSchema = z.object({
    generationStrategy: z
        .enum(['single', 'deepconf-offline', 'deepconf-online'])
        .optional(),
    confidenceSource: z.literal('judge').optional(),
    traceCount: z.number().optional(),
    deepConfEta: z.union([z.literal(10), z.literal(90)]).optional(),
    tau: z.number().optional(),
    groupWindow: z.number().optional(),
}).strict();

const GeminiAgentSettingsSchema: z.ZodType<Partial<GeminiAgentSettings>> =
    CommonAgentSettingsSchema.extend({
        effort: z.enum(['dynamic', 'high', 'medium', 'low', 'none']).optional(),
    }).strict();

const OpenAIAgentSettingsSchema: z.ZodType<Partial<OpenAIAgentSettings>> =
    CommonAgentSettingsSchema.extend({
        effort: z.enum(['medium', 'high']).optional(),
        verbosity: z.enum(['low', 'medium', 'high']).optional(),
    }).strict();

const OpenRouterAgentSettingsSchema: z.ZodType<Partial<OpenRouterAgentSettings>> = z.object({
    temperature: z.number().optional(),
    topP: z.number().optional(),
    topK: z.number().optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
    repetitionPenalty: z.number().optional(),
    maxTokens: z.number().optional(),
}).strict();

const ProviderSettingsSchemaMap: Record<ApiProvider, z.ZodTypeAny> = {
    gemini: GeminiAgentSettingsSchema,
    openai: OpenAIAgentSettingsSchema,
    openrouter: OpenRouterAgentSettingsSchema,
};

export type SavedAgentSettings =
    | Partial<GeminiAgentSettings>
    | Partial<OpenAIAgentSettings>
    | Partial<OpenRouterAgentSettings>
    | Record<string, unknown>;

const SavedAgentSettingsSchema: z.ZodType<SavedAgentSettings> =
    z.record(z.unknown());

export interface BaseAgentConfig {
    id: string; // unique instance id
    expert: Expert;
    model: AgentModel;
    provider: ApiProvider;
    status: AgentStatus;
}

export interface GeminiAgentConfig extends BaseAgentConfig {
    provider: 'gemini';
    model: GeminiModel;
    settings: GeminiAgentSettings;
}

export interface OpenAIAgentConfig extends BaseAgentConfig {
    provider: 'openai';
    model: OpenAIModel;
    settings: OpenAIAgentSettings;
}

export interface OpenRouterAgentConfig extends BaseAgentConfig {
    provider: 'openrouter';
    model: OpenRouterModel;
    settings: OpenRouterAgentSettings;
}

export type AgentConfig = GeminiAgentConfig | OpenAIAgentConfig | OpenRouterAgentConfig;

// Types for session management
export type ArbiterModel =
    | typeof GEMINI_PRO_MODEL
    | typeof GEMINI_FLASH_MODEL
    | typeof OPENAI_ARBITER_MODEL
    | typeof OPENAI_GPT5_MINI_MODEL
    | string;
export type OpenAIVerbosity = 'low' | 'medium' | 'high';
export type OpenAIReasoningEffort = 'medium' | 'high';

const SavedAgentConfigSchemaBase = z.object({
    expertId: z.string().optional(),
    model: z.string().optional(),
    provider: z.enum(['gemini', 'openai', 'openrouter']).optional(),
    settings: SavedAgentSettingsSchema.optional(),
});

export const SavedAgentConfigSchema = SavedAgentConfigSchemaBase.superRefine(
    (config: z.infer<typeof SavedAgentConfigSchemaBase>, ctx) => {
        if (!config.provider || !config.settings) return;

        const schema = ProviderSettingsSchemaMap[config.provider];

        const result = schema.safeParse(config.settings);
        if (!result.success) {
            for (const issue of result.error.issues) {
                ctx.addIssue({
                    ...issue,
                    path: ['settings', ...issue.path],
                });
            }
        }
    },
);
export type SavedAgentConfig = z.infer<typeof SavedAgentConfigSchema>;

export const SESSION_DATA_VERSION = 2;

export interface SessionData {
    version: number;
    prompt: string;
    agentConfigs: SavedAgentConfig[];
    arbiterModel: ArbiterModel;
    openAIArbiterVerbosity: OpenAIVerbosity;
    openAIArbiterEffort: OpenAIReasoningEffort;
    geminiArbiterEffort: GeminiThinkingEffort;
    openAIApiKey: string;
    geminiApiKey: string;
    openRouterApiKey: string;
    queryHistory: string[];
}

// Type for history feature
export type RunStatus = 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';

export interface RunRecord {
  id: string;
  timestamp: number;
  prompt: string;
  images: ImageState[];
  agentConfigs: AgentConfig[];
  arbiterModel: ArbiterModel;
  openAIArbiterVerbosity: OpenAIVerbosity;
  openAIArbiterEffort: OpenAIReasoningEffort;
  geminiArbiterEffort: GeminiThinkingEffort;
  finalAnswer: string;
  agents: AgentState[];
  status: RunStatus;
  arbiterSwitchWarning: string | null;
}
