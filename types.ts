


export type ApiProvider = 'gemini' | 'openai';
export type AgentStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface AgentState {
  id: number;
  persona: string;
  status: AgentStatus;
  content: string;
  error: string | null;
  model: string;
  provider: ApiProvider;
}