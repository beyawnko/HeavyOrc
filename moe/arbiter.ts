

import OpenAI from 'openai';
import { Draft } from './types';
import { geminiAI, getOpenAIClient } from '../services/llmService';
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
    
    if (arbiterModel.startsWith('gpt-')) {
        const openaiAI = getOpenAIClient();
        let systemPersona = arbiterModel === OPENAI_ARBITER_GPT5_HIGH_REASONING 
            ? ARBITER_PERSONA + ARBITER_HIGH_REASONING_PROMPT_MODIFIER
            : ARBITER_PERSONA;
        
        systemPersona += `\nYour final synthesized response should have a verbosity level of: ${arbiterVerbosity}.`;

        try {
            const stream = await openaiAI.chat.completions.create({
                model: OPENAI_ARBITER_MODEL,
                messages: [
                    { role: 'system', content: systemPersona },
                    { role: 'user', content: arbiterPrompt }
                ],
                stream: true,
            });

            async function* transformStream(): AsyncGenerator<{ text: string }> {
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) {
                        yield { text: content };
                    }
                }
            }
            return transformStream();

        } catch (error) {
            console.error("Error calling the OpenAI API for arbiter:", error);
            if (error instanceof OpenAI.APIError) {
                 // Propagate the specific error from OpenAI, which includes rate limit details.
                 throw new Error(error.message);
            }
            if (error instanceof Error) {
                throw new Error(`An error occurred with the OpenAI Arbiter: ${error.message}`);
            }
            throw new Error(`An unknown error occurred while communicating with the OpenAI model for arbitration.`);
        }
    }
    
    // Gemini Logic for the arbiter.
    // 'none' is not valid for Pro model arbiter. Fallback to dynamic if it's somehow passed.
    const effortForPro = geminiArbiterEffort === 'none' ? 'dynamic' : geminiArbiterEffort;
    const budget = GEMINI_PRO_BUDGETS[effortForPro];

    const stream = await geminiAI.models.generateContentStream({
        model: GEMINI_PRO_MODEL, // Arbiter always uses the Pro model for Gemini
        contents: { parts: [{ text: arbiterPrompt }] },
        config: {
            systemInstruction: ARBITER_PERSONA,
            thinkingConfig: { thinkingBudget: budget },
        }
    });

    async function* transformGeminiStream(): AsyncGenerator<{ text: string }> {
        for await (const chunk of stream) {
            yield { text: chunk.text };
        }
    }
    return transformGeminiStream();
};