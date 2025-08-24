import React, { useState, useId } from 'react';
import { AgentState, AgentStatus } from '../types';
import { 
    LoadingSpinner, 
    CheckCircleIcon, 
    XCircleIcon, 
    SparklesIcon, 
    EllipsisHorizontalIcon,
    ChevronUpIcon,
    ChevronDownIcon
} from './icons';

interface AgentCardProps {
  agent: AgentState;
  displayId: number;
}

const getStatusIndicator = (status: AgentStatus): React.ReactNode => {
    switch (status) {
        case 'RUNNING':
            return <><LoadingSpinner className="h-5 w-5 text-blue-400 animate-spin" /><span className="sr-only">Running</span></>;
        case 'COMPLETED':
            return <><CheckCircleIcon className="h-5 w-5 text-green-400" /><span className="sr-only">Completed</span></>;
        case 'FAILED':
            return <><XCircleIcon className="h-5 w-5 text-red-400" /><span className="sr-only">Failed</span></>;
        case 'PENDING':
        default:
            return <><EllipsisHorizontalIcon className="h-5 w-5 text-gray-500" /><span className="sr-only">Pending</span></>;
    }
};

const getBorderColor = (status: AgentStatus): string => {
    switch(status) {
        case 'RUNNING':
            return 'border-blue-500 animate-pulse';
        case 'COMPLETED':
            return 'border-green-500';
        case 'FAILED':
            return 'border-red-500';
        case 'PENDING':
        default:
            return 'border-gray-600';
    }
}

const getProviderChipStyle = (provider: AgentState['provider']): string => {
    switch (provider) {
        case 'gemini':
            return 'bg-purple-800 text-purple-200';
        case 'openai':
            return 'bg-teal-800 text-teal-200';
        case 'openrouter':
            return 'bg-cyan-800 text-cyan-200';
        default:
            return 'bg-gray-700 text-gray-200';
    }
};

const AgentCard: React.FC<AgentCardProps> = ({ agent, displayId }) => {
  const { persona, status, content, provider } = agent;
  const contentId = useId();

  const isCollapsible = status === 'COMPLETED' || status === 'FAILED';
  const [isCollapsed, setIsCollapsed] = useState(false);

  const borderColor = getBorderColor(status);

  return (
    <div className={`bg-gray-800/50 border ${borderColor} rounded-lg shadow-lg transition-all duration-300 flex flex-col`}>
      <div className="p-4 border-b border-gray-700 flex justify-between items-center gap-2">
        <div className="flex items-center space-x-3 overflow-hidden">
          <SparklesIcon className="h-5 w-5 text-purple-400 flex-shrink-0" />
          <h3 className="font-bold text-sm text-gray-200 truncate">Agent {displayId}</h3>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${getProviderChipStyle(provider)}`}>
              {provider}
          </span>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
            {getStatusIndicator(status)}
            {isCollapsible && (
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-expanded={!isCollapsed}
                    aria-controls={contentId}
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                    {isCollapsed ? (
                        <ChevronDownIcon className="h-5 w-5" />
                    ) : (
                        <ChevronUpIcon className="h-5 w-5" />
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
            <p className="text-xs text-gray-400 italic mb-3">Persona: {persona}</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap font-mono">{content || 'Awaiting task...'}</p>
        </div>
      </div>
    </div>
  );
};

export default AgentCard;