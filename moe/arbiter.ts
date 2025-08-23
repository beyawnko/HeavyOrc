
import { OpenAI } from 'openai';
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

const GEMINI_PRO_BUDGETS: Record<Exclude<GeminiThinkingEffort, 'none'>, number> = {
    low: 4096,
    medium: 16384,
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
        const systemPersona = arbiterModel === OPENAI_ARBITER_GPT5_HIGH_REASONING 
            ? ARBITER_PERSONA + ARBITER_HIGH_REASONING_PROMPT_MODIFIER
            : ARBITER_PERSONA;
        
        const instructions = `${systemPersona}\nYour final synthesized response should have a verbosity level of: ${arbiterVerbosity}.`;

        try {
            const stream: any = await openaiAI.responses.create({
                model: OPENAI_ARBITER_MODEL,
                instructions: instructions,
                input: arbiterPrompt,
                stream: true,
            });

            async function* transformStream(): AsyncGenerator<{ text: string }> {
                for await (const chunk of stream) {
                    // Based on error analysis, the streaming chunk's text appears in `output_text`.
                    const content = chunk.output_text || '';
                    if (content) {
                        yield { text: content };
                    }
                }
            }
            return transformStream();

        } catch (error) {
            console.error("Error calling the OpenAI Responses API for arbiter:", error);
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
    const budget = geminiArbiterEffort === 'none' 
        ? -1 // Default to dynamic for Pro model if 'none' is somehow passed
        : GEMINI_PRO_BUDGETS[geminiArbiterEffort as Exclude<GeminiThinkingEffort, 'none'>];
    const thinkingConfig = { thinkingBudget: budget };

    return geminiAI.models.generateContentStream({
        model: GEMINI_PRO_MODEL, // Arbiter always uses the Pro model for Gemini
        contents: arbiterPrompt,
        config: {
            systemInstruction: ARBITER_PERSONA,
            thinkingConfig
        }
    });
};