
import React, { useState } from 'react';
import { RunRecord, RunStatus } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, CheckCircleIcon, XCircleIcon } from './icons';

type CurrentRunStatus = 'IDLE' | RunStatus;

interface HistorySidebarProps {
  history: RunRecord[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  onNewRun: () => void;
  currentRunStatus: CurrentRunStatus;
}

const formatTimestamp = (timestamp: number): string => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
};

const StatusIndicator: React.FC<{ status: RunStatus }> = ({ status }) => {
    switch (status) {
        case 'IN_PROGRESS':
            return (
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" title="In Progress">
                    <span className="sr-only">In Progress</span>
                </div>
            );
        case 'COMPLETED':
            return (
                <div title="Completed">
                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                </div>
            );
        case 'FAILED':
            return (
                <div title="Failed">
                    <XCircleIcon className="w-4 h-4 text-red-500" />
                </div>
            );
        default:
            return null;
    }
};


const HistorySidebar: React.FC<HistorySidebarProps> = ({ history, selectedRunId, onSelectRun, onNewRun, currentRunStatus }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <aside className={`bg-gray-800/50 border-r border-gray-700 flex flex-col transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-16'}`}>
            <div className="flex-shrink-0 p-2 flex items-center justify-between border-b border-gray-700">
                {isOpen && <h2 className="text-lg font-semibold ml-2">History</h2>}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
                    title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                >
                    {isOpen ? <ChevronLeftIcon className="w-6 h-6" /> : <ChevronRightIcon className="w-6 h-6" />}
                </button>
            </div>

            <div className="flex-shrink-0 p-2">
                <button
                    onClick={onNewRun}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                        !selectedRunId ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                >
                    <PlusIcon className="w-5 h-5" />
                    {isOpen && <span>New Run</span>}
                </button>
            </div>
            
            <nav className="flex-grow p-2 overflow-y-auto">
                <ul className="space-y-1">
                     {currentRunStatus !== 'IDLE' && (
                        <li>
                            <button
                                onClick={() => onNewRun()} // Resets to live view
                                className={`w-full text-left flex items-center gap-3 p-2 rounded-md transition-colors ${
                                    !selectedRunId ? 'bg-gray-700' : 'hover:bg-gray-700/50'
                                }`}
                                title="View current run"
                            >
                                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                                    <StatusIndicator status={currentRunStatus as RunStatus} />
                                </div>
                                {isOpen && (
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-medium text-gray-300 truncate">Current Run</p>
                                        <p className="text-xs text-gray-500 capitalize">{currentRunStatus.replace('_', ' ').toLowerCase()}</p>
                                    </div>
                                )}
                            </button>
                        </li>
                     )}
                    {history.map(run => (
                        <li key={run.id}>
                            <button
                                onClick={() => onSelectRun(run.id)}
                                className={`w-full text-left flex items-center gap-3 p-2 rounded-md transition-colors ${
                                    selectedRunId === run.id ? 'bg-gray-700' : 'hover:bg-gray-700/50'
                                }`}
                                title={run.prompt}
                            >
                               <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center mt-0.5">
                                    <StatusIndicator status={run.status} />
                               </div>
                                {isOpen && (
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-medium text-gray-300 truncate">{run.prompt || "Image-based prompt"}</p>
                                        <p className="text-xs text-gray-500">{formatTimestamp(run.timestamp)}</p>
                                    </div>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
};

export default HistorySidebar;
