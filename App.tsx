

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { motion, Variants } from 'framer-motion';
import { 
    AgentState, 
    ImageState, 
    AgentConfig, 
    GeminiAgentConfig, 
    OpenAIAgentConfig,
    ArbiterModel,
    OpenAIVerbosity,
    SessionData,
    SavedAgentConfig,
    SESSION_DATA_VERSION,
    RunRecord,
    GeminiThinkingEffort,
    RunStatus
} from './types';
import { 
    GEMINI_PRO_MODEL, 
    OPENAI_ARBITER_GPT5_MEDIUM_REASONING,
    OPENAI_ARBITER_GPT5_HIGH_REASONING,
    GEMINI_FLASH_MODEL,
    OPENAI_AGENT_MODEL,
} from './constants';
import { experts } from './moe/experts';
import { runOrchestration } from './moe/orchestrator';
import { Draft, ExpertDispatch } from './moe/types';
import AgentCard from './components/AgentCard';
import { SparklesIcon, CogIcon, DownloadIcon, ExclamationTriangleIcon } from './components/icons';
import SettingsView from './components/SettingsView';
import { setOpenAIApiKey as storeOpenAIApiKey } from './services/llmService';
import CollapsibleSection from './components/CollapsibleSection';
import AgentEnsemble from './components/AgentEnsemble';
import PromptInput from './components/PromptInput';
import FinalAnswerCard from './components/FinalAnswerCard';
import HistorySidebar from './components/HistorySidebar';
import SegmentedControl from './components/SegmentedControl';

const OPENAI_API_KEY_STORAGE_KEY = 'openai_api_key';
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

const createDefaultAgentConfigs = (): AgentConfig[] => {
    const defaultExperts = experts.slice(0, 4);
    if (defaultExperts.length < 4) return [];

    const configs: AgentConfig[] = [];

    configs.push({
        id: `${defaultExperts[0].id}-${Date.now()}`,
        expert: defaultExperts[0],
        model: GEMINI_FLASH_MODEL,
        provider: 'gemini',
        status: 'PENDING',
        settings: { effort: 'dynamic' }
    } as GeminiAgentConfig);
    configs.push({
        id: `${defaultExperts[1].id}-${Date.now()}`,
        expert: defaultExperts[1],
        model: GEMINI_FLASH_MODEL,
        provider: 'gemini',
        status: 'PENDING',
        settings: { effort: 'dynamic' }
    } as GeminiAgentConfig);
    
    configs.push({
        id: `${defaultExperts[2].id}-${Date.now()}`,
        expert: defaultExperts[2],
        model: OPENAI_AGENT_MODEL,
        provider: 'openai',
        status: 'PENDING',
        settings: { effort: 'medium', verbosity: 'medium' }
    } as OpenAIAgentConfig);
    configs.push({
        id: `${defaultExperts[3].id}-${Date.now()}`,
        expert: defaultExperts[3],
        model: OPENAI_AGENT_MODEL,
        provider: 'openai',
        status: 'PENDING',
        settings: { effort: 'medium', verbosity: 'medium' }
    } as OpenAIAgentConfig);
    
    return configs;
};


const mapDraftToAgentState = (draft: Draft, id: number): AgentState => ({
    id,
    name: draft.expert.name,
    persona: draft.expert.persona,
    status: draft.status,
    content: draft.content,
    error: draft.error || null,
    model: draft.expert.model,
    provider: draft.expert.provider,
});

const App: React.FC = () => {
    // Live state
    const [prompt, setPrompt] = useState<string>('');
    const [images, setImages] = useState<ImageState[]>([]);
    const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>(createDefaultAgentConfigs());
    const [arbiterModel, setArbiterModel] = useState<ArbiterModel>(GEMINI_PRO_MODEL);
    const [openAIArbiterVerbosity, setOpenAIArbiterVerbosity] = useState<OpenAIVerbosity>('medium');
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
    const [isSettingsViewOpen, setIsSettingsViewOpen] = useState<boolean>(false);
    const [queryHistory, setQueryHistory] = useState<string[]>([]);
    
    // Refs for capturing state in async callbacks
    const finalAnswerRef = useRef(finalAnswer);
    const agentsRef = useRef(agents);
    const arbiterSwitchWarningRef = useRef(arbiterSwitchWarning);
    const errorRef = useRef(error);
    const animationFrameId = useRef<number | null>(null);

    useEffect(() => { finalAnswerRef.current = finalAnswer; }, [finalAnswer]);
    useEffect(() => { agentsRef.current = agents; }, [agents]);
    useEffect(() => { arbiterSwitchWarningRef.current = arbiterSwitchWarning; }, [arbiterSwitchWarning]);
    useEffect(() => { errorRef.current = error; }, [error]);

    useEffect(() => {
        const savedKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
        if (savedKey) {
            setOpenAIApiKey(savedKey);
            storeOpenAIApiKey(savedKey);
        }
    }, []);

    const handleSaveApiKey = useCallback((newKey: string) => {
        setOpenAIApiKey(newKey);
        storeOpenAIApiKey(newKey);
        localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, newKey);
    }, []);

    const openAIAgentCount = useMemo(() => agentConfigs.filter(c => c.provider === 'openai').length, [agentConfigs]);
    
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

        setIsLoading(true);
        setError(null);
        setFinalAnswer('');
        setIsArbiterRunning(false);
        setAgents([]);
        setArbiterSwitchWarning(null);
        
        let runDataForHistory: Pick<RunRecord, 'prompt' | 'images' | 'agentConfigs' | 'arbiterModel' | 'openAIArbiterVerbosity' | 'geminiArbiterEffort'> = {
            prompt: finalPrompt,
            images,
            agentConfigs,
            arbiterModel,
            openAIArbiterVerbosity,
            geminiArbiterEffort
        };
        
        try {
            const onInitialAgents = (dispatchedExperts: ExpertDispatch[]) => {
                const initialAgents = dispatchedExperts.map((expert, i): AgentState => ({
                    id: i,
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
                    const agentIndex = prev.findIndex(a => a.persona === completedDraft.expert.persona);
                    if (agentIndex > -1) {
                        const updatedAgent = mapDraftToAgentState(completedDraft, agentIndex);
                        return prev.map((a, i) => (i === agentIndex ? updatedAgent : a));
                    }
                    return prev;
                });
                setAgentConfigs(configs => configs.map(c => 
                    c.expert.id === completedDraft.expert.id ? {...c, status: completedDraft.status } : c
                ));
            };

            const { stream, switchedArbiter } = await runOrchestration({
                prompt: finalPrompt,
                images,
                agentConfigs,
                arbiterModel,
                openAIArbiterVerbosity,
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
            
            const finalStatus: RunStatus = errorRef.current ? 'FAILED' : 'COMPLETED';

            // Save the completed run to history
            const newRun: RunRecord = {
                id: `${Date.now()}`,
                timestamp: Date.now(),
                ...runDataForHistory,
                finalAnswer: finalAnswerRef.current,
                agents: agentsRef.current,
                status: finalStatus,
                arbiterSwitchWarning: arbiterSwitchWarningRef.current,
            };
            setHistory(prev => [newRun, ...prev]);
        }
    }, [prompt, images, isLoading, agentConfigs, arbiterModel, openAIArbiterVerbosity, geminiArbiterEffort, openAIAgentCount, openAIApiKey, queryHistory, selectedRunId]);
    
    const handleReset = useCallback(() => {
        setPrompt('');
        setImages([]);
        setAgentConfigs(createDefaultAgentConfigs());
        setArbiterModel(GEMINI_PRO_MODEL);
        setOpenAIArbiterVerbosity('medium');
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

    const handleSelectRun = useCallback((id: string) => {
        const run = history.find(r => r.id === id);
        if (run) {
            setSelectedRunId(id);
        }
    }, [history]);
    
    const handleDuplicateAgent = useCallback((id: string) => {
        setAgentConfigs(prev => {
            const sourceConfig = prev.find(c => c.id === id);
            if (!sourceConfig) return prev;

            const newConfig = {
                ...sourceConfig,
                id: `${sourceConfig.expert.id}-${Date.now()}`,
                status: 'PENDING' as const,
            };

            const index = prev.findIndex(c => c.id === id);
            const newConfigs = [...prev];
            newConfigs.splice(index + 1, 0, newConfig);
            return newConfigs;
        });
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
            geminiArbiterEffort,
            finalAnswer,
            agents,
            arbiterSwitchWarning,
            isHistoryView: false,
        };
    }, [selectedRun, prompt, images, agentConfigs, arbiterModel, openAIArbiterVerbosity, geminiArbiterEffort, finalAnswer, agents, arbiterSwitchWarning]);


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

        successfulDrafts.forEach(agent => {
            const fileContent = `# Prompt\n\n${dataToSave.prompt}\n\n---\n\n# Agent ${agent.id + 1} (${agent.provider}, ${agent.name})\n\n${agent.content}`;
            const agentFilename = `${baseFilename}-agent-${agent.id + 1}-${agent.name.toLowerCase().replace(/\s+/g, '-')}.md`;
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
                geminiArbiterEffort,
                openAIApiKey,
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
            alert("An error occurred while trying to save the session.");
        }
    }, [prompt, agentConfigs, arbiterModel, openAIArbiterVerbosity, geminiArbiterEffort, openAIApiKey, queryHistory]);
    
    const handleLoadSession = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const jsonString = event.target?.result as string;
                if (!jsonString) {
                    throw new Error("File is empty or could not be read.");
                }

                const data = JSON.parse(jsonString) as SessionData;

                if (data.version !== SESSION_DATA_VERSION) {
                    alert(`This session file is from a different version (v${data.version}) and cannot be loaded.`);
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
                        id: `${expert.id}-${Date.now()}`,
                        expert,
                        model: savedConfig.model,
                        provider: savedConfig.provider,
                        status: 'PENDING' as const,
                    };
                    if (savedConfig.provider === 'gemini') {
                        return { ...baseConfig, provider: 'gemini', settings: savedConfig.settings } as GeminiAgentConfig;
                    } else {
                        return { ...baseConfig, provider: 'openai', settings: savedConfig.settings } as OpenAIAgentConfig;
                    }
                }).filter((config): config is AgentConfig => config !== null);

                handleNewRun(); // Clear current state before loading
                setPrompt(data.prompt ?? '');
                setAgentConfigs(loadedAgentConfigs);
                setArbiterModel(data.arbiterModel ?? GEMINI_PRO_MODEL);
                setOpenAIArbiterVerbosity(data.openAIArbiterVerbosity ?? 'medium');
                setGeminiArbiterEffort(data.geminiArbiterEffort ?? 'dynamic');
                handleSaveApiKey(data.openAIApiKey ?? '');
                setQueryHistory(data.queryHistory ?? []);
                
                setIsSettingsViewOpen(false);
                alert("Session loaded successfully!");

            } catch (e) {
                console.error("Failed to load session:", e);
                const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
                alert(`Error loading session file: ${errorMessage}`);
            }
        };

        reader.onerror = () => {
            alert("Failed to read the session file.");
        };

        reader.readAsText(file);
    }, [handleSaveApiKey, handleNewRun]);

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
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex h-screen">
            <HistorySidebar 
                history={history}
                selectedRunId={selectedRunId}
                onSelectRun={handleSelectRun}
                onNewRun={handleNewRun}
                currentRunStatus={currentRunStatus}
            />
            <div className="flex-1 flex flex-col h-screen">
                 <SettingsView
                    isOpen={isSettingsViewOpen}
                    onClose={() => setIsSettingsViewOpen(false)}
                    onSaveApiKey={handleSaveApiKey}
                    currentApiKey={openAIApiKey}
                    onSaveSession={handleSaveSession}
                    onLoadSession={handleLoadSession}
                    queryHistory={queryHistory}
                    onSelectQuery={handleSelectQuery}
                />
                <div className="flex-1 overflow-y-auto">
                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <header className="text-center py-8 relative">
                            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 flex items-center justify-center gap-3">
                                <SparklesIcon className="w-10 h-10 text-indigo-400" />
                                Gemini Heavy Orchestrator
                            </h1>
                            <div className="absolute top-8 right-0 flex items-center gap-2">
                                <button
                                    onClick={handleSaveAll}
                                    disabled={!hasResults || isLoading}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                                    title="Save final answer and all drafts to a ZIP file"
                                >
                                    <DownloadIcon className="w-4 h-4" />
                                    Save
                                </button>
                                <button
                                    onClick={() => setIsSettingsViewOpen(true)}
                                    className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700/50"
                                    title="Settings"
                                    aria-label="Open Settings"
                                >
                                    <CogIcon className="w-6 h-6" />
                                </button>
                            </div>
                            <p className="mt-4 text-lg text-gray-400 max-w-3xl mx-auto">
                            Directly configure a 'Mixture-of-Experts' ensemble. Parallel agents generate diverse drafts, and a final arbiter synthesizes the optimal response.
                            </p>
                        </header>

                        <main className="max-w-4xl mx-auto space-y-8 pb-40">
                            {error && !displayData.isHistoryView && <div className="p-3 bg-red-900/50 text-red-300 border border-red-700 rounded-lg text-sm text-center">{error}</div>}

                            {openAIAgentCount > 0 && !openAIApiKey && (
                                <p className="text-xs text-yellow-400 text-center p-2 bg-yellow-900/40 rounded-md border border-yellow-800">
                                    OpenAI API key is required. 
                                    <button onClick={() => setIsSettingsViewOpen(true)} className="ml-1 underline font-semibold hover:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded">
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
                                            className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 px-4 py-3 rounded-lg relative" 
                                            role="alert"
                                            variants={itemVariants}
                                        >
                                            <div className="flex items-start">
                                                <ExclamationTriangleIcon className="w-5 h-5 mr-3 mt-0.5 text-yellow-400 flex-shrink-0" />
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
                                                    {displayData.agents.map((agent) => (
                                                        <motion.div
                                                            key={agent.id}
                                                            variants={itemVariants}
                                                        >
                                                            <AgentCard agent={agent} />
                                                        </motion.div>
                                                    ))}
                                                </motion.div>
                                            </CollapsibleSection>
                                        </motion.section>
                                    )}
                                </motion.div>
                            )}

                            <div className="space-y-6 bg-gray-800/50 p-6 rounded-xl shadow-2xl border border-gray-700">
                                <AgentEnsemble
                                    agentConfigs={displayData.agentConfigs}
                                    setAgentConfigs={setAgentConfigs}
                                    onDuplicateAgent={handleDuplicateAgent}
                                    disabled={isLoading || displayData.isHistoryView}
                                />
                                <div className="border-t border-gray-700 pt-4">
                                    <CollapsibleSection title="Arbiter Settings" defaultOpen={true}>
                                        <div className="space-y-4">
                                            <ArbiterSettings 
                                                arbiterModel={displayData.arbiterModel}
                                                setArbiterModel={setArbiterModel}
                                                openAIArbiterVerbosity={displayData.openAIArbiterVerbosity}
                                                setOpenAIArbiterVerbosity={setOpenAIArbiterVerbosity}
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

                <footer className="sticky bottom-0 z-10 bg-gray-900/80 backdrop-blur-lg border-t border-gray-700 flex-shrink-0">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
                        {isLoading && (
                            <div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressData.total}%` }}></div>
                                </div>
                                <p className="text-center text-xs text-gray-400 mt-1">
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
                        />
                    </div>
                </footer>
            </div>
        </div>
    );
};

// Extracted for cleanliness
const ArbiterSettings: React.FC<{
    arbiterModel: ArbiterModel;
    setArbiterModel: (model: ArbiterModel) => void;
    openAIArbiterVerbosity: OpenAIVerbosity;
    setOpenAIArbiterVerbosity: (verbosity: OpenAIVerbosity) => void;
    geminiArbiterEffort: GeminiThinkingEffort;
    setGeminiArbiterEffort: (effort: GeminiThinkingEffort) => void;
    isLoading: boolean;
}> = ({ arbiterModel, setArbiterModel, openAIArbiterVerbosity, setOpenAIArbiterVerbosity, geminiArbiterEffort, setGeminiArbiterEffort, isLoading }) => {
    const arbiterModelOptions: { label: string; value: ArbiterModel; tooltip: string }[] = [
        { label: 'Gemini 2.5 Pro', value: GEMINI_PRO_MODEL, tooltip: 'Google\'s most capable model, with a large context window and strong reasoning. Recommended for complex synthesis.' },
        { label: 'GPT-5 (Med)', value: OPENAI_ARBITER_GPT5_MEDIUM_REASONING, tooltip: 'OpenAI\'s powerful GPT-5 model with standard reasoning. A strong, balanced choice for arbitration.' },
        { label: 'GPT-5 (High)', value: OPENAI_ARBITER_GPT5_HIGH_REASONING, tooltip: 'GPT-5 with enhanced, step-by-step reasoning. May produce higher quality synthesis for nuanced topics at a higher latency.' }
    ];
    const openAIVerbosityOptions: { label: string; value: OpenAIVerbosity }[] = [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' }
    ];
    const geminiEffortOptions: { label: string, value: GeminiThinkingEffort }[] = [
        { label: 'Dynamic', value: 'dynamic' },
        { label: 'High', value: 'high' },
        { label: 'Medium', value: 'medium' },
        { label: 'Low', value: 'low' },
    ];

    return (
        <>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Arbiter Model</label>
                <SegmentedControl
                    aria-label="Arbiter Model"
                    options={arbiterModelOptions}
                    value={arbiterModel}
                    onChange={setArbiterModel}
                    disabled={isLoading}
                />
            </div>
            {arbiterModel.startsWith('gpt-') ? (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Arbiter Verbosity</label>
                    <SegmentedControl
                        aria-label="Arbiter Verbosity"
                        options={openAIVerbosityOptions}
                        value={openAIArbiterVerbosity}
                        onChange={setOpenAIArbiterVerbosity}
                        disabled={isLoading}
                    />
                </div>
            ) : (
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Thinking Effort</label>
                    <SegmentedControl
                        aria-label="Arbiter Thinking Effort"
                        options={geminiEffortOptions.filter(o => o.value !== 'none')}
                        value={geminiArbiterEffort}
                        onChange={(v) => setGeminiArbiterEffort(v as GeminiThinkingEffort)}
                        disabled={isLoading}
                    />
                </div>
            )}
        </>
    );
};


export default App;