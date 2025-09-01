import { GenerateContentParameters, Part } from "@google/genai";
import { Draft, ExpertDispatch } from './types';
import { getGeminiClient, getOpenAIClient, getOpenRouterApiKey, callWithRetry, fetchWithRetry } from '@/services/llmService';
import { getAppUrl, getGeminiResponseText, combineAbortSignals } from '@/lib/utils';
import { callWithGeminiRetry, handleGeminiError, isAbortError } from '@/services/geminiUtils';
import { GEMINI_PRO_MODEL, GEMINI_FLASH_MODEL, OPENAI_REASONING_PROMPT_PREFIX } from '@/constants';
import { AgentConfig, GeminiAgentConfig, ImageState, OpenAIAgentConfig, GeminiThinkingEffort, OpenRouterAgentConfig } from '@/types';
import {
    Trace,
    DEFAULTS,
    deepConfOnlineWithJudge,
    deepConfOfflineWithJudge,
    TraceProvider
} from '@/services/deepconf';

interface OpenRouterContentPart {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
}

interface OpenRouterMessage {
    role: 'system' | 'user';
    content: string | OpenRouterContentPart[];
}

const GEMINI_PRO_BUDGETS: Record<Extract<GeminiThinkingEffort, 'low' | 'medium' | 'high' | 'dynamic'>, number> = {
    low: 8192,
    medium: 24576,
    high: 32768,
    dynamic: -1,
};

const GEMINI_FLASH_BUDGETS: Record<Extract<GeminiThinkingEffort, 'none' | 'low' | 'medium' | 'high' | 'dynamic'>, number> = {
    none: 0,
    low: 4096,
    medium: 12288,
    high: 24576,
    dynamic: -1,
};

const parseEnvInt = (value: string | undefined, fallback: number) => {
    const parsed = parseInt(value ?? '', 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};

const GEMINI_RETRY_COUNT = parseEnvInt(process.env.GEMINI_RETRY_COUNT, 3);
const GEMINI_BACKOFF_MS = parseEnvInt(process.env.GEMINI_BACKOFF_MS, 1000);
const GEMINI_TIMEOUT_MS = parseEnvInt(process.env.GEMINI_TIMEOUT_MS, 10000);

const runExpertGeminiSingle = async (
    expert: ExpertDispatch,
    prompt: string,
    images: ImageState[],
    config: GeminiAgentConfig,
    abortSignal?: AbortSignal
): Promise<string> => {
    const parts: Part[] = [{ text: prompt }];
    images.forEach(img => {
        parts.push({
            inlineData: {
                mimeType: img.file.type,
                data: img.base64,
            },
        });
    });

    const generateContentParams: GenerateContentParameters = {
        model: expert.model,
        contents: { parts },
        config: {
            systemInstruction: expert.persona,
            temperature: 0.5 + Math.random() * 0.2, // Add some randomness
        }
    };

    // Apply thinking config for both Flash and Pro models based on the agent's settings.
    if (config.model === GEMINI_FLASH_MODEL) {
        const budget = GEMINI_FLASH_BUDGETS[config.settings.effort];
        if (generateContentParams.config) generateContentParams.config.thinkingConfig = { thinkingBudget: budget };
    } else if (config.model === GEMINI_PRO_MODEL) {
        // 'none' is not a valid effort for Pro, so we map it to 'dynamic' as a safe default.
        const effortForPro = config.settings.effort === 'none' 
            ? 'dynamic' 
            : config.settings.effort;
        const budget = GEMINI_PRO_BUDGETS[effortForPro];
        if (generateContentParams.config) generateContentParams.config.thinkingConfig = { thinkingBudget: budget };
    }

    const geminiAI = getGeminiClient();
    try {
        const response = await callWithGeminiRetry(
            (signal) => {
                if (abortSignal?.aborted) {
                    const abortErr = new Error('Aborted');
                    abortErr.name = 'AbortError';
                    return Promise.reject(abortErr);
                }
                const { signal: finalSignal, cleanup } = combineAbortSignals(signal, abortSignal);
                if (generateContentParams.config) {
                    generateContentParams.config.abortSignal = finalSignal;
                }
                return geminiAI
                    .models.generateContent(generateContentParams)
                    .finally(cleanup);
            },
            { retries: GEMINI_RETRY_COUNT, baseDelayMs: GEMINI_BACKOFF_MS, timeoutMs: GEMINI_TIMEOUT_MS }
        );
        return getGeminiResponseText(response);
    } catch (error) {
        if (
            (isAbortError(error) || (error instanceof Error && error.message === 'Gemini request timed out'))
        ) {
            throw error as Error;
        }
        return handleGeminiError(error, 'dispatcher', 'dispatch');
    }
}

const createDeepConfTraceProvider = <C extends AgentConfig>(
    runFn: (
        expert: ExpertDispatch,
        prompt: string,
        images: ImageState[],
        config: C,
        abortSignal?: AbortSignal
    ) => Promise<string>,
    expert: ExpertDispatch,
    images: ImageState[],
    config: C,
    orchestrationAbortSignal?: AbortSignal
): TraceProvider => {
    const segmenter = globalThis.Intl?.Segmenter
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : undefined;
    return {
        generate: async (p, signal) => {
            const { signal: finalSignal, cleanup } = combineAbortSignals(signal, orchestrationAbortSignal);
            try {
                const text = await runFn(expert, p, images, config, finalSignal);
                const tokens = segmenter
                    ? Array.from(segmenter.segment(text), ({ segment }) => segment)
                    // Array.from on a string iterates by code point; complex grapheme clusters may split
                    : Array.from(text);
                const trace: Trace = {
                    text,
                    steps: tokens.map(token => ({ token, topK: [] })),
                };
                return trace;
            } finally {
                cleanup();
            }
        }
    };
};

const runExpertGeminiDeepConf = async (
    expert: ExpertDispatch,
    prompt: string,
    images: ImageState[],
    config: GeminiAgentConfig,
    abortSignal?: AbortSignal
): Promise<string> => {
    const { generationStrategy, traceCount, deepConfEta, tau, groupWindow } = config.settings;

    const provider = createDeepConfTraceProvider(runExpertGeminiSingle, expert, images, config, abortSignal);

    const extractAnswer = (trace: Trace) => trace.text.trim();

    const opts = {
        etaPercent: deepConfEta,
        maxBudget: traceCount,
        warmupTraces: Math.min(traceCount, DEFAULTS.warmupTraces),
        tau,
        groupWindow,
    };

    if (generationStrategy === 'deepconf-online') {
        const { content } = await deepConfOnlineWithJudge(provider, prompt, extractAnswer, config.model, opts);
        return content;
    } else { // deepconf-offline
        const { content } = await deepConfOfflineWithJudge(provider, prompt, extractAnswer, config.model, opts);
        return content;
    }
}

const runExpertOpenAISingle = async (
    expert: ExpertDispatch,
    prompt: string,
    images: ImageState[],
    config: OpenAIAgentConfig,
    abortSignal?: AbortSignal
): Promise<string> => {
    const openaiAI = getOpenAIClient();

    let systemMessage = expert.persona;
    systemMessage += `\nYour response verbosity should be ${config.settings.verbosity}.`;
    if (config.settings.effort === 'high') {
        systemMessage = OPENAI_REASONING_PROMPT_PREFIX + systemMessage;
    }

    const userContent: any = images.length > 0
        ? [
            { type: 'input_text', text: prompt },
            ...images.map(img => ({
                type: 'input_image',
                image_url: { url: `data:${img.file.type};base64,${img.base64}` },
            }))
        ]
        : prompt;

    const response = await callWithRetry(
        () =>
            openaiAI.responses.create(
                {
                    model: expert.model,
                    reasoning: { effort: config.settings.effort },
                    input: [
                        { role: 'system', content: systemMessage },
                        { role: 'user', content: userContent },
                    ],
                },
                { signal: abortSignal }
            ),
        'OpenAI'
    );
    return response.output_text || 'No content received.';
}

const runExpertOpenAIDeepConf = async (
    expert: ExpertDispatch,
    prompt: string,
    images: ImageState[],
    config: OpenAIAgentConfig,
    abortSignal?: AbortSignal
): Promise<string> => {
    const { generationStrategy, traceCount, deepConfEta, tau, groupWindow } = config.settings;

    const provider = createDeepConfTraceProvider(runExpertOpenAISingle, expert, images, config, abortSignal);

    const extractAnswer = (trace: Trace) => trace.text.trim();
    
    const opts = {
        etaPercent: deepConfEta,
        maxBudget: traceCount,
        warmupTraces: Math.min(traceCount, DEFAULTS.warmupTraces),
        tau,
        groupWindow,
    };

    // Use judge-based DeepConf for OpenAI, similar to Gemini, as logprobs are not available.
    if (generationStrategy === 'deepconf-online') {
        const { content } = await deepConfOnlineWithJudge(provider, prompt, extractAnswer, config.model, opts);
        return content;
    } else { // deepconf-offline
        const { content } = await deepConfOfflineWithJudge(provider, prompt, extractAnswer, config.model, opts);
        return content;
    }
};

const runExpertOpenRouterSingle = async (
    expert: ExpertDispatch,
    prompt: string,
    images: ImageState[],
    config: OpenRouterAgentConfig,
    abortSignal?: AbortSignal
): Promise<string> => {
    const openRouterKey = getOpenRouterApiKey();
    if (!openRouterKey) throw new Error("OpenRouter API Key not set.");

    const headers = {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': getAppUrl(),
        'X-Title': 'HeavyOrc',
    };

    const messages: OpenRouterMessage[] = [{ role: 'system', content: expert.persona }];
    if (images.length > 0) {
        const userContent: OpenRouterContentPart[] = [{ type: 'text', text: prompt }];
        images.forEach(img => {
            userContent.push({
                type: 'image_url',
                image_url: { url: `data:${img.file.type};base64,${img.base64}` },
            });
        });
        messages.push({ role: 'user', content: userContent });
    } else {
        messages.push({ role: 'user', content: prompt });
    }

    const body = {
        model: expert.model,
        messages,
        ...config.settings
    };

    const response = await fetchWithRetry(
        'https://openrouter.ai/api/v1/chat/completions',
        {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: abortSignal,
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenRouter API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content || 'No content received.';
};


const runExpert = async (
    expert: ExpertDispatch,
    prompt: string,
    images: ImageState[],
    config: AgentConfig,
    abortSignal?: AbortSignal
): Promise<Draft> => {
    try {
        let content = '';

        if (config.provider === 'gemini') {
            const geminiConfig = config as GeminiAgentConfig;
            if (geminiConfig.settings.generationStrategy === 'single') {
                content = await runExpertGeminiSingle(expert, prompt, images, geminiConfig, abortSignal);
            } else {
                content = await runExpertGeminiDeepConf(expert, prompt, images, geminiConfig, abortSignal);
            }
        } else if (config.provider === 'openai') {
            const openaiConfig = config as OpenAIAgentConfig;
            if (openaiConfig.settings.generationStrategy === 'single') {
                content = await runExpertOpenAISingle(expert, prompt, images, openaiConfig, abortSignal);
            } else {
                content = await runExpertOpenAIDeepConf(expert, prompt, images, openaiConfig, abortSignal);
            }
        } else { // openrouter
             const openRouterConfig = config as OpenRouterAgentConfig;
             // DeepConf is not implemented for OpenRouter in this example, falls back to single
             content = await runExpertOpenRouterSingle(expert, prompt, images, openRouterConfig, abortSignal);
        }

        return {
            agentId: expert.agentId,
            expert,
            content,
            status: 'COMPLETED',
        };

    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw error;
        }
        console.error(`Agent ${config.id} (${expert.provider} - ${expert.name}) failed:`, error);
        let errorMessage = "An unknown error occurred";
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        }
        return {
            agentId: expert.agentId,
            expert,
            content: "This agent failed to generate a response.",
            status: 'FAILED',
            error: errorMessage,
        };
    }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const dispatch = async (
    dispatchedExperts: ExpertDispatch[],
    prompt: string,
    images: ImageState[],
    agentConfigs: AgentConfig[],
    onDraftComplete: (draft: Draft) => void,
    abortSignal?: AbortSignal
): Promise<Draft[]> => {
    const OPENAI_REQUEST_DELAY_MS = 250;

    const expertsWithConfigs = dispatchedExperts.map((expert) => ({ 
        expert, 
        config: agentConfigs.find(c => c.id === expert.agentId)
    })).filter((item): item is { expert: ExpertDispatch, config: AgentConfig } => item.config !== undefined);

    const geminiExperts = expertsWithConfigs.filter(
        (e): e is { expert: ExpertDispatch; config: GeminiAgentConfig } => e.config.provider === 'gemini'
    );
    const openAIExperts = expertsWithConfigs.filter(
        (e): e is { expert: ExpertDispatch; config: OpenAIAgentConfig } => e.config.provider === 'openai'
    );
    const openRouterExperts = expertsWithConfigs.filter(
        (e): e is { expert: ExpertDispatch; config: OpenRouterAgentConfig } => e.config.provider === 'openrouter'
    );

    const draftPromises: Promise<Draft>[] = [];

    // Start all Gemini and OpenRouter experts in parallel
    const parallelExperts = [...geminiExperts, ...openRouterExperts];
    parallelExperts.forEach(({ expert, config }) => {
        const promise = runExpert(expert, prompt, images, config, abortSignal).then(draft => {
            onDraftComplete(draft);
            return draft;
        });
        draftPromises.push(promise);
    });

    try {
        // Run all OpenAI experts sequentially with a delay to avoid rate limits
        for (const { expert, config } of openAIExperts) {
            const promise = runExpert(expert, prompt, images, config, abortSignal).then(draft => {
                onDraftComplete(draft);
                return draft;
            });
            draftPromises.push(promise);
            await promise;
            if (config.settings.generationStrategy === 'single') {
                await delay(OPENAI_REQUEST_DELAY_MS);
            }
        }
        return await Promise.all(draftPromises);
    } finally {
        // Ensure all expert promises settle to avoid unhandled rejections when dispatch is aborted
        await Promise.allSettled(draftPromises);
    }
};
