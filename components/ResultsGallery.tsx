import React, { useState, useEffect } from 'react';
import { AgentState } from '../types';
import AgentCard from './AgentCard';
import FinalAnswerCard from './FinalAnswerCard';

interface ResultsGalleryProps {
    agents: AgentState[];
    finalAnswer: string;
    prompt: string;
    onReset: () => void;
}

const ANIMATION_START_DELAY_MS = 100;

const ResultsGallery = ({ agents, finalAnswer, prompt, onReset }: ResultsGalleryProps) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Trigger animations after mount
        const timer = setTimeout(() => setVisible(true), ANIMATION_START_DELAY_MS);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <header className="text-center space-y-4">
                 <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
                    Orchestration Complete
                </h1>
                <button
                    onClick={onReset}
                    className={`bg-gray-700 text-white font-semibold rounded-lg shadow-md px-6 py-2 hover:bg-gray-600 transition-all duration-300 opacity-0 ${visible ? 'animate-fade-in-up' : ''}`}
                    style={{ animationDelay: '1.0s' }}
                >
                    Start New Query
                </button>
            </header>
            
            <main className="space-y-12">
                <section>
                    <FinalAnswerCard
                        answer={finalAnswer}
                        prompt={prompt}
                        className={`opacity-0 ${visible ? 'animate-zoom-in' : ''}`}
                        style={{ animationDelay: '0.2s' }}
                    />
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-gray-300 mb-4 text-center">Contributing Agent Drafts</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {agents.map((agent, index) => (
                            <div
                                key={agent.id}
                                className={`opacity-0 ${visible ? 'animate-fade-in-up' : ''}`}
                                style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                            >
                                <AgentCard agent={agent} />
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            <footer className="text-center mt-12 py-4 border-t border-gray-800">
                <p className="text-sm text-gray-500">Built with React, TypeScript, Tailwind CSS, and the Google Gemini API.</p>
            </footer>
        </div>
    );
};

export default ResultsGallery;