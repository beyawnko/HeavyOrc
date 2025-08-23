

import { OpenAI } from 'openai';
import { Draft, ExpertDispatch } from './types';
import { geminiAI, getOpenAIClient } from '../services/llmService';
import { GEMINI_PRO_MODEL } from '../constants';
import { AgentConfig, GeminiAgentConfig, ImageState, OpenAIAgentConfig, GeminiThinkingEffort } from '../types';


const GEMINI_FLASH_BUDGETS: Record<Extract<GeminiThinkingEffort, 'none' | 'low' | 'medium' | 'high' | 'dynamic'>, number> = {
    none: 0,
    low: 4096,
    medium: 12288,
    high: 24576,
    dynamic: -1,
};

const GEMINI_PRO_BUDGETS: Record<Exclude<GeminiThinkingEffort, 'none'>, number> = {
    low: 4096,
    medium: 16384,
    high: 32768,
    dynamic: -1,
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
            const isProModel = geminiConfig.model === GEMINI_PRO_MODEL;
            let budget: number;

            if (isProModel) {
                if (geminiConfig.settings.effort === 'none') {
                    console.warn(`Attempted to use 'none' effort for Gemini Pro agent ${config.id}, which is not supported. Defaulting to 'dynamic'.`);
                    budget = -1;
                } else {
                    budget = GEMINI_PRO_BUDGETS[geminiConfig.settings.effort as Exclude<GeminiThinkingEffort, 'none'>];
                }
            } else { // Flash model
                budget = GEMINI_FLASH_BUDGETS[geminiConfig.settings.effort];
            }
            
            const thinkingConfig = { thinkingBudget: budget };

            const parts: any[] = [{ text: prompt }];
            images.forEach(img => {
                parts.push({
                    inlineData: {
                        mimeType: img.file.type,
                        data: img.base64,
                    },
                });
            });

            const response = await geminiAI.models.generateContent({
                model: expert.model,
                contents: { parts },
                config: {
                    systemInstruction: expert.persona,
                    temperature: 0.5 + Math.random() * 0.2, // Add some randomness
                    thinkingConfig,
                }
            });
            content = response.text;
        } else { // openai
            const openaiConfig = config as OpenAIAgentConfig;
            const openaiAI = getOpenAIClient();
            
            let instructions = expert.persona;
            instructions += `\nYour response verbosity should be ${openaiConfig.settings.verbosity}.`;

            let inputPayload: string | any[];

            if (images.length > 0) {
                const userContentParts: any[] = [{ type: 'input_text', text: prompt }];
                images.forEach(img => {
                    userContentParts.push({
                        type: 'input_image',
                        image_url: `data:${img.file.type};base64,${img.base64}`,
                    });
                });
                
                inputPayload = [{ role: 'user', content: userContentParts }];
            } else {
                inputPayload = prompt;
            }

            // The type for response is unknown from the provided docs, so we cast to any.
            // Based on error analysis, the text content appears in `output_text`.
            const completion: any = await openaiAI.responses.create({
                model: expert.model,
                instructions: instructions,
                input: inputPayload,
                reasoning: {
                    effort: openaiConfig.settings.effort
                }
            });
            content = completion.output_text || 'No content received.';
        }

        return {
            expert,
            content,
            status: 'COMPLETED',
        };

    } catch (error) {
        console.error(`Agent ${config.id} (${expert.provider} - ${expert.name}) failed:`, error);
        let errorMessage = "An unknown error occurred";
        if (error instanceof Error) {
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
    images: ImageState[],
    agentConfigs: AgentConfig[],
    onDraftComplete: (draft: Draft) => void
): Promise<Draft[]> => {
    const OPENAI_REQUEST_DELAY_MS = 250;

    const expertsWithConfigs = dispatchedExperts.map((expert, index) => ({ 
        expert, 
        config: agentConfigs[index] 
    }));

    const geminiExperts = expertsWithConfigs.filter(e => e.expert.provider === 'gemini');
    const openAIExperts = expertsWithConfigs.filter(e => e.expert.provider === 'openai');

    const draftPromises: Promise<Draft>[] = [];

    // Start all Gemini experts in parallel
    geminiExperts.forEach(({ expert, config }) => {
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
            await delay(OPENAI_REQUEST_DELAY_MS);
        });
    });
    
    await openAIPromiseChain;

    return Promise.all(draftPromises);
};