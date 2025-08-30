import {
    AgentConfig,
    GeminiAgentConfig,
    OpenAIAgentConfig,
    OpenRouterAgentConfig,
    GeminiAgentSettings,
    OpenAIAgentSettings,
    OpenRouterAgentSettings,
    SavedAgentConfig,
    GeminiThinkingEffort,
    OpenAIReasoningEffort,
    OpenAIVerbosity,
    GenerationStrategy,
    Expert,
    GeminiModel,
    OpenAIModel,
} from '@/types';
import {
    GEMINI_FLASH_MODEL,
    GEMINI_PRO_MODEL,
    OPENAI_AGENT_MODEL,
    OPENAI_GPT5_MINI_MODEL,
    OPENROUTER_GPT_4O,
} from '@/constants';

const VALID_GENERATION_STRATEGIES: GenerationStrategy[] = [
    'single',
    'deepconf-offline',
    'deepconf-online',
];

const GEMINI_EFFORT_VALUES: readonly GeminiThinkingEffort[] = [
    'dynamic',
    'high',
    'medium',
    'low',
    'none',
];
const isGeminiThinkingEffort = (value: unknown): value is GeminiThinkingEffort =>
    typeof value === 'string' &&
    GEMINI_EFFORT_VALUES.includes(value as GeminiThinkingEffort);

const OPENAI_EFFORT_VALUES: readonly OpenAIReasoningEffort[] = ['medium', 'high'];
const isOpenAIReasoningEffort = (
    value: unknown,
): value is OpenAIReasoningEffort =>
    typeof value === 'string' &&
    OPENAI_EFFORT_VALUES.includes(value as OpenAIReasoningEffort);

const OPENAI_VERBOSITY_VALUES: readonly OpenAIVerbosity[] = [
    'low',
    'medium',
    'high',
];
const isOpenAIVerbosity = (value: unknown): value is OpenAIVerbosity =>
    typeof value === 'string' &&
    OPENAI_VERBOSITY_VALUES.includes(value as OpenAIVerbosity);

const migrateOpenRouterSettings = (
    partial: Partial<OpenRouterAgentSettings>,
): OpenRouterAgentSettings => ({
    temperature: typeof partial.temperature === 'number' ? partial.temperature : 0.7,
    topP: typeof partial.topP === 'number' ? partial.topP : 1,
    topK: typeof partial.topK === 'number' ? partial.topK : 50,
    frequencyPenalty:
        typeof partial.frequencyPenalty === 'number' ? partial.frequencyPenalty : 0,
    presencePenalty:
        typeof partial.presencePenalty === 'number' ? partial.presencePenalty : 0,
    repetitionPenalty:
        typeof partial.repetitionPenalty === 'number' ? partial.repetitionPenalty : 1,
    maxTokens: typeof partial.maxTokens === 'number' ? partial.maxTokens : undefined,
});

const migrateCommonSettings = (
    partial: Partial<GeminiAgentSettings | OpenAIAgentSettings>,
): Pick<
    GeminiAgentSettings,
    'generationStrategy' | 'confidenceSource' | 'traceCount' | 'deepConfEta' | 'tau' | 'groupWindow'
> => ({
    generationStrategy: VALID_GENERATION_STRATEGIES.includes(
        partial.generationStrategy as GenerationStrategy,
    )
        ? (partial.generationStrategy as GenerationStrategy)
        : 'single',
    confidenceSource: 'judge',
    traceCount:
        typeof partial.traceCount === 'number' ? partial.traceCount : 8,
    deepConfEta:
        partial.deepConfEta === 10 || partial.deepConfEta === 90 ? partial.deepConfEta : 90,
    tau: typeof partial.tau === 'number' ? partial.tau : 0.95,
    groupWindow:
        typeof partial.groupWindow === 'number' ? partial.groupWindow : 2048,
});

export const migrateAgentConfig = (
    savedConfig: SavedAgentConfig,
    expertList: Expert[],
): AgentConfig | null => {
    const expert = expertList.find((e) => e.id === savedConfig.expertId);
    if (!expert) {
        console.warn(`Expert with ID "${savedConfig.expertId}" not found. Skipping.`);
        return null;
    }

    const baseConfig = {
        id: crypto.randomUUID(),
        expert,
        status: 'PENDING' as const,
    };

    const provider = savedConfig.provider;
    const rawSettings =
        savedConfig.settings && typeof savedConfig.settings === 'object'
            ? (savedConfig.settings as Partial<
                  GeminiAgentSettings | OpenAIAgentSettings | OpenRouterAgentSettings
              >)
            : {};

    switch (provider) {
        case 'gemini': {
            const model: GeminiModel =
                savedConfig.model === GEMINI_FLASH_MODEL ||
                savedConfig.model === GEMINI_PRO_MODEL
                    ? savedConfig.model
                    : GEMINI_FLASH_MODEL;
            const geminiSettings = rawSettings as Partial<GeminiAgentSettings>;
            const effort: GeminiThinkingEffort = isGeminiThinkingEffort(
                geminiSettings.effort,
            )
                ? geminiSettings.effort!
                : 'dynamic';
            const migratedSettings: GeminiAgentSettings = {
                ...migrateCommonSettings(geminiSettings),
                effort,
            };
            return {
                ...baseConfig,
                model,
                provider: 'gemini',
                settings: migratedSettings,
            } as GeminiAgentConfig;
        }

        case 'openai': {
            const model: OpenAIModel =
                savedConfig.model === OPENAI_AGENT_MODEL ||
                savedConfig.model === OPENAI_GPT5_MINI_MODEL
                    ? savedConfig.model
                    : OPENAI_AGENT_MODEL;
            const openAISettings = rawSettings as Partial<OpenAIAgentSettings>;
            const effort: OpenAIReasoningEffort = isOpenAIReasoningEffort(
                openAISettings.effort,
            )
                ? openAISettings.effort
                : 'medium';
            const verbosity: OpenAIVerbosity = isOpenAIVerbosity(
                openAISettings.verbosity,
            )
                ? openAISettings.verbosity
                : 'medium';
            const migratedSettings: OpenAIAgentSettings = {
                ...migrateCommonSettings(openAISettings),
                effort,
                verbosity,
            };
            return {
                ...baseConfig,
                model,
                provider: 'openai',
                settings: migratedSettings,
            } as OpenAIAgentConfig;
        }

        case 'openrouter': {
            const model =
                typeof savedConfig.model === 'string'
                    ? savedConfig.model
                    : OPENROUTER_GPT_4O;
            const openRouterSettings =
                rawSettings as Partial<OpenRouterAgentSettings>;
            const migratedSettings = migrateOpenRouterSettings(openRouterSettings);
            return {
                ...baseConfig,
                model,
                provider: 'openrouter',
                settings: migratedSettings,
            } as OpenRouterAgentConfig;
        }

        default:
            console.warn(
                `Unknown provider "${provider}" for expert "${savedConfig.expertId}". Skipping.`,
            );
            return null;
    }
};

