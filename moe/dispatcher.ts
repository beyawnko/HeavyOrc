import OpenAI from 'openai';
import { GenerateContentParameters, Part } from "@google/genai";
import { Draft, ExpertDispatch } from './types';
import { getGeminiClient, getOpenAIClient, getOpenRouterApiKey } from '@/services/llmService';
import { GEMINI_PRO_MODEL, GEMINI_FLASH_MODEL, OPENAI_REASONING_PROMPT_PREFIX } from '@/constants';
import { AgentConfig, GeminiAgentConfig, ImageState, OpenAIAgentConfig, GeminiThinkingEffort, OpenRouterAgentConfig } from '@/types';
import {
    Trace,
    DEFAULTS,
    deepConfOnlineWithJudge,
    deepConfOfflineWithJudge,
    TraceProvider
} from '@/services/deepconf';

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

const runExpertGeminiSingle = async (
    expert: ExpertDispatch,
    prompt: string,
    images: ImageState[],
    config: GeminiAgentConfig
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
    const response = await geminiAI.models.generateContent(generateContentParams);
    return response.text ?? '';
}

const runExpertGeminiDeepConf = async (
    expert: ExpertDispatch,
    prompt: string,
    images: ImageState[],
    config: GeminiAgentConfig
): Promise<string> => {
    const { generationStrategy, traceCount, deepConfEta, tau, groupWindow } = config.settings;
    
    const createProvider = (): TraceProvider => {
        return {
            generate: async (p, _abortSignal) => { // p is the prompt string
                // Note: abortSignal is not used by gemini generateContent, but we keep it for API consistency
                const text = await runExpertGeminiSingle(expert, p, images, config);
                // Gemini API doesn't give us steps/tokens, so we create a mock Trace
                const trace: Trace = {
                    text,
                    steps: text.split('').map(char => ({ token: char, topK: [] })), // Mock steps
                };
                return trace;
            }
        };
    };

    const extractAnswer = (trace: Trace) => trace.text.trim();

    const opts = {
        etaPercent: deepConfEta,
        maxBudget: traceCount,
        warmupTraces: Math.min(traceCount, DEFAULTS.warmupTraces),
        tau,
        groupWindow,
    };

    if (generationStrategy === 'deepconf-online') {
        const { content } = await deepConfOnlineWithJudge(createProvider(), prompt, extractAnswer, config.model, opts);
        return content;
    } else { // deepconf-offline
        const { content } = await deepConfOfflineWithJudge(createProvider(), prompt, extractAnswer, config.model, opts);
        return content;
    }
}

const runExpertOpenAISingle = async (
    expert: ExpertDispatch,
    prompt: string,
    images: ImageState[],
    config: OpenAIAgentConfig
): Promise<string> => {
    const openaiAI = getOpenAIClient();
    
    let systemMessage = expert.persona;
    systemMessage += `\nYour response verbosity should be ${config.settings.verbosity}.`;
    if (config.settings.effort === 'high') {
        systemMessage = OPENAI_REASONING_PROMPT_PREFIX + systemMessage;
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: 'system', content: systemMessage }];

    if (images.length > 0) {
        const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: 'text', text: prompt }];
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

    const completion = await openaiAI.chat.completions.create({
        model: expert.model,
        messages: messages,
    });
    return completion.choices[0].message.content || 'No content received.';
}

const runExpertOpenAIDeepConf = async (
    expert: ExpertDispatch,
    prompt: string,
    images: ImageState[],
    config: OpenAIAgentConfig
): Promise<string> => {
    const { generationStrategy, traceCount, deepConfEta, tau, groupWindow } = config.settings;
    
    const createProvider = (): TraceProvider => {
        return {
            generate: async (p, _abortSignal) => { // p is the prompt string
                // Since logprobs are not available, we generate the full text and mock the trace.
                const text = await runExpertOpenAISingle(expert, p, images, config);
                // Mock Trace for judge-based DeepConf
                const trace: Trace = {
                    text,
                    steps: text.split('').map(char => ({ token: char, topK: [] })), // Mock steps
                };
                return trace;
            }
        };
    };

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
        const { content } = await deepConfOnlineWithJudge(createProvider(), prompt, extractAnswer, config.model, opts);
        return content;
    } else { // deepconf-offline
        const { content } = await deepConfOfflineWithJudge(createProvider(), prompt, extractAnswer, config.model, opts);
        return content;
    }
};

const runExpertOpenRouterSingle = async (
    expert: ExpertDispatch,
    prompt: string,
    images: ImageState[],
    config: OpenRouterAgentConfig
): Promise<string> => {
    const openRouterKey = getOpenRouterApiKey();
    if (!openRouterKey) throw new Error("OpenRouter API Key not set.");

    const appUrl = typeof window !== 'undefined'
        ? window.location.origin
        : import.meta.env.VITE_APP_URL ?? '';
    const headers = {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': appUrl,
        'X-Title': 'HeavyOrc',
    };

    const messages: any[] = [{ role: 'system', content: expert.persona }];
     if (images.length > 0) {
        const userContent: any[] = [{ type: 'text', text: prompt }];
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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

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
    config: AgentConfig
): Promise<Draft> => {
    try {
        let content = '';

        if (config.provider === 'gemini') {
            const geminiConfig = config as GeminiAgentConfig;
            if (geminiConfig.settings.generationStrategy === 'single') {
                content = await runExpertGeminiSingle(expert, prompt, images, geminiConfig);
            } else {
                content = await runExpertGeminiDeepConf(expert, prompt, images, geminiConfig);
            }
        } else if (config.provider === 'openai') {
            const openaiConfig = config as OpenAIAgentConfig;
            if (openaiConfig.settings.generationStrategy === 'single') {
                content = await runExpertOpenAISingle(expert, prompt, images, openaiConfig);
            } else {
                content = await runExpertOpenAIDeepConf(expert, prompt, images, openaiConfig);
            }
        } else { // openrouter
             const openRouterConfig = config as OpenRouterAgentConfig;
             // DeepConf is not implemented for OpenRouter in this example, falls back to single
             content = await runExpertOpenRouterSingle(expert, prompt, images, openRouterConfig);
        }

        return {
            agentId: expert.agentId,
            expert,
            content,
            status: 'COMPLETED',
        };

    } catch (error) {
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
    onDraftComplete: (draft: Draft) => void
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
        const promise = runExpert(expert, prompt, images, config).then(draft => {
            onDraftComplete(draft);
            return draft;
        });
        draftPromises.push(promise);
    });

    // Chain all OpenAI experts sequentially with a delay to avoid rate limits
    let openAIPromiseChain = Promise.resolve();
    openAIExperts.forEach(({ expert, config }) => {
        openAIPromiseChain = openAIPromiseChain.then(async () => {
            const promise = runExpert(expert, prompt, images, config).then(draft => {
                onDraftComplete(draft);
                return draft;
            });
            draftPromises.push(promise);
            if (config.settings.generationStrategy === 'single') {
                 await delay(OPENAI_REQUEST_DELAY_MS);
            }
        });
    });
    
    await openAIPromiseChain;

    return Promise.all(draftPromises);
};