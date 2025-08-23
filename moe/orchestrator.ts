

import { dispatch } from './dispatcher';
import { arbitrateStream } from './arbiter';
import { Draft, ExpertDispatch } from './types';
import { GEMINI_PRO_MODEL } from '../constants';
import { AgentConfig, GeminiThinkingEffort, ImageState } from '../types';

export interface OrchestrationParams {
    prompt: string;
    images: ImageState[];
    agentConfigs: AgentConfig[];
    arbiterModel: string;
    openAIArbiterVerbosity: 'low' | 'medium' | 'high';
    geminiArbiterEffort: GeminiThinkingEffort;
}

export interface OrchestrationCallbacks {
    onInitialAgents: (dispatchedExperts: ExpertDispatch[]) => void;
    onDraftComplete: (draft: Draft) => void;
}

// A simple token estimator. 1 token ~= 4 chars in English.
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);
// Lowered from 300k to 28k to stay under the observed 30k TPM limit for the gpt-5 model.
const ARBITER_TOKEN_THRESHOLD = 28_000; 

export const runOrchestration = async (params: OrchestrationParams, callbacks: OrchestrationCallbacks) => {
    // 1. Map AgentConfigs to ExpertDispatches (routing is now done by the user)
    const dispatchedExperts: ExpertDispatch[] = params.agentConfigs.map(config => ({
        id: config.expert.id,
        name: config.expert.name,
        persona: config.expert.persona,
        provider: config.provider,
        model: config.model,
    }));
    callbacks.onInitialAgents(dispatchedExperts);

    // 2. Dispatch to experts in parallel
    const drafts = await dispatch(dispatchedExperts, params.prompt, params.images, params.agentConfigs, callbacks.onDraftComplete);
    
    // 3. Arbitrate the results
    let finalArbiterModel = params.arbiterModel;
    let switchedArbiter = false;

    const successfulDrafts = drafts.filter(d => d.status === 'COMPLETED');
    if (successfulDrafts.length > 0 && finalArbiterModel.startsWith('gpt-')) {
        const arbiterPrompt = `The original user question is:\n"${params.prompt}"\n\nHere are ${successfulDrafts.length} candidate answers from different expert agents. Please synthesize them into the best possible single answer.\n\n${successfulDrafts
            .map((d, i) => `### Draft from Agent ${i + 1} (Provider: ${d.expert.provider}, Persona: ${d.expert.name})\n${d.content}`)
            .join("\n\n---\n\n")}`;
        
        const estimatedTokens = estimateTokens(arbiterPrompt);
        
        if (estimatedTokens > ARBITER_TOKEN_THRESHOLD) {
            finalArbiterModel = GEMINI_PRO_MODEL; // Switch to Gemini Pro
            switchedArbiter = true;
        }
    }

    const stream = await arbitrateStream(
        finalArbiterModel, 
        params.prompt, 
        drafts, 
        params.openAIArbiterVerbosity,
        params.geminiArbiterEffort
    );

    return { drafts, stream, switchedArbiter };
};