
import { OpenAI } from 'openai';
import { Draft, ExpertDispatch } from './types';
import { geminiAI, getOpenAIClient } from '../services/llmService';
import { GEMINI_FLASH_MODEL, OPENAI_REASONING_PROMPT_PREFIX, OPENAI_AGENT_MODEL } from '../constants';

export interface DispatchConfig {
    enableGeminiThinking: boolean;
    enableOpenAIReasoning: boolean;
}

const runExpert = async (
    expert: ExpertDispatch,
    prompt: string,
    config: DispatchConfig,
    id: number
): Promise<Draft> => {
    try {
        let content = '';
        if (expert.provider === 'gemini') {
            const temperature = 0.5 + id * 0.08;
            const thinkingConfig = expert.model === GEMINI_FLASH_MODEL && !config.enableGeminiThinking
                ? { thinkingBudget: 0 }
                : undefined;

            const response = await geminiAI.models.generateContent({
                model: expert.model,
                contents: prompt,
                config: {
                    systemInstruction: expert.persona,
                    temperature: temperature,
                    thinkingConfig,
                }
            });
            content = response.text;
        } else { // openai
            const openaiAI = getOpenAIClient();
            const systemPersona = config.enableOpenAIReasoning 
                ? OPENAI_REASONING_PROMPT_PREFIX + expert.persona 
                : expert.persona;
            
            // Note: Using the deprecated `chat.completions` for agents as per original logic.
            // This can be updated to `responses.create` if the agent models support it.
            const response = await openaiAI.chat.completions.create({
                model: OPENAI_AGENT_MODEL,
                messages: [
                    { role: 'system', content: systemPersona },
                    { role: 'user', content: prompt }
                ],
            });
            content = response.choices[0].message.content || 'No content received.';
        }

        return {
            expert,
            content,
            status: 'COMPLETED',
        };

    } catch (error) {
        console.error(`Agent ${id} (${expert.provider} - ${expert.name}) failed:`, error);
        let errorMessage = "An unknown error occurred";
        if (error instanceof OpenAI.APIError && error.status === 429) {
            errorMessage = "OpenAI API quota exceeded.";
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return {
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
    config: DispatchConfig,
    onDraftComplete: (draft: Draft) => void
): Promise<Draft[]> => {
    const OPENAI_REQUEST_DELAY_MS = 250;

    const expertsWithIndex = dispatchedExperts.map((expert, index) => ({ expert, index }));
    const geminiExperts = expertsWithIndex.filter(e => e.expert.provider === 'gemini');
    const openAIExperts = expertsWithIndex.filter(e => e.expert.provider === 'openai');

    const draftResults: (Draft | Promise<Draft>)[] = new Array(dispatchedExperts.length);

    // Start all Gemini experts in parallel
    geminiExperts.forEach(({ expert, index }) => {
        const promise = runExpert(expert, prompt, config, index).then(draft => {
            onDraftComplete(draft);
            return draft;
        });
        draftResults[index] = promise;
    });

    // Run all OpenAI experts sequentially with a delay to avoid rate limits
    for (const { expert, index } of openAIExperts) {
        const draft = await runExpert(expert, prompt, config, index);
        onDraftComplete(draft);
        draftResults[index] = draft;
        await delay(OPENAI_REQUEST_DELAY_MS);
    }
    
    return Promise.all(draftResults);
};