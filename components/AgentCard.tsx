import React, { useId } from 'react';
import { AgentState, AgentStatus } from '@/types';
import { getExpertColor } from '@/lib/colors';
import {
    LoadingSpinner,
    CheckCircleIcon,
    XCircleIcon,
    SparklesIcon,
    EllipsisHorizontalIcon,
    ChevronUpIcon,
    ChevronDownIcon
} from '@/components/icons';

interface AgentCardProps {
  agent: AgentState;
  displayId: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const getStatusIndicator = (status: AgentStatus): React.ReactNode => {
    switch (status) {
        case 'RUNNING':
            return <><LoadingSpinner className="h-5 w-5 text-[var(--accent-2)] animate-spin" /><span className="sr-only">Running</span></>;
        case 'COMPLETED':
            return <><CheckCircleIcon className="h-5 w-5 text-success" /><span className="sr-only">Completed</span></>;
        case 'FAILED':
            return <><XCircleIcon className="h-5 w-5 text-danger" /><span className="sr-only">Failed</span></>;
        case 'PENDING':
        default:
            return <><EllipsisHorizontalIcon className="h-5 w-5 text-[var(--text-muted)]" /><span className="sr-only">Pending</span></>;
    }
};

const getBorderColor = (status: AgentStatus): string => {
    switch(status) {
        case 'RUNNING':
            return 'border-[var(--accent-2)] animate-pulse';
        case 'COMPLETED':
            return 'border-success';
        case 'FAILED':
            return 'border-danger';
        case 'PENDING':
        default:
            return 'border-[var(--line)]';
    }
};

const getProviderChipStyle = (provider: AgentState['provider']): string => {
    switch (provider) {
        case 'gemini':
            return 'bg-[var(--accent)] text-[#0D1411]';
        case 'openai':
            return 'bg-[var(--accent-2)] text-[#0D1411]';
        case 'openrouter':
            return 'bg-success text-[#0D1411]';
        default:
            return 'bg-[var(--surface-1)] text-[var(--text)]';
    }
};

const AgentCard: React.FC<AgentCardProps> = ({ agent, displayId, isCollapsed, onToggleCollapse }) => {
  const { persona, status, content, provider } = agent;
  const contentId = useId();

  const isCollapsible = status === 'COMPLETED' || status === 'FAILED';

  const borderColor = getBorderColor(status);
  const expertColor = getExpertColor(displayId);

  return (
    <div className={`bg-[var(--surface-2)] border ${borderColor} rounded-lg shadow-lg transition-all duration-300 flex flex-col`}>
      <div className="p-4 border-b border-[var(--line)] flex justify-between items-center gap-2">
        <div className="flex items-center space-x-3 overflow-hidden">
          <SparklesIcon className="h-5 w-5 flex-shrink-0" style={{ color: expertColor }} aria-hidden="true" />
          <h3 className="font-bold text-sm text-[var(--text)] truncate">Agent {displayId}</h3>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${getProviderChipStyle(provider)}`}>
              {provider}
          </span>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
            {getStatusIndicator(status)}
            {isCollapsible && (
                <button
                    onClick={onToggleCollapse}
                    className="p-1 rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-active)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    aria-expanded={!isCollapsed}
                    aria-controls={contentId}
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                    {isCollapsed ? (
                        <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                    ) : (
                        <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span className="sr-only">{isCollapsed ? 'Expand card' : 'Collapse card'}</span>
                </button>
            )}
        </div>
      </div>
      <div
        id={contentId}
        className={`overflow-y-auto transition-all duration-500 ease-in-out ${isCollapsed ? 'max-h-0' : 'max-h-[500px]'}`}
      >
        <div className="p-4">
            <p className="text-xs text-[var(--text-muted)] italic mb-3">Persona: {persona}</p>
            <p className="text-sm text-[var(--text)] whitespace-pre-wrap font-mono">{content || 'Awaiting task...'}</p>
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
