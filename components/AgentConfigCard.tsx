import React from 'react';
import { AgentConfig, AgentModel, GeminiAgentConfig, GeminiAgentSettings, OpenAIAgentConfig, OpenAIAgentSettings, AgentStatus, GeminiModel, OpenAIModel, GeminiThinkingEffort, GenerationStrategy } from '../types';
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
        const isSwitchingToGemini = newModelValue.startsWith('gemini');

        if (isSwitchingToGemini) {
            const newModel = newModelValue as GeminiModel;
            const newConfig: GeminiAgentConfig = {
                id: config.id, expert: config.expert, status: config.status, provider: 'gemini', model: newModel,
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
            onUpdate(config.id, newConfig);
        } 
        else { // Switching to OpenAI
            const newModel = newModelValue as OpenAIModel;
            const newConfig: OpenAIAgentConfig = {
                 id: config.id, expert: config.expert, status: config.status, provider: 'openai', model: newModel,
                settings: {
                    effort: 'medium', verbosity: 'medium',
                    generationStrategy: 'single',
                    confidenceSource: 'judge',
                    traceCount: 8,
                    deepConfEta: 90,
                    tau: 0.95,
                    groupWindow: 2048,
                },
            };
            onUpdate(config.id, newConfig);
        }
    };

    const handleSettingChange = (update: Partial<GeminiAgentSettings | OpenAIAgentSettings>) => {
        const newConfig = {
            ...config,
            settings: {
                ...config.settings,
                ...update,
            },
        };
        onUpdate(config.id, newConfig as AgentConfig);
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


            <div className="mt-4 grid grid-cols-2 gap-3">
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

                <div>
                     <label htmlFor={`strategy-${config.id}`} className="block text-sm font-medium text-gray-400 mb-1">Generation Strategy</label>
                    <select
                        id={`strategy-${config.id}`}
                        value={config.settings.generationStrategy}
                        onChange={(e) => handleSettingChange({ generationStrategy: e.target.value as GenerationStrategy })}
                        disabled={disabled}
                        className="w-full p-1.5 text-sm bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
                        title="Select the generation strategy. For Gemini and OpenAI, this uses an LLM verifier as token-level confidence is not available."
                    >
                        <option value="single">Single Draft</option>
                        <option value="deepconf-offline">DeepConf Offline</option>
                        <option value="deepconf-online">DeepConf Online</option>
                    </select>
                </div>
                
                {config.settings.generationStrategy !== 'single' &&
                    <>
                        <div>
                            <label htmlFor={`traces-${config.id}`} className="block text-sm font-medium text-gray-400 mb-1">Trace Count</label>
                            <input
                                type="number"
                                id={`traces-${config.id}`}
                                value={config.settings.traceCount}
                                onChange={(e) => handleSettingChange({ traceCount: parseInt(e.target.value, 10) })}
                                disabled={disabled}
                                min="2" max="32" step="1"
                                className="w-full p-1.5 text-sm bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500"
                                title="Number of parallel responses to generate for DeepConf."
                            />
                        </div>
                        <div>
                            <label htmlFor={`eta-${config.id}`} className="block text-sm font-medium text-gray-400 mb-1">Confidence (Eta)</label>
                            <select
                                id={`eta-${config.id}`}
                                value={config.settings.deepConfEta}
                                onChange={(e) => handleSettingChange({ deepConfEta: parseInt(e.target.value, 10) as (10 | 90) })}
                                disabled={disabled}
                                className="w-full p-1.5 text-sm bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500"
                                title="Confidence threshold. 90% is conservative (keeps more), 10% is aggressive (keeps few high-confidence traces)."
                            >
                                <option value="90">90% (Conservative)</option>
                                <option value="10">10% (Aggressive)</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                             <label htmlFor={`confidence-${config.id}`} className="block text-sm font-medium text-gray-400 mb-1">Confidence Source</label>
                            <select
                                id={`confidence-${config.id}`}
                                value={config.settings.confidenceSource}
                                disabled={true}
                                className="w-full p-1.5 text-sm bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed"
                                title="Only 'Judge' is available. The underlying models (Gemini and GPT-5) do not support streaming logprobs required for token-based confidence."
                            >
                                <option value="judge">Judge Verifier</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor={`tau-${config.id}`} className="block text-sm font-medium text-gray-400 mb-1">Consensus (Tau)</label>
                            <input
                                type="number"
                                id={`tau-${config.id}`}
                                value={config.settings.tau}
                                onChange={(e) => handleSettingChange({ tau: parseFloat(e.target.value) })}
                                disabled={disabled}
                                min="0.5" max="1.0" step="0.01"
                                className="w-full p-1.5 text-sm bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500"
                                title="Consensus threshold for online mode. Stops when the top answer's vote share exceeds this value (e.g., 0.95)."
                            />
                        </div>
                        <div>
                            <label htmlFor={`groupWindow-${config.id}`} className="block text-sm font-medium text-gray-400 mb-1">Group Window</label>
                            <input
                                type="number"
                                id={`groupWindow-${config.id}`}
                                value={config.settings.groupWindow}
                                onChange={(e) => handleSettingChange({ groupWindow: parseInt(e.target.value, 10) })}
                                disabled={disabled}
                                min="8" max="4096" step="8"
                                className="w-full p-1.5 text-sm bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500"
                                title="Sliding window size (in tokens) for calculating group confidence."
                            />
                        </div>
                    </>
                }


                {config.provider === 'gemini' ? (
                    <div className="col-span-2">
                        <label htmlFor={`gemini-effort-${config.id}`} className="block text-sm font-medium text-gray-400 mb-1">Thinking Effort</label>
                        <select
                            id={`gemini-effort-${config.id}`}
                            value={config.settings.effort}
                            onChange={(e) => handleSettingChange({ effort: e.target.value as GeminiThinkingEffort })}
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
                ) : (
                    <div className="col-span-2 grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor={`openai-effort-${config.id}`} className="block text-sm font-medium text-gray-400 mb-1">Reasoning</label>
                             <select
                                id={`openai-effort-${config.id}`}
                                value={(config.settings as OpenAIAgentSettings).effort}
                                onChange={(e) => handleSettingChange({ effort: e.target.value as OpenAIAgentSettings['effort'] })}
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
                                value={(config.settings as OpenAIAgentSettings).verbosity}
                                onChange={(e) => handleSettingChange({ verbosity: e.target.value as OpenAIAgentSettings['verbosity'] })}
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
                )}
            </div>
        </div>
    );
};

export default AgentConfigCard;