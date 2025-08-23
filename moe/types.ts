
import { ApiProvider, AgentStatus } from '../types';

export interface Expert {
  id: string;
  name: string;
  persona: string;
}

export interface ExpertDispatch extends Expert {
  agentId: string;
  provider: ApiProvider;
  model: string;
}

export interface Draft {
  agentId: string;
  expert: ExpertDispatch;
  content: string;
  status: AgentStatus;
  error?: string | null;
}