
import { OpenAI } from 'openai';
import { Draft } from './types';
import { geminiAI, getOpenAIClient } from '../services/llmService';
import {
    ARBITER_PERSONA,
    ARBITER_HIGH_REASONING_PROMPT_MODIFIER,
    OPENAI_ARBITER_GPT5_HIGH_REASONING,
    GEMINI_PRO_MODEL,
} from '../constants';

export const arbitrateStream = async (
    arbiterModel: string,
    prompt: string,
    drafts: Draft[]
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
        const reasoningEffort = arbiterModel === OPENAI_ARBITER_GPT5_HIGH_REASONING ? 'high' : 'medium';
        const systemPersona = arbiterModel === OPENAI_ARBITER_GPT5_HIGH_REASONING 
            ? ARBITER_PERSONA + ARBITER_HIGH_REASONING_PROMPT_MODIFIER
            : ARBITER_PERSONA;
        
        const fullInput = `${systemPersona}\n\n---\n\n${arbiterPrompt}`;
        
        try {
            const response = await (openaiAI as any).responses.create({
                model: "gpt-5",
                input: fullInput,
                reasoning: { effort: reasoningEffort },
            });

            async function* singleResponseStream() {
                const text = (response as any)?.output_text;
                if (text) {
                    yield { text };
                }
            }
            return singleResponseStream();

        } catch (error) {
            console.error("Error calling the OpenAI 'responses' API:", error);
            if (error instanceof OpenAI.APIError && error.status === 429) {
                 throw new Error("You've exceeded your OpenAI API quota. Please check your plan and billing details on the OpenAI website.");
            }
            if (error instanceof Error && (error.message.includes('404') || error.message.toLowerCase().includes('not a function'))) {
                throw new Error("The 'gpt-5' model or the 'responses' API endpoint could not be found. This may be because it is not yet available or your SDK is not up to date.");
            }
            throw new Error(`An error occurred while communicating with the OpenAI GPT-5 model. Please check the console for details.`);
        }
    }
    
    // Gemini Logic for the arbiter.
    return geminiAI.models.generateContentStream({
        model: GEMINI_PRO_MODEL, // Arbiter always uses the Pro model for Gemini
        contents: arbiterPrompt,
        config: {
            systemInstruction: ARBITER_PERSONA,
        }
    });
};