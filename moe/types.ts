
import { ApiProvider, AgentStatus, Expert } from '@/types';

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
  isPartial?: boolean;
}