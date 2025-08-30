import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { motion, Variants } from 'framer-motion';
import FocusTrap from 'focus-trap-react';

// Types and constants
import {
    AgentState,
    ImageState,
    AgentConfig,
    GeminiAgentConfig,
    OpenAIAgentConfig,
    OpenRouterAgentConfig,
    GeminiAgentSettings,
    OpenAIAgentSettings,
    ArbiterModel,
    OpenAIVerbosity,
    SessionData,
    SavedAgentConfig,
    SESSION_DATA_VERSION,
    RunRecord,
    GeminiThinkingEffort,
    RunStatus,
    OpenAIReasoningEffort
} from '@/types';
import {
    GEMINI_PRO_MODEL,
    OPENAI_ARBITER_MODEL,
    GEMINI_FLASH_MODEL,
    OPENAI_GPT5_MINI_MODEL,
    OPENAI_AGENT_MODEL,
    OPENROUTER_GPT_4O,
    OPENROUTER_CLAUDE_3_HAIKU,
} from '@/constants';

// MoE utilities
import { experts } from '@/moe/experts';
import { runOrchestration } from '@/moe/orchestrator';
import { Draft, ExpertDispatch } from '@/moe/types';

// Components
import { ShieldCheckIcon, CogIcon, DownloadIcon, ExclamationTriangleIcon, XMarkIcon, Bars3Icon } from '@/components/icons';
import AgentCard from '@/components/AgentCard';
import SettingsView from '@/components/SettingsView';
import CollapsibleSection from '@/components/CollapsibleSection';
import AgentEnsemble, { AgentEnsembleHandles } from '@/components/AgentEnsemble';
import PromptInput from '@/components/PromptInput';
import FinalAnswerCard from '@/components/FinalAnswerCard';
import HistorySidebar from '@/components/HistorySidebar';
import SegmentedControl from '@/components/SegmentedControl';

// Services
import {
    setOpenAIApiKey as storeOpenAIApiKey,
    setGeminiApiKey as storeGeminiApiKey,
    setOpenRouterApiKey as storeOpenRouterApiKey,
} from '@/services/llmService';

// Hooks
import useViewportHeight from '@/lib/useViewportHeight';
import useKeydown from '@/lib/useKeydown';

// Assets
import banner from './assets/banner.png';

const OPENAI_API_KEY_STORAGE_KEY = 'openai_api_key';
const GEMINI_API_KEY_STORAGE_KEY = 'gemini_api_key';
const OPENROUTER_API_KEY_STORAGE_KEY = 'openrouter_api_key';
const MAX_HISTORY_LENGTH = 20;

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
        },
    },
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            type: 'spring',
            stiffness: 100,
            damping: 12,
        },
    },
};

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const colorClasses =
        type === 'success'
            ? 'bg-[var(--success)] border-[var(--success)] text-[var(--text)]'
            : 'bg-[var(--danger)] border-[var(--danger)] text-[var(--text)]';

    return (
        <div
            className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-2xl border z-50 animate-fade-in-up flex items-center gap-4 ${colorClasses}`}
            style={{ animationDuration: '0.3s' }}
        >
            <span>{message}</span>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--surface-active)]" aria-label="Close notification">
                <XMarkIcon className="w-5 h-5" aria-hidden="true" />
            </button>
        </div>
    );
};

const createDefaultAgentConfigs = (): AgentConfig[] => {
    const defaultExperts = experts.slice(0, 4);
    if (defaultExperts.length < 4) return [];

    const configs: AgentConfig[] = [];

    configs.push({
        id: crypto.randomUUID(),
        expert: defaultExperts[0],
        model: GEMINI_FLASH_MODEL,
        provider: 'gemini',
        status: 'PENDING',
        settings: { 
            effort: 'dynamic', 
            generationStrategy: 'single', 
            confidenceSource: 'judge',
            traceCount: 8, 
            deepConfEta: 90,
            tau: 0.95,
            groupWindow: 2048,
        }
    } as GeminiAgentConfig);
    configs.push({
        id: crypto.randomUUID(),
        expert: defaultExperts[1],
        model: GEMINI_FLASH_MODEL,
        provider: 'gemini',
        status: 'PENDING',
        settings: { 
            effort: 'dynamic', 
            generationStrategy: 'single', 
            confidenceSource: 'judge',
            traceCount: 8, 
            deepConfEta: 90,
            tau: 0.95,
            groupWindow: 2048,
        }
    } as GeminiAgentConfig);
    
    configs.push({
        id: crypto.randomUUID(),
        expert: defaultExperts[2],
        model: OPENROUTER_GPT_4O,
        provider: 'openrouter',
        status: 'PENDING',
        settings: {
            temperature: 0.7,
            topP: 1,
            topK: 50,
            frequencyPenalty: 0,
            presencePenalty: 0,
            repetitionPenalty: 1,
        }
    } as OpenRouterAgentConfig);
    configs.push({
        id: crypto.randomUUID(),
        expert: defaultExperts[3],
        model: OPENAI_AGENT_MODEL,
        provider: 'openai',
        status: 'PENDING',
        settings: { 
            effort: 'medium', 
            verbosity: 'medium', 
            generationStrategy: 'single', 
            confidenceSource: 'judge',
            traceCount: 8, 
            deepConfEta: 90,
            tau: 0.95,
            groupWindow: 2048,
        }
    } as OpenAIAgentConfig);
    
    return configs;
};


const mapDraftToAgentState = (draft: Draft): AgentState => ({
    id: draft.agentId,
    name: draft.expert.name,
    persona: draft.expert.persona,
    status: draft.status,
    content: draft.content,
    error: draft.error || null,
    model: draft.expert.model,
    provider: draft.expert.provider,
});

const App: React.FC = () => {
    useViewportHeight();
    // Live state
    const [prompt, setPrompt] = useState<string>('');
    const [images, setImages] = useState<ImageState[]>([]);
    const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>(createDefaultAgentConfigs());
    const [arbiterModel, setArbiterModel] = useState<ArbiterModel>(GEMINI_PRO_MODEL);
    const [openAIArbiterVerbosity, setOpenAIArbiterVerbosity] = useState<OpenAIVerbosity>('medium');
    const [openAIArbiterEffort, setOpenAIArbiterEffort] = useState<OpenAIReasoningEffort>('medium');
    const [geminiArbiterEffort, setGeminiArbiterEffort] = useState<GeminiThinkingEffort>('dynamic');
    
    // Results state (for live run)
    const [agents, setAgents] = useState<AgentState[]>([]);
    const [finalAnswer, setFinalAnswer] = useState<string>('');
    const [arbiterSwitchWarning, setArbiterSwitchWarning] = useState<string | null>(null);

    // Control state
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isArbiterRunning, setIsArbiterRunning] = useState<boolean>(false);
    
    // History state
    const [history, setHistory] = useState<RunRecord[]>([]);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

    // UI state
    const [openAIApiKey, setOpenAIApiKey] = useState<string>('');
    const [geminiApiKey, setGeminiApiKey] = useState<string>('');
    const [openRouterApiKey, setOpenRouterApiKey] = useState<string>('');
    const [isSettingsViewOpen, setIsSettingsViewOpen] = useState<boolean>(false);
    const [queryHistory, setQueryHistory] = useState<string[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isMobileHistoryOpen, setMobileHistoryOpen] = useState(false);
    const openHistoryButtonRef = useRef<HTMLButtonElement | null>(null);
    const mobileHistoryNewRunButtonRef = useRef<HTMLButtonElement | null>(null);

    const closeMobileHistory = useCallback(() => {
        setMobileHistoryOpen(false);
        openHistoryButtonRef.current?.focus();
    }, []);
    useKeydown('Escape', closeMobileHistory, isMobileHistoryOpen);

    const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
    const agentEnsembleRef = useRef<AgentEnsembleHandles>(null);
    const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
    
    // Refs for capturing state in async callbacks
    const finalAnswerRef = useRef(finalAnswer);
    const agentsRef = useRef(agents);
    const arbiterSwitchWarningRef = useRef(arbiterSwitchWarning);
    const errorRef = useRef(error);
    const animationFrameId = useRef<number | null>(null);
    const isRunCompletedRef = useRef(false);
    const currentRunDataRef = useRef<Pick<RunRecord, 'prompt' | 'images' | 'agentConfigs' | 'arbiterModel' | 'openAIArbiterVerbosity' | 'openAIArbiterEffort' | 'geminiArbiterEffort'> | undefined>(undefined);


    useEffect(() => { finalAnswerRef.current = finalAnswer; }, [finalAnswer]);
    useEffect(() => { agentsRef.current = agents; }, [agents]);
    useEffect(() => { arbiterSwitchWarningRef.current = arbiterSwitchWarning; }, [arbiterSwitchWarning]);
    useEffect(() => { errorRef.current = error; }, [error]);

    useEffect(() => {
        if (!isLoading && isRunCompletedRef.current) {
            isRunCompletedRef.current = false; // Reset for next run

            const finalStatus: RunStatus = errorRef.current ? 'FAILED' : 'COMPLETED';

            if (currentRunDataRef.current) {
                const newRun: RunRecord = {
                    id: `${Date.now()}`,
                    timestamp: Date.now(),
                    ...currentRunDataRef.current,
                    finalAnswer: finalAnswerRef.current,
                    agents: agentsRef.current,
                    status: finalStatus,
                    arbiterSwitchWarning: arbiterSwitchWarningRef.current,
                };
                setHistory(prev => [newRun, ...prev]);
                currentRunDataRef.current = undefined; // Clear after use
            }
        }
    }, [isLoading]);


    useEffect(() => {
        const savedOpenAIKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
        if (savedOpenAIKey) {
            setOpenAIApiKey(savedOpenAIKey);
            storeOpenAIApiKey(savedOpenAIKey);
        }
        const savedGeminiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
        if (savedGeminiKey) {
            setGeminiApiKey(savedGeminiKey);
            storeGeminiApiKey(savedGeminiKey);
        }
        const savedOpenRouterKey = localStorage.getItem(OPENROUTER_API_KEY_STORAGE_KEY);
        if (savedOpenRouterKey) {
            setOpenRouterApiKey(savedOpenRouterKey);
            storeOpenRouterApiKey(savedOpenRouterKey);
        }
    }, []);

    const handleSaveOpenAIApiKey = useCallback((newKey: string) => {
        setOpenAIApiKey(newKey);
        storeOpenAIApiKey(newKey);
        localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, newKey);
    }, []);

    const handleSaveGeminiApiKey = useCallback((newKey: string) => {
        setGeminiApiKey(newKey);
        storeGeminiApiKey(newKey);
        localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, newKey);
    }, []);

    const handleSaveOpenRouterApiKey = useCallback((newKey: string) => {
        setOpenRouterApiKey(newKey);
        storeOpenRouterApiKey(newKey);
        localStorage.setItem(OPENROUTER_API_KEY_STORAGE_KEY, newKey);
    }, []);

    const openAIAgentCount = useMemo(() => agentConfigs.filter(c => c.provider === 'openai').length, [agentConfigs]);
    const openRouterAgentCount = useMemo(() => agentConfigs.filter(c => c.provider === 'openrouter').length, [agentConfigs]);
    
    const handleRun = useCallback(async () => {
        // Switch to "live" view if we were viewing history
        if (selectedRunId) {
            setSelectedRunId(null);
        }

        const finalPrompt = prompt.trim() || (images.length > 0 ? `Analyze these ${images.length} image(s) and provide a detailed description.` : "");

        if (!finalPrompt || isLoading || agentConfigs.length === 0) return;

        if (finalPrompt && !queryHistory.includes(finalPrompt)) {
            setQueryHistory(prev => [finalPrompt, ...prev].slice(0, MAX_HISTORY_LENGTH));
        }

        if (openAIAgentCount > 0 && !openAIApiKey) {
            setError("Please set your OpenAI API key in the settings to use OpenAI models.");
            setIsSettingsViewOpen(true);
            return;
        }

        if (openRouterAgentCount > 0 && !openRouterApiKey) {
            setError("Please set your OpenRouter API key in the settings to use OpenRouter models.");
            setIsSettingsViewOpen(true);
            return;
        }

        setIsLoading(true);
        setError(null);
        setFinalAnswer('');
        setIsArbiterRunning(false);
        setAgents([]);
        setArbiterSwitchWarning(null);
        
        isRunCompletedRef.current = false;
        currentRunDataRef.current = {
            prompt: finalPrompt,
            images,
            agentConfigs,
            arbiterModel,
            openAIArbiterVerbosity,
            openAIArbiterEffort,
            geminiArbiterEffort
        };
        
        try {
            const onInitialAgents = (dispatchedExperts: ExpertDispatch[]) => {
                const initialAgents = dispatchedExperts.map((expert): AgentState => ({
                    id: expert.agentId,
                    name: expert.name,
                    persona: expert.persona,
                    status: 'RUNNING',
                    content: '',
                    error: null,
                    model: expert.model,
                    provider: expert.provider,
                }));
                setAgents(initialAgents);
                setAgentConfigs(configs => configs.map(c => ({...c, status: 'RUNNING' })))
            };

            const onDraftUpdate = (completedDraft: Draft) => {
                setAgents(prev => {
                    const agentIndex = prev.findIndex(a => a.id === completedDraft.agentId);
                    if (agentIndex > -1) {
                        const updatedAgent = mapDraftToAgentState(completedDraft);
                        return prev.map((a, i) => (i === agentIndex ? updatedAgent : a));
                    }
                    return prev;
                });
                setAgentConfigs(configs => configs.map(c => 
                    c.id === completedDraft.agentId ? {...c, status: completedDraft.status } : c
                ));
            };

            const { stream, switchedArbiter } = await runOrchestration({
                prompt: finalPrompt,
                images,
                agentConfigs,
                arbiterModel,
                openAIArbiterVerbosity,
                openAIArbiterEffort,
                geminiArbiterEffort
            }, { onInitialAgents, onDraftComplete: onDraftUpdate });
            
            if (switchedArbiter) {
                setArbiterSwitchWarning('The selected GPT-5 arbiter was automatically switched to Gemini 2.5 Pro due to a large input size to prevent errors. Gemini models support larger context windows.');
            }

            setIsArbiterRunning(true);

            let fullText = '';
            let chunkBuffer = '';
            
            const updateDisplay = () => {
                if (chunkBuffer) {
                    fullText += chunkBuffer;
                    setFinalAnswer(fullText);
                    chunkBuffer = '';
                }
                animationFrameId.current = requestAnimationFrame(updateDisplay);
            };
            
            animationFrameId.current = requestAnimationFrame(updateDisplay);

            for await (const chunk of stream) {
                chunkBuffer += chunk.text;
            }
            
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            
            if (chunkBuffer) {
                fullText += chunkBuffer;
                setFinalAnswer(fullText);
            }

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred.';
            setError(errorMessage);
            setAgents(prev => prev.map(a => ({...a, status: 'FAILED', error: errorMessage})))
            setAgentConfigs(configs => configs.map(c => ({...c, status: 'FAILED' })));
        } finally {
            setIsLoading(false);
            setIsArbiterRunning(false);
            isRunCompletedRef.current = true;
        }
    }, [prompt, images, isLoading, agentConfigs, arbiterModel, openAIArbiterVerbosity, openAIArbiterEffort, geminiArbiterEffort, openAIAgentCount, openAIApiKey, openRouterAgentCount, openRouterApiKey, queryHistory, selectedRunId]);
    
    const handleReset = useCallback(() => {
        setPrompt('');
        setImages([]);
        setAgentConfigs(createDefaultAgentConfigs());
        setArbiterModel(GEMINI_PRO_MODEL);
        setOpenAIArbiterVerbosity('medium');
        setOpenAIArbiterEffort('medium');
        setGeminiArbiterEffort('dynamic');
        setAgents([]);
        setFinalAnswer('');
        setIsLoading(false);
        setError(null);
        setIsArbiterRunning(false);
        setArbiterSwitchWarning(null);
    }, []);

    const handleNewRun = useCallback(() => {
        setSelectedRunId(null);
        handleReset();
    }, [handleReset]);

    const handleViewCurrentRun = useCallback(() => {
        setSelectedRunId(null);
    }, []);

    const handleSelectRun = useCallback((id: string) => {
        const run = history.find(r => r.id === id);
        if (run) {
            setSelectedRunId(id);
        }
    }, [history]);

    const handleSelectRunAndClose = useCallback((id: string) => {
        handleSelectRun(id);
        closeMobileHistory();
    }, [handleSelectRun, closeMobileHistory]);

    const handleNewRunAndClose = useCallback(() => {
        handleNewRun();
        closeMobileHistory();
    }, [handleNewRun, closeMobileHistory]);

    const handleViewCurrentRunAndClose = useCallback(() => {
        handleViewCurrentRun();
        closeMobileHistory();
    }, [handleViewCurrentRun, closeMobileHistory]);
    
    const handleDuplicateAgent = useCallback((id: string) => {
        setAgentConfigs(prev => {
            const sourceConfig = prev.find(c => c.id === id);
            if (!sourceConfig) return prev;

            const newConfig = {
                ...sourceConfig,
                id: crypto.randomUUID(),
                status: 'PENDING' as const,
            };

            const index = prev.findIndex(c => c.id === id);
            const newConfigs = [...prev];
            newConfigs.splice(index + 1, 0, newConfig);
            return newConfigs;
        });
    }, []);

    const latestHandleRun = useRef(handleRun);
    const isHistoryViewRef = useRef(false);

    useEffect(() => {
        latestHandleRun.current = handleRun;
    }, [handleRun]);


    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.isComposing || e.repeat) return;
            const target = e.target as HTMLElement;
            const tag = target.tagName;
            const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;

            const key = e.key.toLowerCase();
            const noModifier = !(e.metaKey || e.ctrlKey || e.altKey);

            if ((e.metaKey || e.ctrlKey) && key === 'enter') {
                e.preventDefault();
                latestHandleRun.current();
                return;
            }

            const isGlobal = noModifier && !isTyping && !isHistoryViewRef.current;
            if (!isGlobal) return;

            switch (key) {
                case 'a':
                    e.preventDefault();
                    agentEnsembleRef.current?.openModal();
                    break;
                case '/':
                    e.preventDefault();
                    promptInputRef.current?.focus();
                    break;
                default:
                    if (key >= '1' && key <= '9') {
                        const index = parseInt(key, 10) - 1;
                        const agent = agentsRef.current[index];
                        if (!agent) return;
                        const isCollapsible = agent.status === 'COMPLETED' || agent.status === 'FAILED';
                        if (!isCollapsible) return;
                        setCollapsedMap(prev => ({ ...prev, [agent.id]: !prev[agent.id] }));
                    }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const progressData = useMemo(() => {
        if (!isLoading) {
            return { total: 0, agentPercent: 0, phase: 'idle' };
        }
        const AGENT_PHASE_WEIGHT = 0.5;
        const ARBITER_PHASE_WEIGHT = 0.5;
        
        const completedCount = agentConfigs.filter(a => a.status === 'COMPLETED' || a.status === 'FAILED').length;
        const agentPhaseProgress = agentConfigs.length > 0 ? (completedCount / agentConfigs.length) : 0;
        
        let arbiterPhaseProgress = isArbiterRunning ? 0.5 : 0;
        if (!isLoading && finalAnswer) {
             arbiterPhaseProgress = 1;
        }

        const total = (agentPhaseProgress * AGENT_PHASE_WEIGHT + arbiterPhaseProgress * ARBITER_PHASE_WEIGHT) * 100;
        const phase = isArbiterRunning ? 'arbitrating' : 'drafting';

        return { total: Math.min(total, 100), agentPercent: agentPhaseProgress * 100, phase };
    }, [agentConfigs, isLoading, isArbiterRunning, finalAnswer]);

    const generateBaseFilename = (promptStr: string): string => {
        const sanitized = promptStr
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .slice(0, 50);
        return sanitized || 'orchestration-results';
    };

    const selectedRun = useMemo(() => history.find(r => r.id === selectedRunId), [history, selectedRunId]);

    // Determine what data to display: live state or historical run
    const displayData = useMemo(() => {
        if (selectedRun) {
            return {
                prompt: selectedRun.prompt,
                images: selectedRun.images,
                agentConfigs: selectedRun.agentConfigs,
                arbiterModel: selectedRun.arbiterModel,
                openAIArbiterVerbosity: selectedRun.openAIArbiterVerbosity,
                openAIArbiterEffort: selectedRun.openAIArbiterEffort,
                geminiArbiterEffort: selectedRun.geminiArbiterEffort,
                finalAnswer: selectedRun.finalAnswer,
                agents: selectedRun.agents,
                arbiterSwitchWarning: selectedRun.arbiterSwitchWarning,
                isHistoryView: true,
            };
        }
        return {
            prompt,
            images,
            agentConfigs,
            arbiterModel,
            openAIArbiterVerbosity,
            openAIArbiterEffort,
            geminiArbiterEffort,
            finalAnswer,
            agents,
            arbiterSwitchWarning,
            isHistoryView: false,
        };
    }, [selectedRun, prompt, images, agentConfigs, arbiterModel, openAIArbiterVerbosity, openAIArbiterEffort, geminiArbiterEffort, finalAnswer, agents, arbiterSwitchWarning]);


    useEffect(() => {
        isHistoryViewRef.current = displayData.isHistoryView;
    }, [displayData.isHistoryView]);

    const handleSaveAll = async () => {
        const dataToSave = displayData;
        const successfulDrafts = dataToSave.agents.filter(agent => agent.status === 'COMPLETED');
        if (!dataToSave.finalAnswer && successfulDrafts.length === 0 && dataToSave.images.length === 0) return;
        
        const zip = new JSZip();
        const baseFilename = generateBaseFilename(dataToSave.prompt);

        if (dataToSave.finalAnswer) {
            const fileContent = `# Prompt\n\n${dataToSave.prompt}\n\n---\n\n# Arbiter's Final Answer\n\n${dataToSave.finalAnswer}`;
            zip.file(`${baseFilename}-final-answer.md`, fileContent);
        }

        successfulDrafts.forEach((agent, index) => {
            const fileContent = `# Prompt\n\n${dataToSave.prompt}\n\n---\n\n# Agent ${index + 1} (${agent.provider}, ${agent.name})\n\n${agent.content}`;
            const agentFilename = `${baseFilename}-agent-${index + 1}-${agent.name.toLowerCase().replace(/\s+/g, '-')}.md`;
            zip.file(agentFilename, fileContent);
        });

        if (dataToSave.images.length > 0) {
            dataToSave.images.forEach(image => {
                zip.file(image.file.name, image.file);
            });
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });

        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseFilename}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleSaveSession = useCallback(() => {
        try {
            const savedAgentConfigs: SavedAgentConfig[] = agentConfigs.map(config => ({
                expertId: config.expert.id,
                model: config.model,
                provider: config.provider,
                settings: config.settings,
            }));

            const sessionData: SessionData = {
                version: SESSION_DATA_VERSION,
                prompt,
                agentConfigs: savedAgentConfigs,
                arbiterModel,
                openAIArbiterVerbosity,
                openAIArbiterEffort,
                geminiArbiterEffort,
                openAIApiKey,
                geminiApiKey,
                openRouterApiKey,
                queryHistory,
            };

            const jsonString = JSON.stringify(sessionData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            link.download = `orchestrator-session-${timestamp}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Failed to save session:", e);
            setToast({ message: "An error occurred while trying to save the session.", type: 'error' });
        }
    }, [prompt, agentConfigs, arbiterModel, openAIArbiterVerbosity, openAIArbiterEffort, geminiArbiterEffort, openAIApiKey, geminiApiKey, openRouterApiKey, queryHistory]);
    
    const handleLoadSession = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const jsonString = event.target?.result as string;
                if (!jsonString) {
                    throw new Error("File is empty or could not be read.");
                }

                const data = JSON.parse(jsonString) as SessionData;

                if (typeof data.version !== 'number') {
                    setToast({ message: "Invalid session file: missing or invalid version.", type: 'error' });
                    return;
                }

                if (data.version > SESSION_DATA_VERSION) {
                    setToast({ message: `This session file is from a newer version (v${data.version}) and cannot be loaded.`, type: 'error' });
                    return;
                }

                if (!Array.isArray(data.agentConfigs)) {
                    throw new Error("Invalid session file format: agentConfigs is missing or not an array.");
                }

                const loadedAgentConfigs: AgentConfig[] = data.agentConfigs.map((savedConfig) => {
                    const expert = experts.find(e => e.id === savedConfig.expertId);
                    if (!expert) {
                        console.warn(`Expert with ID "${savedConfig.expertId}" not found. Skipping.`);
                        return null;
                    }
                    const baseConfig = {
                        id: crypto.randomUUID(),
                        expert,
                        model: savedConfig.model,
                        provider: savedConfig.provider,
                        status: 'PENDING' as const,
                    };
                    if (savedConfig.provider === 'gemini') {
                        const settings = savedConfig.settings as Partial<GeminiAgentSettings>;
                        const migratedSettings: GeminiAgentSettings = {
                            effort: settings.effort ?? 'dynamic',
                            generationStrategy: settings.generationStrategy ?? 'single',
                            confidenceSource: 'judge',
                            traceCount: settings.traceCount ?? 8,
                            deepConfEta: settings.deepConfEta ?? 90,
                            tau: settings.tau ?? 0.95,
                            groupWindow: settings.groupWindow ?? 2048,
                        };
                        return { ...baseConfig, provider: 'gemini', settings: migratedSettings } as GeminiAgentConfig;
                    } else if (savedConfig.provider === 'openrouter') {
                        return { ...baseConfig, provider: 'openrouter', settings: savedConfig.settings } as OpenRouterAgentConfig;
                    } else {
                        const settings = savedConfig.settings as Partial<OpenAIAgentSettings>;
                        const migratedSettings: OpenAIAgentSettings = {
                            effort: settings.effort ?? 'medium',
                            verbosity: settings.verbosity ?? 'medium',
                            generationStrategy: settings.generationStrategy ?? 'single',
                            confidenceSource: 'judge',
                            traceCount: settings.traceCount ?? 8,
                            deepConfEta: settings.deepConfEta ?? 90,
                            tau: settings.tau ?? 0.95,
                            groupWindow: settings.groupWindow ?? 2048,
                        };
                        return { ...baseConfig, provider: 'openai', settings: migratedSettings } as OpenAIAgentConfig;
                    }
                }).filter((config): config is AgentConfig => config !== null);

                handleNewRun(); // Clear current state before loading
                setPrompt(data.prompt ?? '');
                setAgentConfigs(loadedAgentConfigs);
                setArbiterModel(data.arbiterModel ?? GEMINI_PRO_MODEL);
                setOpenAIArbiterVerbosity(data.openAIArbiterVerbosity ?? 'medium');
                setOpenAIArbiterEffort(data.openAIArbiterEffort ?? 'medium');
                setGeminiArbiterEffort(data.geminiArbiterEffort ?? 'dynamic');
                handleSaveOpenAIApiKey(data.openAIApiKey ?? '');
                handleSaveGeminiApiKey(data.geminiApiKey ?? '');
                handleSaveOpenRouterApiKey(data.openRouterApiKey ?? '');
                setQueryHistory(data.queryHistory ?? []);
                
                setIsSettingsViewOpen(false);
                setToast({ message: "Session loaded successfully!", type: 'success' });

            } catch (e) {
                console.error("Failed to load session:", e);
                const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
                setToast({ message: `Error loading session file: ${errorMessage}`, type: 'error' });
            }
        };

        reader.onerror = () => {
            setToast({ message: "Failed to read the session file.", type: 'error' });
        };

        reader.readAsText(file);
    }, [handleSaveOpenAIApiKey, handleSaveGeminiApiKey, handleSaveOpenRouterApiKey, handleNewRun]);

    const handleSelectQuery = useCallback((query: string) => {
        setPrompt(query);
    }, []);

    const hasResults = displayData.agents.length > 0 || displayData.finalAnswer;
    const isRunning = isLoading || isArbiterRunning;

    const currentRunStatus = useMemo(() => {
        if (isRunning) return 'IN_PROGRESS';
        if (selectedRunId) return 'IDLE'; // Viewing history, no live run active
        if (error) return 'FAILED';
        if (hasResults) return 'COMPLETED';
        return 'IDLE';
    }, [isRunning, error, hasResults, selectedRunId]);

    return (
        <div className="bg-[var(--bg)] text-[var(--text)] font-sans flex w-full" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
            <HistorySidebar
                history={history}
                selectedRunId={selectedRunId}
                onSelectRun={handleSelectRun}
                onNewRun={handleNewRun}
                onViewCurrentRun={handleViewCurrentRun}
                currentRunStatus={currentRunStatus}
                className="hidden md:flex"
            />
            <div className="flex-1 flex flex-col h-full min-w-0">
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                <SettingsView
                    isOpen={isSettingsViewOpen}
                    onClose={() => setIsSettingsViewOpen(false)}
                    onSaveOpenAIApiKey={handleSaveOpenAIApiKey}
                    currentOpenAIApiKey={openAIApiKey}
                    onSaveGeminiApiKey={handleSaveGeminiApiKey}
                    currentGeminiApiKey={geminiApiKey}
                    onSaveOpenRouterApiKey={handleSaveOpenRouterApiKey}
                    currentOpenRouterApiKey={openRouterApiKey}
                    onSaveSession={handleSaveSession}
                    onLoadSession={handleLoadSession}
                    queryHistory={queryHistory}
                    onSelectQuery={handleSelectQuery}
                />
                <div className="flex-1 overflow-y-auto scrollable-area">
                    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <header className="text-center py-8 relative fixed-header">
                            <div className="absolute top-8 left-0 md:hidden">
                                <button
                                    ref={openHistoryButtonRef}
                                    onClick={() => setMobileHistoryOpen(true)}
                                    className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-active)] rounded-lg"
                                    aria-label="Open history"
                                >
                                    <Bars3Icon className="w-6 h-6" aria-hidden="true" />
                                </button>
                            </div>
                            <img
                                src={banner}
                                alt="HeavyOrc banner"
                                width={1200}
                                height={300}
                                className="mx-auto mb-4 w-full max-w-2xl h-auto"
                            />
                            <h1 className="text-4xl sm:text-5xl font-bold text-[var(--text)] flex items-center justify-center gap-3">
                                <ShieldCheckIcon className="w-10 h-10 text-emerald-400" aria-hidden="true" />
                                HeavyOrc
                            </h1>
                            <div className="absolute top-8 right-0 flex items-center gap-2">
                                <button
                                    onClick={handleSaveAll}
                                    disabled={!hasResults || isLoading}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--surface-1)] text-[var(--text)] font-semibold rounded-lg shadow-md hover:bg-[var(--surface-active)] disabled:bg-[var(--surface-2)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed transition-colors"
                                    title="Save final answer and all drafts to a ZIP file"
                                >
                                    <DownloadIcon className="w-4 h-4" aria-hidden="true" />
                                    Save
                                </button>
                                <button
                                    onClick={() => setIsSettingsViewOpen(true)}
                                    className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors rounded-full hover:bg-[var(--surface-active)]"
                                    title="Settings"
                                    aria-label="Open Settings"
                                >
                                    <CogIcon className="w-6 h-6" aria-hidden="true" />
                                </button>
                            </div>
                            <p className="mt-4 text-lg text-[var(--text-muted)] max-w-3xl mx-auto">
                            Directly configure a 'Mixture-of-Experts' ensemble. Parallel agents generate diverse drafts, and a final arbiter synthesizes the optimal response.
                            </p>
                        </header>

                        <main className="max-w-4xl mx-auto space-y-8 pb-40">
                            {error && !displayData.isHistoryView && <div className="p-3 bg-[var(--danger)] bg-opacity-20 text-[var(--danger)] border border-[var(--danger)] rounded-lg text-sm text-center">{error}</div>}

                            {(openAIAgentCount > 0 && !openAIApiKey) || (openRouterAgentCount > 0 && !openRouterApiKey) && (
                                <p className="text-xs text-[var(--warn)] text-center p-2 bg-[var(--warn)] bg-opacity-20 rounded-md border border-[var(--warn)]">
                                    An API key is required for one or more of your agents. 
                                    <button onClick={() => setIsSettingsViewOpen(true)} className="ml-1 underline font-semibold hover:text-[var(--warn)] focus:outline-none focus:ring-2 focus:ring-[var(--warn)] rounded">
                                        Set API Key
                                    </button>
                                </p>
                            )}
                            
                            {(hasResults || (isRunning && !displayData.isHistoryView)) && (
                                <motion.div 
                                    className="space-y-8"
                                    initial="hidden"
                                    animate="visible"
                                    variants={containerVariants}
                                >
                                    {displayData.arbiterSwitchWarning && (
                                        <motion.div 
                                            className="bg-[var(--warn)] bg-opacity-20 border border-[var(--warn)] text-[var(--warn)] px-4 py-3 rounded-lg relative"
                                            role="alert"
                                            variants={itemVariants}
                                        >
                                            <div className="flex items-start">
                                                <ExclamationTriangleIcon className="w-5 h-5 mr-3 mt-0.5 text-[var(--warn)] flex-shrink-0" aria-hidden="true" />
                                                <div>
                                                    <strong className="font-bold">Automatic Model Switch:</strong>
                                                    <span className="block sm:inline sm:ml-2">{displayData.arbiterSwitchWarning}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                    
                                    {(displayData.finalAnswer || (isRunning && !displayData.isHistoryView)) && (
                                        <motion.section variants={itemVariants}>
                                            <FinalAnswerCard
                                                answer={displayData.finalAnswer}
                                                isStreaming={isArbiterRunning && !displayData.isHistoryView}
                                            />
                                        </motion.section>
                                    )}
                                    
                                    {displayData.agents.length > 0 && (
                                        <motion.section variants={itemVariants}>
                                            <CollapsibleSection title="Contributing Agent Drafts" defaultOpen={false}>
                                                <motion.div 
                                                    className="grid-adaptive-cols gap-4 pt-4"
                                                    variants={containerVariants}
                                                >
                                                    {displayData.agents.map((agent, index) => (
                                                        <motion.div
                                                            key={agent.id}
                                                            variants={itemVariants}
                                                        >
                                                            <AgentCard
                                                                agent={agent}
                                                                displayId={index + 1}
                                                                isCollapsed={collapsedMap[agent.id] || false}
                                                                onToggleCollapse={() =>
                                                                    setCollapsedMap(prev => ({
                                                                        ...prev,
                                                                        [agent.id]: !prev[agent.id]
                                                                    }))
                                                                }
                                                            />
                                                        </motion.div>
                                                    ))}
                                                </motion.div>
                                            </CollapsibleSection>
                                        </motion.section>
                                    )}
                                </motion.div>
                            )}

                            <div className="space-y-6 bg-[var(--surface-2)] p-6 rounded-xl shadow-2xl border border-[var(--line)]">
                                <AgentEnsemble
                                    ref={agentEnsembleRef}
                                    agentConfigs={displayData.agentConfigs}
                                    setAgentConfigs={setAgentConfigs}
                                    onDuplicateAgent={handleDuplicateAgent}
                                    disabled={isLoading || displayData.isHistoryView}
                                />
                                <div className="border-t border-[var(--line)] pt-4">
                                    <CollapsibleSection title="Arbiter Settings" defaultOpen={true}>
                                        <div className="space-y-4">
                                            <ArbiterSettings
                                                arbiterModel={displayData.arbiterModel}
                                                setArbiterModel={setArbiterModel}
                                                openAIArbiterVerbosity={displayData.openAIArbiterVerbosity}
                                                setOpenAIArbiterVerbosity={setOpenAIArbiterVerbosity}
                                                openAIArbiterEffort={displayData.openAIArbiterEffort}
                                                setOpenAIArbiterEffort={setOpenAIArbiterEffort}
                                                geminiArbiterEffort={displayData.geminiArbiterEffort}
                                                setGeminiArbiterEffort={setGeminiArbiterEffort}
                                                isLoading={isLoading || displayData.isHistoryView}
                                            />
                                        </div>
                                    </CollapsibleSection>
                                </div>
                            </div>
                        </main>
                    </div>
                </div>

                <footer className="sticky bottom-0 z-10 bg-[var(--surface-1)] bg-opacity-80 backdrop-blur-lg border-t border-[var(--line)] flex-shrink-0 fixed-footer">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
                        {isLoading && (
                            <div>
                                <div className="w-full bg-[var(--surface-2)] rounded-full h-2.5">
                                    <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressData.total}%` }}></div>
                                </div>
                                <p className="text-center text-xs text-[var(--text-muted)] mt-1">
                                    {progressData.phase === 'arbitrating' ? `Arbiter is synthesizing...` : `Agents drafting... (${Math.round(progressData.agentPercent)}%)`}
                                </p>
                            </div>
                        )}
                        <PromptInput
                            prompt={displayData.prompt}
                            onPromptChange={setPrompt}
                            images={displayData.images}
                            onImagesChange={setImages}
                            onSubmit={handleRun}
                            isLoading={isLoading}
                            disabled={isLoading || displayData.isHistoryView || agentConfigs.length === 0}
                            inputRef={promptInputRef}
                        />
                    </div>
                </footer>
            </div>
            {isMobileHistoryOpen && (
                <FocusTrap
                    focusTrapOptions={{
                        initialFocus: () => mobileHistoryNewRunButtonRef.current ?? undefined,
                        onDeactivate: () => openHistoryButtonRef.current?.focus(),
                    }}
                >
                    <div className="fixed inset-0 z-40 flex">
                        <div className="absolute inset-0 bg-black/50" onClick={closeMobileHistory}></div>
                        <HistorySidebar
                            ref={mobileHistoryNewRunButtonRef}
                            history={history}
                            selectedRunId={selectedRunId}
                            onSelectRun={handleSelectRunAndClose}
                            onNewRun={handleNewRunAndClose}
                            onViewCurrentRun={handleViewCurrentRunAndClose}
                            currentRunStatus={currentRunStatus}
                            className="relative h-full"
                            isMobile
                            onClose={closeMobileHistory}
                        />
                    </div>
                </FocusTrap>
            )}
        </div>
    );
};

// Extracted for cleanliness
const ArbiterSettings: React.FC<{
    arbiterModel: ArbiterModel;
    setArbiterModel: (model: ArbiterModel) => void;
    openAIArbiterVerbosity: OpenAIVerbosity;
    setOpenAIArbiterVerbosity: (verbosity: OpenAIVerbosity) => void;
    openAIArbiterEffort: OpenAIReasoningEffort;
    setOpenAIArbiterEffort: (effort: OpenAIReasoningEffort) => void;
    geminiArbiterEffort: GeminiThinkingEffort;
    setGeminiArbiterEffort: (effort: GeminiThinkingEffort) => void;
    isLoading: boolean;
}> = ({ arbiterModel, setArbiterModel, openAIArbiterVerbosity, setOpenAIArbiterVerbosity, openAIArbiterEffort, setOpenAIArbiterEffort, geminiArbiterEffort, setGeminiArbiterEffort, isLoading }) => {
    const arbiterModelOptions: { label: string; value: ArbiterModel; provider: 'gemini' | 'openai' | 'openrouter'; tooltip: string }[] = [
        { label: 'Gemini 2.5 Flash', value: GEMINI_FLASH_MODEL, provider: 'gemini', tooltip: 'Google\'s fast and cost-effective model for general arbitration.' },
        { label: 'Gemini 2.5 Pro', value: GEMINI_PRO_MODEL, provider: 'gemini', tooltip: 'Google\'s most capable model, with a large context window and strong reasoning. Recommended for complex synthesis.' },
        { label: 'GPT-5', value: OPENAI_ARBITER_MODEL, provider: 'openai', tooltip: 'OpenAI\'s flagship model with configurable reasoning effort for balanced arbitration.' },
        { label: 'GPT-5 Mini', value: OPENAI_GPT5_MINI_MODEL, provider: 'openai', tooltip: 'OpenAI\'s lightweight GPT-5 model for quick arbitration with lower latency.' },
        { label: 'OR Claude Haiku', value: OPENROUTER_CLAUDE_3_HAIKU, provider: 'openrouter', tooltip: 'Anthropic\'s fastest model via OpenRouter. Ideal for quick, responsive arbitration.' },
    ];
    const openAIVerbosityOptions: { label: string; value: OpenAIVerbosity }[] = [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' }
    ];
    const openAIEffortOptions: { label: string; value: OpenAIReasoningEffort }[] = [
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
    ];
    const geminiEffortOptions: { label: string, value: GeminiThinkingEffort }[] = [
        { label: 'Dynamic', value: 'dynamic' },
        { label: 'High', value: 'high' },
        { label: 'Medium', value: 'medium' },
        { label: 'Low', value: 'low' },
        { label: 'None', value: 'none' },
    ];
    
    const selectedModelOption = arbiterModelOptions.find(opt => opt.value === arbiterModel);
    const effortOptions = selectedModelOption?.value === GEMINI_FLASH_MODEL
        ? geminiEffortOptions
        : geminiEffortOptions.filter(o => o.value !== 'none');

    return (
        <>
            <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">Arbiter Model</label>
                <SegmentedControl
                    aria-label="Arbiter Model"
                    options={arbiterModelOptions}
                    value={arbiterModel}
                    onChange={setArbiterModel}
                    disabled={isLoading}
                />
            </div>
            {selectedModelOption?.provider === 'openai' ? (
                <>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text)] mb-2">Arbiter Verbosity</label>
                        <SegmentedControl
                            aria-label="Arbiter Verbosity"
                            options={openAIVerbosityOptions}
                            value={openAIArbiterVerbosity}
                            onChange={setOpenAIArbiterVerbosity}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-[var(--text)] mb-2">Reasoning Effort</label>
                        <SegmentedControl
                            aria-label="Arbiter Reasoning Effort"
                            options={openAIEffortOptions}
                            value={openAIArbiterEffort}
                            onChange={setOpenAIArbiterEffort}
                            disabled={isLoading}
                        />
                    </div>
                </>
            ) : selectedModelOption?.provider === 'gemini' ? (
                 <div>
                    <label className="block text-sm font-medium text-[var(--text)] mb-2">Thinking Effort</label>
                    <SegmentedControl
                        aria-label="Arbiter Thinking Effort"
                        options={effortOptions}
                        value={geminiArbiterEffort}
                        onChange={setGeminiArbiterEffort}
                        disabled={isLoading}
                    />
                </div>
            ) : null}
        </>
    );
};


export default App;
