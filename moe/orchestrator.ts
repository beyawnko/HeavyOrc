


import { dispatch } from './dispatcher';
import { arbitrateStream } from './arbiter';
import { Draft, ExpertDispatch } from './types';
import { GEMINI_PRO_MODEL } from '@/constants';
import { AgentConfig, GeminiThinkingEffort, ImageState, OpenAIReasoningEffort } from '@/types';
// @ts-ignore - WASM init default export has no types
import init, { Tiktoken } from '@dqbd/tiktoken/lite/init';
import wasm from '@dqbd/tiktoken/lite/tiktoken_bg.wasm?url';
// @ts-ignore - JSON import for encoder ranks
import model from '@dqbd/tiktoken/encoders/cl100k_base.json';

export interface OrchestrationParams {
    prompt: string;
    images: ImageState[];
    agentConfigs: AgentConfig[];
    arbiterModel: string;
    openAIArbiterVerbosity: 'low' | 'medium' | 'high';
    openAIArbiterEffort: OpenAIReasoningEffort;
    geminiArbiterEffort: GeminiThinkingEffort;
}

export interface OrchestrationCallbacks {
    onInitialAgents: (dispatchedExperts: ExpertDispatch[]) => void;
    onDraftComplete: (draft: Draft) => void;
}

// More accurate token estimator using tiktoken's cl100k_base encoding
let encoderPromise: Promise<Tiktoken> | null = null;
const loadEncoder = () => {
    if (!encoderPromise) {
        encoderPromise = (async () => {
            // @ts-ignore - init is untyped
            await init(async (imports: WebAssembly.Imports) => {
                const response = await fetch(wasm);
                const bytes = await response.arrayBuffer();
                return WebAssembly.instantiate(bytes, imports);
            });
            return new Tiktoken(model.bpe_ranks, model.special_tokens, model.pat_str);
        })();
    }
    return encoderPromise;
};
const estimateTokens = async (text: string): Promise<number> => (await loadEncoder()).encode(text).length;
// Lowered from 300k to 28k to stay under the observed 30k TPM limit for the gpt-5 model.
const ARBITER_TOKEN_THRESHOLD = 28_000; 

export const runOrchestration = async (params: OrchestrationParams, callbacks: OrchestrationCallbacks) => {
    // 1. Map AgentConfigs to ExpertDispatches (routing is now done by the user)
    const dispatchedExperts: ExpertDispatch[] = params.agentConfigs.map(config => ({
        agentId: config.id,
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
    const isGptModel = finalArbiterModel.startsWith('gpt-');
    const isOpenRouterModel = finalArbiterModel.includes('/');

    if (successfulDrafts.length > 0 && (isGptModel || isOpenRouterModel)) {
        const arbiterPrompt = `The original user question is:\n"${params.prompt}"\n\nHere are ${successfulDrafts.length} candidate answers from different expert agents. Please synthesize them into the best possible single answer.\n\n${successfulDrafts
            .map((d, i) => `### Draft from Agent ${i + 1} (Provider: ${d.expert.provider}, Persona: ${d.expert.name})\n${d.content}`)
            .join("\n\n---\n\n")}`;
        
        const estimatedTokens = await estimateTokens(arbiterPrompt);
        
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
        params.openAIArbiterEffort,
        params.geminiArbiterEffort
    );

    return { drafts, stream, switchedArbiter };
};
