

import React from 'react';
import { AgentConfig, AgentModel, GeminiAgentConfig, GeminiAgentSettings, OpenAIAgentConfig, OpenAIAgentSettings, AgentStatus, GeminiModel, OpenAIModel, GeminiThinkingEffort } from '../types';
import { GEMINI_FLASH_MODEL, GEMINI_PRO_MODEL, OPENAI_AGENT_MODEL } from '../constants';
import { XCircleIcon, LoadingSpinner, CheckCircleIcon, DocumentDuplicateIcon } from './icons';

interface AgentConfigCardProps {
  config: AgentConfig;
  onUpdate: (id: string, newConfig: AgentConfig) => void;
  onRemove: (id:string) => void;
  onDuplicate: (id: string) => void;
  disabled: boolean;
}

const getStatusIndicator = (status: AgentStatus): React.ReactNode => {
    switch (status) {
        case 'RUNNING':
            return <LoadingSpinner className="h-5 w-5 text-blue-400 animate-spin" />;
        case 'COMPLETED':
            return <CheckCircleIcon className="h-5 w-5 text-green-400" />;
        case 'FAILED':
            return <XCircleIcon className="h-5 w-5 text-red-400" />;
        case 'PENDING':
        case 'QUEUED':
        default:
            return null;
    }
};

const getBorderColor = (status: AgentStatus): string => {
    switch(status) {
        case 'RUNNING':
            return 'border-blue-500/80 ring-2 ring-blue-500/50';
        case 'COMPLETED':
            return 'border-green-500/80';
        case 'FAILED':
            return 'border-red-500/80';
        case 'PENDING':
        case 'QUEUED':
        default:
            return 'border-gray-600';
    }
}

const AgentConfigCard: React.FC<AgentConfigCardProps> = ({ config, onUpdate, onRemove, onDuplicate, disabled }) => {
    
    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newModelValue = e.target.value as AgentModel;

        if (newModelValue.startsWith('gemini')) {
            const newModel = newModelValue as GeminiModel;
            if (config.provider === 'gemini') {
                onUpdate(config.id, { ...config, model: newModel });
            } else {
                const newConfig: GeminiAgentConfig = {
                    id: config.id,
                    expert: config.expert,
                    status: config.status,
                    provider: 'gemini',
                    model: newModel,
                    settings: { effort: 'dynamic' },
                };
                onUpdate(config.id, newConfig);
            }
        } 
        else {
            const newModel = newModelValue as OpenAIModel;
            if (config.provider === 'openai') {
                onUpdate(config.id, { ...config, model: newModel });
            } else {
                const newConfig: OpenAIAgentConfig = {
                    id: config.id,
                    expert: config.expert,
                    status: config.status,
                    provider: 'openai',
                    model: newModel,
                    settings: { effort: 'medium', verbosity: 'medium' },
                };
                onUpdate(config.id, newConfig);
            }
        }
    };

    const handleGeminiSettingChange = (key: keyof GeminiAgentSettings, value: string) => {
        const geminiConfig = config as GeminiAgentConfig;
        onUpdate(config.id, {
            ...geminiConfig,
            settings: { ...geminiConfig.settings, [key]: value as GeminiThinkingEffort }
        });
    };

    const handleOpenAISettingChange = (key: keyof OpenAIAgentSettings, value: string) => {
        const openAIConfig = config as OpenAIAgentConfig;
        onUpdate(config.id, {
            ...openAIConfig,
            settings: { ...openAIConfig.settings, [key]: value }
        });
    };

    const borderColor = getBorderColor(config.status);

    return (
        <div className={`relative group bg-gray-800/50 p-4 rounded-lg border transition-all duration-300 ${borderColor}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-gray-200">{config.expert.name}</h4>
                    <p className="text-xs text-gray-400 italic mt-1 pr-8">Persona: {config.expert.persona}</p>
                </div>
                <div className="flex-shrink-0">
                    {getStatusIndicator(config.status)}
                </div>
            </div>

            <div 
                className={`absolute top-3 right-3 flex items-center gap-1.5 transition-opacity ${disabled ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}
            >
                <button 
                    onClick={() => onDuplicate(config.id)} 
                    disabled={disabled} 
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Duplicate Agent"
                >
                    <DocumentDuplicateIcon className="w-5 h-5" />
                    <span className="sr-only">Duplicate Agent</span>
                </button>
                <button 
                    onClick={() => onRemove(config.id)} 
                    disabled={disabled} 
                    className="p-1 text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove Agent"
                >
                    <XCircleIcon className="w-5 h-5" />
                    <span className="sr-only">Remove Agent</span>
                </button>
            </div>


            <div className="mt-4 space-y-3">
                <div>
                    <label htmlFor={`model-${config.id}`} className="block text-sm font-medium text-gray-400 mb-1">Model</label>
                    <select
                        id={`model-${config.id}`}
                        value={config.model}
                        onChange={handleModelChange}
                        disabled={disabled}
                        className="w-full p-1.5 text-sm bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value={GEMINI_PRO_MODEL}>Gemini 2.5 Pro</option>
                        <option value={GEMINI_FLASH_MODEL}>Gemini 2.5 Flash</option>
                        <option value={OPENAI_AGENT_MODEL}>OpenAI GPT-5</option>
                    </select>
                </div>

                {config.provider === 'gemini' &&
                    <div>
                        <label htmlFor={`gemini-effort-${config.id}`} className="block text-sm font-medium text-gray-400 mb-1">Thinking Effort</label>
                        <select
                            id={`gemini-effort-${config.id}`}
                            value={config.settings.effort}
                            onChange={(e) => handleGeminiSettingChange('effort', e.target.value)}
                            disabled={disabled}
                            className="w-full p-1.5 text-sm bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500"
                            title="Controls how much 'thinking' the Gemini model performs before answering. 'Dynamic' is recommended. 'High' can improve quality for complex tasks but increases latency. 'None' is fastest but least thorough."
                        >
                            <option value="dynamic">Dynamic</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                            <option value="none" disabled={config.model === GEMINI_PRO_MODEL}>None (No Thinking)</option>
                        </select>
                    </div>
                }

                {config.provider === 'openai' &&
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label htmlFor={`openai-effort-${config.id}`} className="block text-sm font-medium text-gray-400 mb-1">Reasoning</label>
                             <select
                                id={`openai-effort-${config.id}`}
                                value={config.settings.effort}
                                onChange={(e) => handleOpenAISettingChange('effort', e.target.value)}
                                disabled={disabled}
                                className="w-full p-1.5 text-sm bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500"
                                title="Controls the model's reasoning process. 'High' enables more complex, step-by-step thinking, which can improve accuracy for difficult prompts. 'Medium' is faster and suitable for general tasks."
                            >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                            </select>
                        </div>
                        <div>
                             <label htmlFor={`openai-verbosity-${config.id}`} className="block text-sm font-medium text-gray-400 mb-1">Verbosity</label>
                             <select
                                id={`openai-verbosity-${config.id}`}
                                value={config.settings.verbosity}
                                onChange={(e) => handleOpenAISettingChange('verbosity', e.target.value)}
                                disabled={disabled}
                                className="w-full p-1.5 text-sm bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500"
                                title="Adjusts the length and detail of the agent's response. 'High' provides more comprehensive answers, while 'Low' is more concise."
                            >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                    </div>
                }
            </div>
        </div>
    );
};

export default AgentConfigCard;