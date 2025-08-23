import { Expert } from './moe/types';
import { 
    GEMINI_FLASH_MODEL, 
    GEMINI_PRO_MODEL, 
    OPENAI_AGENT_MODEL,
    OPENAI_ARBITER_GPT5_MEDIUM_REASONING,
    OPENAI_ARBITER_GPT5_HIGH_REASONING
} from './constants';

export type ApiProvider = 'gemini' | 'openai';
export type AgentStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'QUEUED';

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
export type OpenAIModel = typeof OPENAI_AGENT_MODEL;
export type AgentModel = GeminiModel | OpenAIModel;

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

export type AgentConfig = GeminiAgentConfig | OpenAIAgentConfig;

// Types for session management
export type ArbiterModel = typeof GEMINI_PRO_MODEL | typeof OPENAI_ARBITER_GPT5_MEDIUM_REASONING | typeof OPENAI_ARBITER_GPT5_HIGH_REASONING;
export type OpenAIVerbosity = 'low' | 'medium' | 'high';

export interface SavedAgentConfig {
    expertId: string;
    model: AgentModel;
    provider: ApiProvider;
    settings: GeminiAgentSettings | OpenAIAgentSettings;
}

export const SESSION_DATA_VERSION = 1;

export interface SessionData {
    version: number;
    prompt: string;
    agentConfigs: SavedAgentConfig[];
    arbiterModel: ArbiterModel;
    openAIArbiterVerbosity: OpenAIVerbosity;
    geminiArbiterEffort: GeminiThinkingEffort;
    openAIApiKey: string;
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
  geminiArbiterEffort: GeminiThinkingEffort;
  finalAnswer: string;
  agents: AgentState[];
  status: RunStatus;
  arbiterSwitchWarning: string | null;
}