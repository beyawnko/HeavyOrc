

import React, { useState, useEffect, useRef } from 'react';
import { 
    DownloadIcon, 
    UploadIcon,
    ChevronLeftIcon,
    KeyIcon,
    ClockIcon,
    DocumentDuplicateIcon,
    XMarkIcon
} from './icons';

// --- SECTION DEFINITIONS ---

type SectionId = 'api-keys' | 'session' | 'history';

interface Section {
    id: SectionId;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    description: string;
}

const sections: Section[] = [
    { 
        id: 'api-keys', 
        label: 'API Keys', 
        icon: KeyIcon,
        description: "Manage your API keys. They're stored in your browser and never sent to our servers." 
    },
    { 
        id: 'session', 
        label: 'Session Management', 
        icon: DocumentDuplicateIcon,
        description: 'Save your current settings, API key, and query history to a file, or load a previous session.' 
    },
    { 
        id: 'history', 
        label: 'Query History', 
        icon: ClockIcon,
        description: 'Review and reuse your most recent prompts.'
    },
];

// --- PROPS & COMPONENT INTERFACE ---

interface SettingsViewProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveOpenAIApiKey: (apiKey: string) => void;
    currentOpenAIApiKey: string;
    onSaveGeminiApiKey: (apiKey: string) => void;
    currentGeminiApiKey: string;
    onSaveOpenRouterApiKey: (apiKey: string) => void;
    currentOpenRouterApiKey: string;
    onSaveSession: () => void;
    onLoadSession: (file: File) => void;
    queryHistory: string[];
    onSelectQuery: (query: string) => void;
}

// --- SECTION CONTENT COMPONENTS ---

const ApiKeySection: React.FC<Pick<SettingsViewProps, 'currentOpenAIApiKey' | 'onSaveOpenAIApiKey' | 'currentGeminiApiKey' | 'onSaveGeminiApiKey' | 'currentOpenRouterApiKey' | 'onSaveOpenRouterApiKey'>> = ({ 
    currentOpenAIApiKey, 
    onSaveOpenAIApiKey,
    currentGeminiApiKey,
    onSaveGeminiApiKey,
    currentOpenRouterApiKey,
    onSaveOpenRouterApiKey
}) => {
    const [openAIKey, setOpenAIKey] = useState(currentOpenAIApiKey);
    const [geminiKey, setGeminiKey] = useState(currentGeminiApiKey);
    const [openRouterKey, setOpenRouterKey] = useState(currentOpenRouterApiKey);

    useEffect(() => { setOpenAIKey(currentOpenAIApiKey); }, [currentOpenAIApiKey]);
    useEffect(() => { setGeminiKey(currentGeminiApiKey); }, [currentGeminiApiKey]);
    useEffect(() => { setOpenRouterKey(currentOpenRouterApiKey); }, [currentOpenRouterApiKey]);

    const handleSaveOpenAI = () => onSaveOpenAIApiKey(openAIKey);
    const handleSaveGemini = () => onSaveGeminiApiKey(geminiKey);
    const handleSaveOpenRouter = () => onSaveOpenRouterApiKey(openRouterKey);

    return (
        <div className="space-y-6">
            <div>
                <label htmlFor="openai-api-key" className="block text-sm font-medium text-[var(--text)] mb-2">
                    OpenAI API Key
                </label>
                <div className="flex gap-2">
                    <input
                        id="openai-api-key"
                        type="password"
                        value={openAIKey}
                        onChange={(e) => setOpenAIKey(e.target.value)}
                        placeholder="sk-..."
                        className="flex-grow p-2 bg-[var(--surface-1)] border border-[var(--line)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
                    />
                    <button
                        onClick={handleSaveOpenAI}
                        type="button"
                        className="px-4 py-2 bg-[var(--accent)] text-[#0D1411] font-semibold rounded-lg shadow-md hover:brightness-110 disabled:bg-[var(--surface-1)] disabled:text-[var(--text-muted)] transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
            
            <div>
                <label htmlFor="gemini-api-key" className="block text-sm font-medium text-[var(--text)] mb-2">
                    Google Gemini API Key
                </label>
                <div className="flex gap-2">
                    <input
                        id="gemini-api-key"
                        type="password"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="AIza..."
                        className="flex-grow p-2 bg-[var(--surface-1)] border border-[var(--line)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
                    />
                    <button
                        onClick={handleSaveGemini}
                        type="button"
                        className="px-4 py-2 bg-[var(--accent)] text-[#0D1411] font-semibold rounded-lg shadow-md hover:brightness-110 disabled:bg-[var(--surface-1)] disabled:text-[var(--text-muted)] transition-colors"
                    >
                        Save
                    </button>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                    If left blank, the application will attempt to use the pre-configured environment variable.
                </p>
            </div>

            <div>
                <label htmlFor="openrouter-api-key" className="block text-sm font-medium text-[var(--text)] mb-2">
                    OpenRouter API Key
                </label>
                <div className="flex gap-2">
                    <input
                        id="openrouter-api-key"
                        type="password"
                        value={openRouterKey}
                        onChange={(e) => setOpenRouterKey(e.target.value)}
                        placeholder="sk-or-..."
                        className="flex-grow p-2 bg-[var(--surface-1)] border border-[var(--line)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition"
                    />
                    <button
                        onClick={handleSaveOpenRouter}
                        type="button"
                        className="px-4 py-2 bg-[var(--accent)] text-[#0D1411] font-semibold rounded-lg shadow-md hover:brightness-110 disabled:bg-[var(--surface-1)] disabled:text-[var(--text-muted)] transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

const SessionSection: React.FC<Pick<SettingsViewProps, 'onSaveSession' | 'onLoadSession'>> = ({ onSaveSession, onLoadSession }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLoadClick = () => fileInputRef.current?.click();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onLoadSession(file);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={onSaveSession} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--surface-1)] text-[var(--text)] font-semibold rounded-lg shadow-md hover:bg-[var(--surface-active)] transition-colors">
                <DownloadIcon className="w-5 h-5" aria-hidden="true" />
                Save Session
            </button>
            <button onClick={handleLoadClick} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--surface-1)] text-[var(--text)] font-semibold rounded-lg shadow-md hover:bg-[var(--surface-active)] transition-colors">
                <UploadIcon className="w-5 h-5" aria-hidden="true" />
                Load Session
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
                aria-hidden="true"
            />
        </div>
    );
};

const HistorySection: React.FC<Pick<SettingsViewProps, 'queryHistory' | 'onSelectQuery' | 'onClose'>> = ({ queryHistory, onSelectQuery, onClose }) => {
    const handleQueryClick = (query: string) => {
        onSelectQuery(query);
        onClose();
    };
    
    if (queryHistory.length === 0) {
        return <p className="text-[var(--text-muted)] italic">Your query history is empty.</p>;
    }

    return (
        <ul className="space-y-2 max-h-96 overflow-y-auto">
            {queryHistory.map((query, index) => (
                <li key={index}>
                    <button 
                        onClick={() => handleQueryClick(query)}
                        className="w-full text-left p-2.5 text-sm text-[var(--accent-2)] bg-[var(--surface-2)] rounded-md hover:bg-[var(--surface-active)] transition-colors truncate"
                        title={query}
                    >
                        {query}
                    </button>
                </li>
            ))}
        </ul>
    );
};


// --- MAIN SETTINGS VIEW COMPONENT ---

const SettingsView: React.FC<SettingsViewProps> = (props) => {
    const { isOpen, onClose, queryHistory } = props;
    const [activeSectionId, setActiveSectionId] = useState<SectionId>('api-keys');
    const [mobileDrillIn, setMobileDrillIn] = useState<boolean>(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    
    const activeSection = sections.find(s => s.id === activeSectionId) ?? sections[0];

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            // Reset to default view on open
            setActiveSectionId('api-keys');
            setMobileDrillIn(false);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            (firstFocusable ?? dialogRef.current)?.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const trap = (e: KeyboardEvent) => {
            if (e.key !== 'Tab' || !dialogRef.current) return;
            const focusables = Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )
            ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        const node = dialogRef.current;
        node?.addEventListener('keydown', trap);
        return () => node?.removeEventListener('keydown', trap);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSectionSelect = (id: SectionId) => {
        setActiveSectionId(id);
        setMobileDrillIn(true);
    };
    
    const handleMobileBack = () => setMobileDrillIn(false);

    const renderSectionContent = (sectionId: SectionId) => {
        switch(sectionId) {
            case 'api-keys': return <ApiKeySection {...props} />;
            case 'session': return <SessionSection {...props} />;
            case 'history': return <HistorySection {...props} />;
            default: return null;
        }
    };
    
    const sectionsToDisplay = queryHistory.length > 0 ? sections : sections.filter(s => s.id !== 'history');

    const navigation = (
        <nav className="flex flex-col gap-1 p-2" aria-label="Settings navigation">
            {sectionsToDisplay.map(section => {
                const Icon = section.icon;
                const isActive = section.id === activeSectionId;
                return (
                    <button
                        key={section.id}
                        onClick={() => handleSectionSelect(section.id)}
                        className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            isActive ? 'bg-[var(--accent)] text-[#0D1411]' : 'text-[var(--text)] hover:bg-[var(--surface-active)]'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                        <span>{section.label}</span>
                    </button>
                );
            })}
        </nav>
    );

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in-up p-4"
            style={{ animationDuration: '0.3s'}}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
        >
            <div
                ref={dialogRef}
                tabIndex={-1}
                className="bg-[var(--surface-2)] rounded-xl shadow-2xl border border-[var(--line)] w-full max-w-4xl h-full max-h-[700px] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* --- Header --- */}
                <header className="flex items-center justify-between p-4 border-b border-[var(--line)] flex-shrink-0">
                    <div className="flex items-center gap-3">
                         <button onClick={handleMobileBack} className="p-1 rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-active)] md:hidden" aria-label="Back to settings sections" style={{ visibility: mobileDrillIn ? 'visible': 'hidden' }}>
                            <ChevronLeftIcon className="w-6 h-6" aria-hidden="true" />
                        </button>
                        <h2 id="settings-title" className="text-lg font-bold text-[var(--text)]">
                             <span className="md:hidden">{mobileDrillIn ? activeSection.label : "Settings"}</span>
                             <span className="hidden md:inline">Settings</span>
                        </h2>
                    </div>
                     <button onClick={onClose} type="button" className="p-1 rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-active)] hover:text-[var(--text)]" aria-label="Close settings">
                        <XMarkIcon className="w-6 h-6" aria-hidden="true" />
                    </button>
                </header>
                
                {/* --- Main Content --- */}
                <div className="flex-grow grid md:grid-cols-[240px_1fr] grid-cols-1 min-h-0">
                    {/* Sidebar (Desktop) */}
                    <aside className="hidden md:block border-r border-[var(--line)]/50 overflow-y-auto">
                        {navigation}
                    </aside>

                    {/* Content Area */}
                    <main className="overflow-y-auto">
                         {/* Mobile View */}
                        <div className="md:hidden">
                            {mobileDrillIn ? (
                                <div className="p-6 space-y-4">
                                    <p className="text-[var(--text-muted)] text-sm">{activeSection.description}</p>
                                    <div className="border-t border-[var(--line)] pt-4">{renderSectionContent(activeSectionId)}</div>
                                </div>
                            ) : (
                                navigation
                            )}
                        </div>

                        {/* Desktop View */}
                        <div className="hidden md:block p-6 space-y-4">
                             <h3 className="text-xl font-semibold text-[var(--text)]">{activeSection.label}</h3>
                             <p className="text-[var(--text-muted)] text-sm">{activeSection.description}</p>
                             <div className="border-t border-[var(--line)] pt-4">{renderSectionContent(activeSectionId)}</div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
