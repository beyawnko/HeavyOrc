
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
  /**
   * True when the draft content represents a partial response produced before an error occurred.
   * When set, `error` should contain details about the failure that interrupted generation.
   */
  /** Defaults to false; optional for backward compatibility. */
  isPartial?: boolean;
}
