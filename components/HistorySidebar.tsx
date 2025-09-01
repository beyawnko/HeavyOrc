
import React, { useState, forwardRef } from 'react';
import { Virtuoso, ListProps } from 'react-virtuoso';
import { RunRecord, RunStatus } from '@/types';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, CheckCircleIcon, XCircleIcon } from '@/components/icons';

type CurrentRunStatus = 'IDLE' | RunStatus;

interface HistorySidebarBaseProps {
  history: RunRecord[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  onNewRun: () => void;
  onViewCurrentRun: () => void;
  currentRunStatus: CurrentRunStatus;
  className?: string;
}

interface MobileHistorySidebarProps extends HistorySidebarBaseProps {
  isMobile: true;
  onClose: () => void;
}

interface DesktopHistorySidebarProps extends HistorySidebarBaseProps {
  isMobile?: false;
  onClose?: never;
}

type HistorySidebarProps = MobileHistorySidebarProps | DesktopHistorySidebarProps;

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
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-2)] animate-pulse" title="In Progress">
                    <span className="sr-only">In Progress</span>
                </div>
            );
        case 'COMPLETED':
            return (
                <div title="Completed">
                    <CheckCircleIcon className="w-4 h-4 text-[var(--success)]" aria-hidden="true" />
                </div>
            );
        case 'FAILED':
            return (
                <div title="Failed">
                    <XCircleIcon className="w-4 h-4 text-[var(--danger)]" aria-hidden="true" />
                </div>
            );
        default:
            return null;
    }
};


const HistorySidebar = forwardRef<HTMLButtonElement, HistorySidebarProps>((props, newRunButtonRef) => {
    const {
        history,
        selectedRunId,
        onSelectRun,
        onNewRun,
        onViewCurrentRun,
        currentRunStatus,
        className,
        isMobile,
    } = props;
    const [isOpen, setIsOpen] = useState(true);

    return (
        <aside
            className={`bg-[var(--surface-2)] border-r border-[var(--line)] flex flex-col transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-16'}${className ? ` ${className}` : ''}${isMobile ? ' z-10' : ''}`}
        >
            <div className="flex-shrink-0 p-2 flex items-center justify-between border-b border-[var(--line)]">
                {isOpen && <h2 className="text-lg font-semibold ml-2">History</h2>}
                {isMobile ? (
                    <button
                        onClick={props.onClose}
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-active)] rounded-lg transition-colors"
                        title="Close History"
                        aria-label="Close History"
                    >
                        <ChevronLeftIcon className="w-6 h-6" aria-hidden="true" />
                    </button>
                ) : (
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-active)] rounded-lg transition-colors"
                        title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                        aria-label={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                    >
                        {isOpen ? <ChevronLeftIcon className="w-6 h-6" aria-hidden="true" /> : <ChevronRightIcon className="w-6 h-6" aria-hidden="true" />}
                    </button>
                )}
            </div>

            <div className="flex-shrink-0 p-2">
                <button
                    ref={newRunButtonRef}
                    id={isMobile ? 'mobile-history-new-run' : undefined}
                    onClick={onNewRun}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                        !selectedRunId ? 'bg-[var(--accent)] text-[#0D1411] hover:brightness-110' : 'bg-[var(--surface-1)] hover:bg-[var(--surface-active)] text-[var(--text)]'
                    }`}
                >
                    <PlusIcon className="w-5 h-5" aria-hidden="true" />
                    {isOpen && <span>New Run</span>}
                </button>
            </div>
            
            <nav className="flex-grow p-2 overflow-hidden">
                {currentRunStatus !== 'IDLE' && (
                    <div className="mb-1">
                        <button
                            onClick={onViewCurrentRun}
                            className={`w-full text-left flex items-center gap-3 p-2 rounded-md transition-colors ${
                                !selectedRunId ? 'bg-[var(--surface-1)]' : 'hover:bg-[var(--surface-active)]'
                            }`}
                            title="View current run"
                            aria-current={!selectedRunId ? 'page' : undefined}
                        >
                            <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                                <StatusIndicator status={currentRunStatus as RunStatus} />
                            </div>
                            {isOpen && (
                                <div className="overflow-hidden">
                                    <p className="text-sm font-medium text-[var(--text)] truncate">Current Run</p>
                                    <p className="text-xs text-[var(--text-muted)] capitalize">{currentRunStatus.replace('_', ' ').toLowerCase()}</p>
                                </div>
                            )}
                        </button>
                    </div>
                )}

                {history.length === 0 && currentRunStatus === 'IDLE' ? (
                    <div className="text-center py-4 text-sm text-[var(--text-muted)]">
                        No past runs yet. Submit a prompt to create one.
                    </div>
                ) : (
                    <Virtuoso
                        data={history}
                        style={{ height: '100%' }}
                        components={{
                            // react-virtuoso's List component is typed for a div; cast to render a semantic <ul>
                            List: forwardRef<HTMLDivElement, ListProps>((props, ref) => (
                                <ul
                                    {...(props as any)}
                                    ref={ref as unknown as React.Ref<HTMLUListElement>}
                                    className="space-y-1"
                                />
                            )),
                            Item: forwardRef<HTMLLIElement, React.ComponentProps<'li'>>((props, ref) => (
                                <li {...props} ref={ref} />
                            )),
                        }}
                        itemContent={(_index: number, run: RunRecord) => (
                            <button
                                onClick={() => onSelectRun(run.id)}
                                className={`w-full text-left flex items-center gap-3 p-2 rounded-md transition-colors ${
                                    selectedRunId === run.id ? 'bg-[var(--surface-1)]' : 'hover:bg-[var(--surface-active)]'
                                }`}
                            >
                                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center mt-0.5">
                                    <StatusIndicator status={run.status} />
                                </div>
                                {isOpen && (
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-medium text-[var(--text)] truncate">{run.prompt || 'Image-based prompt'}</p>
                                        <p className="text-xs text-[var(--text-muted)]">{formatTimestamp(run.timestamp)}</p>
                                    </div>
                                )}
                            </button>
                        )}
                    />
                )}
            </nav>
        </aside>
    );
});

export default HistorySidebar;
