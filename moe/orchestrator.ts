
import { route, RouteParams } from './router';
import { dispatch, DispatchConfig } from './dispatcher';
import { arbitrateStream } from './arbiter';
import { Draft, ExpertDispatch } from './types';

export interface OrchestrationParams extends RouteParams, DispatchConfig {
    prompt: string;
    arbiterModel: string;
}

export interface OrchestrationCallbacks {
    onInitialAgents: (dispatchedExperts: ExpertDispatch[]) => void;
    onDraftComplete: (draft: Draft) => void;
}

export const runOrchestration = async (params: OrchestrationParams, callbacks: OrchestrationCallbacks) => {
    // 1. Route to get dispatched experts
    const dispatchedExperts = route({
        totalAgentCount: params.totalAgentCount,
        geminiAgentCount: params.geminiAgentCount,
        proAgentCount: params.proAgentCount,
    });
    callbacks.onInitialAgents(dispatchedExperts);

    // 2. Dispatch to experts in parallel
    const draftConfig = {
        enableGeminiThinking: params.enableGeminiThinking,
        enableOpenAIReasoning: params.enableOpenAIReasoning,
    };
    const drafts = await dispatch(dispatchedExperts, params.prompt, draftConfig, callbacks.onDraftComplete);
    
    // 3. Arbitrate the results
    const stream = await arbitrateStream(params.arbiterModel, params.prompt, drafts);

    return { drafts, stream };
};
