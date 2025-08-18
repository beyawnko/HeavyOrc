
import { getExperts } from './experts';
import { ExpertDispatch } from './types';
import { GEMINI_PRO_MODEL, GEMINI_FLASH_MODEL, OPENAI_AGENT_MODEL } from '../constants';
import { ApiProvider } from '../types';

export interface RouteParams {
    totalAgentCount: number;
    geminiAgentCount: number;
    proAgentCount: number;
}

// Simple router that assigns providers and models based on counts.
export const route = (params: RouteParams): ExpertDispatch[] => {
    const selectedExperts = getExperts(params.totalAgentCount);
    
    return selectedExperts.map((expert, i) => {
        const isGemini = i < params.geminiAgentCount;
        const provider: ApiProvider = isGemini ? 'gemini' : 'openai';
        const model = isGemini 
            ? (i < params.proAgentCount ? GEMINI_PRO_MODEL : GEMINI_FLASH_MODEL)
            : OPENAI_AGENT_MODEL;

        return {
            ...expert,
            provider,
            model,
        };
    });
};
