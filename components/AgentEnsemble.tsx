


import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { experts } from '@/moe/experts';
import { AgentConfig, GeminiAgentConfig, Expert } from '@/types';
import AgentConfigCard from '@/components/AgentConfigCard';
import { PlusIcon } from '@/components/icons';
import AddExpertModal from '@/components/AddExpertModal';

interface AgentEnsembleProps {
    agentConfigs: AgentConfig[];
    setAgentConfigs: React.Dispatch<React.SetStateAction<AgentConfig[]>>;
    onDuplicateAgent: (id: string) => void;
    disabled: boolean;
}

export interface AgentEnsembleHandles {
    openModal: () => void;
}

const AgentEnsemble = forwardRef<AgentEnsembleHandles, AgentEnsembleProps>(({ agentConfigs, setAgentConfigs, onDuplicateAgent, disabled }, ref) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    useImperativeHandle(ref, () => ({
        openModal: () => setIsModalOpen(true),
    }));

    const handleAddAgent = (expert: Expert) => {
        const newAgent: GeminiAgentConfig = {
            id: crypto.randomUUID(),
            expert: expert,
            model: 'gemini-2.5-flash',
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
            },
        };
        setAgentConfigs(prev => [...prev, newAgent]);
    };

    const handleUpdateAgent = (id: string, newConfig: AgentConfig) => {
        setAgentConfigs(prev => prev.map(agent => (agent.id === id ? newConfig : agent)));
    };

    const handleRemoveAgent = (id: string) => {
        setAgentConfigs(prev => prev.filter(agent => agent.id !== id));
    };
    
    const availableExperts = experts.filter(expert => !agentConfigs.some(ac => ac.expert.id === expert.id));
    
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-[var(--text)]">Agent Ensemble</h3>
                {availableExperts.length > 0 && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        disabled={disabled}
                        className="flex items-center justify-center gap-2 px-3 py-1 bg-[var(--accent)] text-[#0D1411] text-sm font-semibold rounded-lg shadow-md hover:brightness-110 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <PlusIcon className="w-4 h-4" aria-hidden="true" />
                        Add Expert
                    </button>
                )}
            </div>
            
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                {agentConfigs.map((config, idx) => (
                    <AgentConfigCard
                        key={config.id}
                        config={config}
                        onUpdate={handleUpdateAgent}
                        onRemove={handleRemoveAgent}
                        onDuplicate={onDuplicateAgent}
                        disabled={disabled}
                        displayId={idx + 1}
                    />
                ))}
            </div>

             <AddExpertModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAddExpert={handleAddAgent}
                availableExperts={availableExperts}
            />
        </div>
    );
};

export default AgentEnsemble;
