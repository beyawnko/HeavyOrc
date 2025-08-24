import OpenAI from 'openai';
import { Draft } from './types';
import { getGeminiClient, getOpenAIClient, getOpenRouterApiKey } from '../services/llmService';
import { extractGeminiText } from '../lib/gemini';
import {
    ARBITER_PERSONA,
    ARBITER_HIGH_REASONING_PROMPT_MODIFIER,
    OPENAI_ARBITER_GPT5_HIGH_REASONING,
    GEMINI_PRO_MODEL,
    OPENAI_ARBITER_MODEL,
} from '../constants';
import { GeminiThinkingEffort } from '../types';

const GEMINI_PRO_BUDGETS: Record<Extract<GeminiThinkingEffort, 'low' | 'medium' | 'high' | 'dynamic'>, number> = {
    low: 8192,
    medium: 24576,
    high: 32768,
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
            'HTTP-Referer': 'https://gemini-heavy-orchestrator.web.app',
            'X-Title': 'Gemini Heavy Orchestrator',
        };
        const messages = [
            { role: 'system', content: ARBITER_PERSONA },
            { role: 'user', content: arbiterPrompt },
        ];
        const body = { model: arbiterModel, messages, stream: true };

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok || !response.body) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenRouter API Error: ${errorData.error?.message || response.statusText}`);
        }
        
        return openRouterStreamer(response.body);
    }
    
    // OpenAI Logic
    if (arbiterModel.startsWith('gpt-')) {
        const openaiAI = getOpenAIClient();
        let systemPersona = arbiterModel === OPENAI_ARBITER_GPT5_HIGH_REASONING
            ? ARBITER_PERSONA + ARBITER_HIGH_REASONING_PROMPT_MODIFIER
            : ARBITER_PERSONA;
        
        systemPersona += `\nYour final synthesized response should have a verbosity level of: ${arbiterVerbosity}.`;

        const inputPrompt = `${systemPersona}\n\n${arbiterPrompt}`;
        const effort = arbiterModel === OPENAI_ARBITER_GPT5_HIGH_REASONING ? 'high' : 'medium';

        try {
            const stream = await (openaiAI as any).responses.create({
                model: OPENAI_ARBITER_MODEL,
                input: inputPrompt,
                reasoning: { effort },
                stream: true,
            });

            async function* transformStream(): AsyncGenerator<{ text: string }> {
                for await (const chunk of stream) {
                    const content = chunk.text || '';
                    if (content) {
                        yield { text: content };
                    }
                }
            }
            return transformStream();

        } catch (error) {
            console.error("Error calling the OpenAI API for arbiter:", error);
            if (error instanceof OpenAI.APIError) {
                 throw new Error(error.message);
            }
            if (error instanceof Error) {
                throw new Error(`An error occurred with the OpenAI Arbiter: ${error.message}`);
            }
            throw new Error(`An unknown error occurred while communicating with the OpenAI model for arbitration.`);
        }
    }
    
    // Gemini Logic for the arbiter.
    const effortForPro = geminiArbiterEffort === 'none' ? 'dynamic' : geminiArbiterEffort;
    const budget = GEMINI_PRO_BUDGETS[effortForPro];

    const geminiAI = getGeminiClient();
    try {
        const { stream } = await geminiAI.models.generateContentStream({
            model: GEMINI_PRO_MODEL, // Arbiter always uses the Pro model for Gemini
            contents: { parts: [{ text: arbiterPrompt }] },
            config: {
                systemInstruction: ARBITER_PERSONA,
                thinkingConfig: { thinkingBudget: budget },
            }
        });

        async function* transformGeminiStream(): AsyncGenerator<{ text: string }> {
            for await (const chunk of stream) {
                const content = extractGeminiText(chunk);
                if (content) {
                    yield { text: content };
                }
            }
        }
        return transformGeminiStream();
    } catch (error) {
        console.error("Error calling the Gemini API for arbiter:", error);
        if (error instanceof Error) {
            throw new Error(`An error occurred with the Gemini Arbiter: ${error.message}`);
        }
        throw new Error(`An unknown error occurred while communicating with the Gemini model for arbitration.`);
    }
};
