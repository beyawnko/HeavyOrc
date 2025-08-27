import OpenAI from 'openai';
import { Draft } from './types';
import { getGeminiClient, getOpenAIClient, getOpenRouterApiKey, fetchWithRetry, callWithRetry } from '@/services/llmService';
import { getAppUrl, getGeminiResponseText } from '@/lib/utils';
import {
    ARBITER_PERSONA,
    ARBITER_HIGH_REASONING_PROMPT_MODIFIER,
    OPENAI_ARBITER_GPT5_HIGH_REASONING,
    OPENAI_ARBITER_GPT5_MEDIUM_REASONING,
    GEMINI_PRO_MODEL,
    GEMINI_FLASH_MODEL,
    OPENAI_ARBITER_MODEL,
    OPENAI_REASONING_PROMPT_PREFIX,
} from '@/constants';
import { GeminiThinkingEffort } from '@/types';
import { callWithGeminiRetry, handleGeminiError } from '@/services/geminiUtils';

const GEMINI_PRO_BUDGETS: Record<Extract<GeminiThinkingEffort, 'low' | 'medium' | 'high' | 'dynamic'>, number> = {
    low: 8192,
    medium: 24576,
    high: 32768,
    dynamic: -1,
};

const GEMINI_FLASH_BUDGETS: Record<GeminiThinkingEffort, number> = {
    none: 0,
    low: 4096,
    medium: 12288,
    high: 24576,
    dynamic: -1,
};

async function* openRouterStreamer(stream: ReadableStream<Uint8Array>): AsyncGenerator<{ text: string }> {
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n\n");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.substring(6);
                    if (data.trim() === "[DONE]") {
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const text = parsed.choices[0]?.delta?.content || "";
                        if (text) {
                            yield { text };
                        }
                    } catch (error) {
                        console.error("Error parsing OpenRouter stream chunk:", error, "Chunk:", data);
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

export const arbitrateStream = async (
    arbiterModel: string,
    prompt: string,
    drafts: Draft[],
    arbiterVerbosity: 'low' | 'medium' | 'high',
    geminiArbiterEffort: GeminiThinkingEffort
): Promise<AsyncGenerator<{ text: string }>> => {
    const successfulDrafts = drafts.filter(d => d.status === 'COMPLETED');

    if (successfulDrafts.length === 0) {
        throw new Error("All agents failed to produce a draft. Cannot generate a final answer.");
    }
    
    const arbiterPrompt = `The original user question is:\n"${prompt}"\n\nHere are ${successfulDrafts.length} candidate answers from different expert agents. Please synthesize them into the best possible single answer.\n\n${successfulDrafts
        .map((d, i) => `### Draft from Agent ${i + 1} (Provider: ${d.expert.provider}, Persona: ${d.expert.name})\n${d.content}`)
        .join("\n\n---\n\n")}`;
    
    // OpenRouter Logic
    if (arbiterModel.includes('/')) {
        const openRouterKey = getOpenRouterApiKey();
        if (!openRouterKey) throw new Error("OpenRouter API Key not set.");
        
        const headers = {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': getAppUrl(),
            'X-Title': 'HeavyOrc',
        };
        const messages = [
            { role: 'system', content: ARBITER_PERSONA },
            { role: 'user', content: arbiterPrompt },
        ];
        const body = { model: arbiterModel, messages, stream: true };

        try {
            const response = await fetchWithRetry(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                },
                'OpenRouter'
            );

            if (!response.ok || !response.body) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenRouter API Error: ${errorData.error?.message || response.statusText}`);
            }

            return openRouterStreamer(response.body);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('OpenRouter request failed.');
        }
    }

    // OpenAI Logic
    if (arbiterModel.startsWith('gpt-')) {
        const openaiAI = getOpenAIClient();

        let systemPersona = ARBITER_PERSONA;
        if (arbiterModel === OPENAI_ARBITER_GPT5_HIGH_REASONING) {
            systemPersona = OPENAI_REASONING_PROMPT_PREFIX + systemPersona + ARBITER_HIGH_REASONING_PROMPT_MODIFIER;
        }
        systemPersona += `\nYour final synthesized response should have a verbosity level of: ${arbiterVerbosity}.`;

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPersona },
            { role: 'user', content: arbiterPrompt },
        ];

        const model = (arbiterModel === OPENAI_ARBITER_GPT5_MEDIUM_REASONING || arbiterModel === OPENAI_ARBITER_GPT5_HIGH_REASONING)
            ? OPENAI_ARBITER_MODEL
            : arbiterModel;

        try {
            const stream = await callWithRetry(
                () => openaiAI.chat.completions.create({ model, messages, stream: true }),
                'OpenAI'
            );

            async function* transformStream(): AsyncGenerator<{ text: string }> {
                for await (const chunk of stream) {
                    const text = chunk.choices[0]?.delta?.content;
                    if (text) {
                        yield { text };
                    }
                }
            }
            return transformStream();
        } catch (error) {
            console.error("Error calling the OpenAI API for arbiter:", error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('An unknown error occurred while communicating with the OpenAI model for arbitration.');
        }
    }

    // Gemini Logic for the arbiter.
    const model = arbiterModel === GEMINI_FLASH_MODEL ? GEMINI_FLASH_MODEL : GEMINI_PRO_MODEL;
    const budgets = model === GEMINI_FLASH_MODEL ? GEMINI_FLASH_BUDGETS : GEMINI_PRO_BUDGETS;
    const effortKey = model === GEMINI_PRO_MODEL && geminiArbiterEffort === 'none' ? 'dynamic' : geminiArbiterEffort;
    const budget = budgets[effortKey];

    const geminiAI = getGeminiClient();
    try {
        const stream = await callWithGeminiRetry(() =>
            geminiAI.models.generateContentStream({
                model,
                contents: { parts: [{ text: arbiterPrompt }] },
                config: {
                    systemInstruction: ARBITER_PERSONA,
                    thinkingConfig: { thinkingBudget: budget },
                }
            })
        );

        async function* transformGeminiStream(): AsyncGenerator<{ text: string }> {
            for await (const chunk of stream) {
                yield { text: getGeminiResponseText(chunk) };
            }
        }
        return transformGeminiStream();
    } catch (error) {
        return handleGeminiError(error, 'arbiter', 'arbitration');
    }
};
