import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AGENT_PERSONAS, ARBITER_PERSONA } from '../constants';
import { AgentState, AgentStatus } from '../types';
import { getApiKey } from "../lib/env";

let ai: GoogleGenAI | null = null;

const getClient = (): GoogleGenAI => {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: getApiKey() });
    }
    return ai;
};

export const generateDrafts = async (
  prompt: string, 
  agents: AgentState[],
  onDraftComplete: (completedAgent: AgentState) => void
): Promise<AgentState[]> => {
    const client = getClient();
    
    const draftPromises = agents.map(agent => {
        const temperature = 0.5 + agent.id * 0.08; // Diversify temperature
        return client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: agent.persona,
                temperature: temperature,
            }
        }).then(response => {
            const completedAgent: AgentState = {
                ...agent,
                status: AgentStatus.COMPLETED,
                content: response.text,
            };
            onDraftComplete(completedAgent);
            return completedAgent;
        }).catch(error => {
            console.error(`Agent ${agent.id} failed:`, error);
            const failedAgent: AgentState = {
                ...agent,
                status: AgentStatus.FAILED,
                content: "This agent failed to generate a response.",
                error: error instanceof Error ? error.message : "An unknown error occurred",
            };
            onDraftComplete(failedAgent);
            return failedAgent;
        });
    });

    return Promise.all(draftPromises);
};


export const generateFinalAnswerStream = (
    prompt: string,
    drafts: AgentState[]
): Promise<AsyncGenerator<GenerateContentResponse>> => {
    const client = getClient();

    const successfulDrafts = drafts.filter(d => d.status === AgentStatus.COMPLETED);

    if (successfulDrafts.length === 0) {
        throw new Error("All agents failed to produce a draft. Cannot generate a final answer.");
    }
    
    const arbiterPrompt = `The original user question is:\n"${prompt}"\n\nHere are ${successfulDrafts.length} candidate answers from different expert agents. Please synthesize them into the best possible single answer.\n\n${successfulDrafts
        .map((d, i) => `### Draft from Agent ${String.fromCharCode(65 + i)} (Persona: ${d.persona})\n${d.content}`)
        .join("\n\n---\n\n")}`;

    return client.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: arbiterPrompt,
        config: {
            systemInstruction: ARBITER_PERSONA,
        }
    });
};