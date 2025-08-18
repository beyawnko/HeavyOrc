
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { AgentState, ApiProvider } from './types';
import { 
    GEMINI_PRO_MODEL, 
    OPENAI_ARBITER_GPT5_MEDIUM_REASONING,
    OPENAI_ARBITER_GPT5_HIGH_REASONING
} from './constants';
import { experts } from './moe/experts';
import { runOrchestration } from './moe/orchestrator';
import { Draft, ExpertDispatch } from './moe/types';
import AgentCard from './components/AgentCard';
import { SparklesIcon, LoadingSpinner, CogIcon } from './components/icons';
import ResultsGallery from './components/ResultsGallery';
import ApiKeyModal from './components/ApiKeyModal';
import { setOpenAIApiKey as storeOpenAIApiKey } from './services/llmService';

type ArbiterModel = typeof GEMINI_PRO_MODEL | typeof OPENAI_ARBITER_GPT5_MEDIUM_REASONING | typeof OPENAI_ARBITER_GPT5_HIGH_REASONING;
const OPENAI_API_KEY_STORAGE_KEY = 'openai_api_key';

const mapDraftToAgentState = (draft: Draft, id: number): AgentState => ({
    id,
    persona: draft.expert.persona,
    status: draft.status,
    content: draft.content,
    error: draft.error || null,
    model: draft.expert.model,
    provider: draft.expert.provider,
});

const App: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('');
    const [agentCount, setAgentCount] = useState<number>(4);
    const [geminiAgentCount, setGeminiAgentCount] = useState<number>(2);
    const [proAgentCount, setProAgentCount] = useState<number>(0);
    
    const [enableGeminiThinking, setEnableGeminiThinking] = useState(true);
    const [enableOpenAIReasoning, setEnableOpenAIReasoning] = useState(false);
    const [arbiterModel, setArbiterModel] = useState<ArbiterModel>(GEMINI_PRO_MODEL);

    const [agents, setAgents] = useState<AgentState[]>([]);
    const [finalAnswer, setFinalAnswer] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isArbiterRunning, setIsArbiterRunning] = useState<boolean>(false);
    const [view, setView] = useState<'input' | 'results'>('input');

    const [openAIApiKey, setOpenAIApiKey] = useState<string>('');
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
    
    const animationFrameId = useRef<number | null>(null);
    
    useEffect(() => {
        const savedKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
        if (savedKey) {
            setOpenAIApiKey(savedKey);
            storeOpenAIApiKey(savedKey);
        }
    }, []);

    const handleSaveApiKey = (newKey: string) => {
        setOpenAIApiKey(newKey);
        storeOpenAIApiKey(newKey);
        localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, newKey);
    };

    useEffect(() => {
        if (geminiAgentCount > agentCount) {
            setGeminiAgentCount(agentCount);
        }
    }, [agentCount, geminiAgentCount]);

    useEffect(() => {
        if (proAgentCount > geminiAgentCount) {
            setProAgentCount(geminiAgentCount);
        }
    }, [geminiAgentCount, proAgentCount]);

    const openAIAgentCount = agentCount - geminiAgentCount;
    
    const handleRun = useCallback(async () => {
        if (!prompt || isLoading) return;

        if (openAIAgentCount > 0 && !openAIApiKey) {
            setError("Please set your OpenAI API key in the settings to use OpenAI models.");
            setIsApiKeyModalOpen(true);
            return;
        }

        setIsLoading(true);
        setError(null);
        setFinalAnswer('');
        setIsArbiterRunning(false);
        setAgents([]);
        
        try {
            const onInitialAgents = (dispatchedExperts: ExpertDispatch[]) => {
                const initialAgents = dispatchedExperts.map((expert, i): AgentState => ({
                    id: i,
                    persona: expert.persona,
                    status: 'RUNNING',
                    content: '',
                    error: null,
                    model: expert.model,
                    provider: expert.provider,
                }));
                setAgents(initialAgents);
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
            };

            const { stream } = await runOrchestration({
                prompt,
                totalAgentCount: agentCount,
                geminiAgentCount,
                proAgentCount,
                arbiterModel,
                enableGeminiThinking,
                enableOpenAIReasoning,
            }, { onInitialAgents, onDraftComplete: onDraftUpdate });

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
            
            setView('results');

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred.';
            setError(errorMessage);
            setAgents(prev => prev.map(a => ({...a, status: 'FAILED', error: errorMessage})))
        } finally {
            setIsLoading(false);
            setIsArbiterRunning(false);
        }
    }, [prompt, isLoading, agentCount, geminiAgentCount, proAgentCount, arbiterModel, enableGeminiThinking, enableOpenAIReasoning, openAIAgentCount, openAIApiKey]);
    
    const handleReset = useCallback(() => {
        setPrompt('');
        setAgentCount(4);
        setGeminiAgentCount(2);
        setProAgentCount(0);
        setEnableGeminiThinking(true);
        setEnableOpenAIReasoning(false);
        setArbiterModel(GEMINI_PRO_MODEL);
        setAgents([]);
        setFinalAnswer('');
        setIsLoading(false);
        setError(null);
        setIsArbiterRunning(false);
        setView('input');
    }, []);

    const progressData = useMemo(() => {
        if (!isLoading) {
            return { total: 0, agentPercent: 0, phase: 'idle' };
        }
        const AGENT_PHASE_WEIGHT = 0.5;
        const ARBITER_PHASE_WEIGHT = 0.5;
        
        const completedCount = agents.filter(a => a.status === 'COMPLETED' || a.status === 'FAILED').length;
        const agentPhaseProgress = agentCount > 0 ? (completedCount / agentCount) : 0;
        
        let arbiterPhaseProgress = 0;
        if (view === 'results') {
            arbiterPhaseProgress = 1;
        } else if (isArbiterRunning) {
            // Use a simple time-based progress for the arbiter since we don't know the total chunks
            arbiterPhaseProgress = 0.5; // Represents 'in-progress'
        }

        const total = (agentPhaseProgress * AGENT_PHASE_WEIGHT + arbiterPhaseProgress * ARBITER_PHASE_WEIGHT) * 100;
        const phase = isArbiterRunning ? 'arbitrating' : 'drafting';

        return { total: Math.min(total, 100), agentPercent: agentPhaseProgress * 100, phase };
    }, [agents, agentCount, isLoading, isArbiterRunning, view]);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
            <ApiKeyModal
                isOpen={isApiKeyModalOpen}
                onClose={() => setIsApiKeyModalOpen(false)}
                onSave={handleSaveApiKey}
                currentApiKey={openAIApiKey}
            />
            {view === 'results' ? (
                 <ResultsGallery 
                    agents={agents}
                    finalAnswer={finalAnswer}
                    prompt={prompt}
                    onReset={handleReset}
                 />
            ) : (
                <div className="max-w-7xl mx-auto">
                    <header className="text-center mb-8">
                        <div className="relative">
                            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500 flex items-center justify-center gap-3">
                                <SparklesIcon className="w-10 h-10" />
                                Gemini Heavy Orchestrator
                            </h1>
                             <button
                                onClick={() => setIsApiKeyModalOpen(true)}
                                className="absolute top-1/2 -translate-y-1/2 right-0 p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700/50"
                                title="API Key Settings"
                                aria-label="Open API Key Settings"
                            >
                                <CogIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <p className="mt-4 text-lg text-gray-400 max-w-3xl mx-auto">
                            Simulating a Mixture-of-Experts. Parallel agents generate diverse drafts, and a final arbiter synthesizes the optimal response.
                        </p>
                    </header>

                    <main className="space-y-8">
                        <div className="bg-gray-800/50 p-6 rounded-xl shadow-2xl border border-gray-700">
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-3">
                                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">Your Prompt</label>
                                    <textarea
                                        id="prompt"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="e.g., Explain the trade-offs between monoliths and microservices."
                                        className="w-full h-24 p-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>
                            
                            <div className="mt-6 border-t border-gray-700 pt-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div>
                                        <label htmlFor="agent-count" className="block text-sm font-medium text-gray-300 mb-2">Total Agents: {agentCount}</label>
                                        <input id="agent-count" type="range" min="2" max={experts.length} value={agentCount} onChange={(e) => setAgentCount(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" disabled={isLoading} />
                                    </div>
                                    <div>
                                        <label htmlFor="gemini-agent-count" className="block text-sm font-medium text-gray-300 mb-2">Agent Mix: {geminiAgentCount} Gemini / {openAIAgentCount} OpenAI</label>
                                        <input id="gemini-agent-count" type="range" min="0" max={agentCount} value={geminiAgentCount} onChange={(e) => setGeminiAgentCount(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500" disabled={isLoading} />
                                        {openAIAgentCount > 0 && !openAIApiKey && (
                                            <p className="text-xs text-yellow-400 mt-2">
                                                OpenAI API key is required. 
                                                <button onClick={() => setIsApiKeyModalOpen(true)} className="ml-1 underline font-semibold hover:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded">
                                                    Set API Key
                                                </button>
                                            </p>
                                        )}
                                    </div>
                                    <div className={`${geminiAgentCount === 0 ? 'opacity-50' : ''}`}>
                                        <label htmlFor="pro-agent-count" className="block text-sm font-medium text-gray-300 mb-2" title={geminiAgentCount === 0 ? "No Gemini agents selected" : "Number of Gemini agents to use gemini-2.5-pro"}>
                                            Gemini Pro Agents: {proAgentCount}
                                        </label>
                                        <input id="pro-agent-count" type="range" min="0" max={geminiAgentCount} value={proAgentCount} onChange={(e) => setProAgentCount(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:cursor-not-allowed" disabled={isLoading || geminiAgentCount === 0} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg border border-gray-600">
                                        <label htmlFor="gemini-thinking" className="text-sm font-medium text-gray-300">Enable Gemini Thinking</label>
                                        <button type="button" onClick={() => setEnableGeminiThinking(!enableGeminiThinking)} disabled={isLoading || geminiAgentCount === 0} className={`${enableGeminiThinking ? 'bg-indigo-600' : 'bg-gray-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50`} role="switch" aria-checked={enableGeminiThinking}>
                                            <span className={`${enableGeminiThinking ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg border border-gray-600">
                                        <label htmlFor="openai-reasoning" className="text-sm font-medium text-gray-300">Enable OpenAI Reasoning</label>
                                        <button type="button" onClick={() => setEnableOpenAIReasoning(!enableOpenAIReasoning)} disabled={isLoading || openAIAgentCount === 0} className={`${enableOpenAIReasoning ? 'bg-indigo-600' : 'bg-gray-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50`} role="switch" aria-checked={enableOpenAIReasoning}>
                                            <span className={`${enableOpenAIReasoning ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
                                        </button>
                                    </div>
                                    <div>
                                        <label htmlFor="arbiter-model" className="block text-sm font-medium text-gray-300 mb-2">Arbiter Model</label>
                                        <select id="arbiter-model" value={arbiterModel} onChange={(e) => setArbiterModel(e.target.value as ArbiterModel)} disabled={isLoading} className="w-full p-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition">
                                            <option value={GEMINI_PRO_MODEL}>Gemini 2.5 Pro</option>
                                            <option value={OPENAI_ARBITER_GPT5_MEDIUM_REASONING}>GPT-5 (Medium)</option>
                                            <option value={OPENAI_ARBITER_GPT5_HIGH_REASONING}>GPT-5 (High)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-6 text-center">
                                <button
                                    onClick={handleRun}
                                    disabled={isLoading || !prompt}
                                    className="w-full sm:w-auto px-12 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center mx-auto"
                                >
                                    {isLoading ? (
                                        <>
                                            <LoadingSpinner className="w-5 h-5 mr-3 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                          <SparklesIcon className="w-5 h-5 mr-3" />
                                          Run Orchestration
                                        </>
                                    )}
                                </button>
                            </div>
                            {isLoading && (
                                <div className="mt-6">
                                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                                        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressData.total}%` }}></div>
                                    </div>
                                    <p className="text-center text-sm text-gray-400 mt-2">
                                        {progressData.phase === 'arbitrating' ? `Arbiter is synthesizing the final answer...` : `Agents are generating drafts... (${Math.round(progressData.agentPercent)}%)`}
                                    </p>
                                </div>
                            )}
                            {error && <div className="mt-4 p-3 bg-red-900/50 text-red-300 border border-red-700 rounded-lg text-center">{error}</div>}
                        </div>

                        <div className="space-y-6">
                            <div className={`${!agents.length && 'hidden'}`}>
                                <h2 className="text-2xl font-bold text-gray-300 mb-4">Agent Drafts</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
                                </div>
                            </div>

                            <div className={`${!finalAnswer && !isArbiterRunning ? 'hidden' : ''}`}>
                                <h2 className="text-2xl font-bold text-gray-300 mb-4">Arbiter's Final Answer</h2>
                                <div className="bg-gray-800/50 p-6 rounded-xl shadow-inner border border-gray-700 min-h-[150px]">
                                    <p className="text-gray-200 whitespace-pre-wrap font-serif leading-relaxed">
                                        {finalAnswer}
                                        {isArbiterRunning && view === 'input' && !finalAnswer.endsWith(' ') && <span className="inline-block w-2 h-5 bg-indigo-400 animate-pulse ml-1" />}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </main>

                    <footer className="text-center mt-12 py-4 border-t border-gray-800">
                        <p className="text-sm text-gray-500">Built with React, TypeScript, Tailwind CSS, and the Google Gemini API.</p>
                    </footer>
                </div>
            )}
        </div>
    );
};

export default App;
