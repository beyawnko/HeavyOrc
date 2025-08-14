
import React from 'react';
import { AgentState, AgentStatus } from '../types';
import { LoadingSpinner, CheckCircleIcon, XCircleIcon, SparklesIcon } from './icons';

interface AgentCardProps {
  agent: AgentState;
}

const getStatusIndicator = (status: AgentStatus): React.ReactNode => {
    switch (status) {
        case AgentStatus.RUNNING:
            return <LoadingSpinner className="h-5 w-5 text-blue-400 animate-spin" />;
        case AgentStatus.COMPLETED:
            return <CheckCircleIcon className="h-5 w-5 text-green-400" />;
        case AgentStatus.FAILED:
            return <XCircleIcon className="h-5 w-5 text-red-400" />;
        case AgentStatus.PENDING:
        default:
            return <div className="h-5 w-5" />;
    }
};

const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  const { persona, status, content } = agent;

  const borderColor = {
    [AgentStatus.PENDING]: 'border-gray-600',
    [AgentStatus.RUNNING]: 'border-blue-500 animate-pulse',
    [AgentStatus.COMPLETED]: 'border-green-500',
    [AgentStatus.FAILED]: 'border-red-500',
  }[status];

  return (
    <div className={`bg-gray-800/50 border ${borderColor} rounded-lg shadow-lg transition-all duration-300 flex flex-col`}>
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <SparklesIcon className="h-5 w-5 text-purple-400" />
          <h3 className="font-bold text-sm text-gray-200 truncate">Agent {agent.id + 1}</h3>
        </div>
        {getStatusIndicator(status)}
      </div>
      <div className="p-4 flex-grow overflow-y-auto">
        <p className="text-xs text-gray-400 italic mb-3">Persona: {persona}</p>
        <p className="text-sm text-gray-300 whitespace-pre-wrap font-mono">{content || 'Awaiting task...'}</p>
      </div>
    </div>
  );
};

export default AgentCard;
