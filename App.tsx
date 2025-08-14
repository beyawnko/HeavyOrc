import React, { useState, useCallback, useMemo } from 'react';
import { AgentState, AgentStatus } from './types';
import { AGENT_PERSONAS } from './constants';
import { generateDrafts, generateFinalAnswerStream } from './services/geminiService';
import AgentCard from './components/AgentCard';
import { SparklesIcon, LoadingSpinner } from './components/icons';

const App: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('');
    const [agentCount, setAgentCount] = useState<number>(4);
    const [agents, setAgents] = useState<AgentState[]>([]);
    const [finalAnswer, setFinalAnswer] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isArbiterRunning, setIsArbiterRunning] = useState<boolean>(false);
    
    const initializeAgents = useCallback((count: number) => {
        return Array.from({ length: count }).map((_, i) => ({
            id: i,
            persona: AGENT_PERSONAS[i % AGENT_PERSONAS.length],
            status: AgentStatus.PENDING,
            content: '',
            error: null,
        }));
    }, []);
    
    const handleRun = async () => {
        if (!prompt || isLoading) return;

        setIsLoading(true);
        setError(null);
        setFinalAnswer('');
        setIsArbiterRunning(false);

        const initialAgents = initializeAgents(agentCount);
        setAgents(initialAgents.map(a => ({ ...a, status: AgentStatus.RUNNING })));

        try {
            const onDraftUpdate = (completedAgent: AgentState) => {
                setAgents(prev => prev.map(a => a.id === completedAgent.id ? completedAgent : a));
            };

            const completedDrafts = await generateDrafts(prompt, initialAgents, onDraftUpdate);

            const successfulDrafts = completedDrafts.filter(d => d.status === AgentStatus.COMPLETED);

            if (successfulDrafts.length === 0) {
                throw new Error("All agents failed to generate drafts. Cannot proceed.");
            }

            setIsArbiterRunning(true);

            const stream = await generateFinalAnswerStream(prompt, completedDrafts);
            let fullText = '';
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                fullText += chunkText;
                setFinalAnswer(fullText);
            }

        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
            setIsArbiterRunning(false);
        }
    };
    
    const progressPercentage = useMemo(() => {
        if (!isLoading) return 0;
        const completedCount = agents.filter(a => a.status === AgentStatus.COMPLETED || a.status === AgentStatus.FAILED).length;
        const agentProgress = (completedCount / agentCount) * 100 * 0.5; // Agents are 50% of the work
        const arbiterProgress = isArbiterRunning ? (finalAnswer.length > 0 ? 50 : 0) : 0; // Arbiter is other 50%
        return Math.min(agentProgress + arbiterProgress, 100);
    }, [agents, agentCount, isLoading, isArbiterRunning, finalAnswer]);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500 flex items-center justify-center gap-3">
                        <SparklesIcon className="w-10 h-10" />
                        Gemini Heavy Orchestrator
                    </h1>
                    <p className="mt-4 text-lg text-gray-400 max-w-3xl mx-auto">
                        Simulating a Mixture-of-Experts. Parallel agents generate diverse drafts, and a final arbiter synthesizes the optimal response.
                    </p>
                </header>

                <main className="space-y-8">
                    <div className="bg-gray-800/50 p-6 rounded-xl shadow-2xl border border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2">
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
                            <div>
                                <label htmlFor="agent-count" className="block text-sm font-medium text-gray-300 mb-2">Agent Count: {agentCount}</label>
                                <input
                                    id="agent-count"
                                    type="range"
                                    min="2"
                                    max={AGENT_PERSONAS.length}
                                    value={agentCount}
                                    onChange={(e) => setAgentCount(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    disabled={isLoading}
                                />
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
                                    <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
                                </div>
                                <p className="text-center text-sm text-gray-400 mt-2">
                                    {isArbiterRunning ? 'Arbiter is synthesizing the final answer...' : `Agents are generating drafts... (${Math.round(progressPercentage * 2)}%)`}
                                </p>
                            </div>
                        )}
                        {error && <div className="mt-4 p-3 bg-red-900/50 text-red-300 border border-red-700 rounded-lg text-center">{error}</div>}
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-300 mb-4">Agent Drafts</h2>
                            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${!agents.length && 'hidden'}`}>
                                {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
                            </div>
                        </div>

                        <div className={`${!finalAnswer && !isArbiterRunning ? 'hidden' : ''}`}>
                            <h2 className="text-2xl font-bold text-gray-300 mb-4">Arbiter's Final Answer</h2>
                            <div className="bg-gray-800/50 p-6 rounded-xl shadow-inner border border-gray-700 min-h-[150px]">
                                <p className="text-gray-200 whitespace-pre-wrap font-serif leading-relaxed">
                                    {finalAnswer}
                                    {isArbiterRunning && !finalAnswer.endsWith(' ') && <span className="inline-block w-2 h-5 bg-indigo-400 animate-pulse ml-1" />}
                                </p>
                            </div>
                        </div>
                    </div>
                </main>

                <footer className="text-center mt-12 py-4 border-t border-gray-800">
                    <p className="text-sm text-gray-500">Built with React, TypeScript, Tailwind CSS, and the Google Gemini API.</p>
                </footer>
            </div>
        </div>
    );
};

export default App;