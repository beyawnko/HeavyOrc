
export enum AgentStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface AgentState {
  id: number;
  persona: string;
  status: AgentStatus;
  content: string;
  error: string | null;
}
