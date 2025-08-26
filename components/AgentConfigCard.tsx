import React from 'react';
import { AgentConfig, AgentModel, GeminiAgentConfig, GeminiAgentSettings, OpenAIAgentConfig, OpenAIAgentSettings, AgentStatus, GeminiModel, OpenAIModel, GeminiThinkingEffort, GenerationStrategy, OpenRouterAgentConfig, OpenRouterAgentSettings, OpenRouterModel } from '@/types';
import { GEMINI_FLASH_MODEL, GEMINI_PRO_MODEL, OPENAI_AGENT_MODEL, OPENAI_GPT5_MINI_MODEL, OPENROUTER_CLAUDE_3_HAIKU, OPENROUTER_GEMINI_FLASH_1_5, OPENROUTER_GPT_4O } from '@/constants';
import { XCircleIcon, LoadingSpinner, CheckCircleIcon, DocumentDuplicateIcon } from '@/components/icons';
import { getExpertColor } from '@/lib/colors';

interface AgentConfigCardProps {
  config: AgentConfig;
  onUpdate: (id: string, newConfig: AgentConfig) => void;
  onRemove: (id:string) => void;
  onDuplicate: (id: string) => void;
  disabled: boolean;
  displayId: number;
}

const getStatusIndicator = (status: AgentStatus): React.ReactNode => {
    switch (status) {
        case 'RUNNING':
            return <LoadingSpinner className="h-5 w-5 text-[var(--accent-2)] animate-spin" />;
        case 'COMPLETED':
            return <CheckCircleIcon className="h-5 w-5 text-[var(--success)]" />;
        case 'FAILED':
            return <XCircleIcon className="h-5 w-5 text-[var(--danger)]" />;
        case 'PENDING':
        case 'QUEUED':
        default:
            return null;
    }
};

const getBorderColor = (status: AgentStatus): string => {
    switch(status) {
        case 'RUNNING':
            return 'border-[var(--accent-2)] ring-2 ring-[var(--accent-2)] ring-opacity-50';
        case 'COMPLETED':
            return 'border-[var(--success)]';
        case 'FAILED':
            return 'border-[var(--danger)]';
        case 'PENDING':
        case 'QUEUED':
        default:
            return 'border-[var(--line)]';
    }
}

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number;
    onCommit: (value: number) => void;
    parser?: (value: string) => number;
}

const NumericInput: React.FC<NumericInputProps> = ({ value, onCommit, parser = parseFloat, ...rest }) => {
    const [inputValue, setInputValue] = React.useState<string>(String(value));

    React.useEffect(() => {
        setInputValue(String(value));
    }, [value]);

    const commit = () => {
        const parsed = parser(inputValue);
        if (!Number.isNaN(parsed)) {
            onCommit(parsed);
        } else {
            setInputValue(String(value));
        }
    };

    return (
        <input
            {...rest}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={commit}
        />
    );
};

const AgentConfigCard: React.FC<AgentConfigCardProps> = ({ config, onUpdate, onRemove, onDuplicate, disabled, displayId }) => {
    
    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newModelValue = e.target.value as AgentModel;
        const isSwitchingToGemini = newModelValue.startsWith('gemini');
        const isSwitchingToOpenRouter = newModelValue.includes('/');

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
        } else if (isSwitchingToOpenRouter) {
            const newModel = newModelValue as OpenRouterModel;
            const newConfig: OpenRouterAgentConfig = {
                id: config.id, expert: config.expert, status: config.status, provider: 'openrouter', model: newModel,
                settings: {
                    temperature: 0.7,
                    topP: 1,
                    topK: 50,
                    frequencyPenalty: 0,
                    presencePenalty: 0,
                    repetitionPenalty: 1,
                }
            };
            onUpdate(config.id, newConfig);
        } else { // Switching to OpenAI
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

    const handleSettingChange = (update: Partial<GeminiAgentSettings | OpenAIAgentSettings | OpenRouterAgentSettings>) => {
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
    const expertColor = getExpertColor(displayId);

    return (
        <div className={`relative group bg-[var(--surface-2)] p-4 rounded-lg border transition-all duration-300 ${borderColor}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold" style={{ color: expertColor }}>{config.expert.name}</h4>
                    <p className="text-xs text-[var(--text-muted)] italic mt-1 pr-8">Persona: {config.expert.persona}</p>
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
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Duplicate Agent"
                >
                    <DocumentDuplicateIcon className="w-5 h-5" />
                    <span className="sr-only">Duplicate Agent</span>
                </button>
                <button 
                    onClick={() => onRemove(config.id)} 
                    disabled={disabled} 
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove Agent"
                >
                    <XCircleIcon className="w-5 h-5" />
                    <span className="sr-only">Remove Agent</span>
                </button>
            </div>


            <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor={`model-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Model</label>
                    <select
                        id={`model-${config.id}`}
                        value={config.model}
                        onChange={handleModelChange}
                        disabled={disabled}
                        className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"
                    >
                        <optgroup label="Google">
                            <option value={GEMINI_PRO_MODEL}>Gemini 2.5 Pro</option>
                            <option value={GEMINI_FLASH_MODEL}>Gemini 2.5 Flash</option>
                        </optgroup>
                        <optgroup label="OpenAI">
                             <option value={OPENAI_AGENT_MODEL}>OpenAI GPT-5</option>
                             <option value={OPENAI_GPT5_MINI_MODEL}>OpenAI GPT-5 Mini</option>
                        </optgroup>
                        <optgroup label="OpenRouter">
                            <option value={OPENROUTER_GPT_4O}>OpenAI GPT-4o</option>
                            <option value={OPENROUTER_GEMINI_FLASH_1_5}>Gemini Flash 1.5</option>
                            <option value={OPENROUTER_CLAUDE_3_HAIKU}>Claude 3 Haiku</option>
                        </optgroup>
                    </select>
                </div>

                <div>
                     <label htmlFor={`strategy-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Generation Strategy</label>
                    <select
                        id={`strategy-${config.id}`}
                        value={config.provider === 'openrouter' ? 'single' : (config as GeminiAgentConfig | OpenAIAgentConfig).settings.generationStrategy}
                        onChange={(e) => handleSettingChange({ generationStrategy: e.target.value as GenerationStrategy })}
                        disabled={disabled || config.provider === 'openrouter'}
                        className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-70"
                        title={config.provider === 'openrouter' ? "DeepConf is not currently supported for OpenRouter agents." : "Select the generation strategy."}
                    >
                        <option value="single">Single Draft</option>
                        <option value="deepconf-offline">DeepConf Offline</option>
                        <option value="deepconf-online">DeepConf Online</option>
                    </select>
                </div>
                
                {config.provider !== 'openrouter' && config.settings.generationStrategy !== 'single' &&
                    <>
                        <div>
                            <label htmlFor={`traces-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Trace Count</label>
                            <NumericInput
                                type="number"
                                id={`traces-${config.id}`}
                                value={config.settings.traceCount}
                                onCommit={(value) => handleSettingChange({ traceCount: value })}
                                parser={(v) => parseInt(v, 10)}
                                disabled={disabled}
                                min="2" max="32" step="1"
                                className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"
                                title="Number of parallel responses to generate for DeepConf."
                            />
                        </div>
                        <div>
                            <label htmlFor={`eta-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Confidence (Eta)</label>
                            <select
                                id={`eta-${config.id}`}
                                value={config.settings.deepConfEta}
                                onChange={(e) => handleSettingChange({ deepConfEta: parseInt(e.target.value, 10) as (10 | 90) })}
                                disabled={disabled}
                                className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"
                                title="Confidence threshold. 90% is conservative (keeps more), 10% is aggressive (keeps few high-confidence traces)."
                            >
                                <option value="90">90% (Conservative)</option>
                                <option value="10">10% (Aggressive)</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                             <label htmlFor={`confidence-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Confidence Source</label>
                            <select
                                id={`confidence-${config.id}`}
                                value={config.settings.confidenceSource}
                                disabled={true}
                                className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-70 disabled:cursor-not-allowed"
                                title="Only 'Judge' is available. The underlying models (Gemini and GPT-5) do not support streaming logprobs required for token-based confidence."
                            >
                                <option value="judge">Judge Verifier</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor={`tau-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Consensus (Tau)</label>
                            <NumericInput
                                type="number"
                                id={`tau-${config.id}`}
                                value={config.settings.tau}
                                onCommit={(value) => handleSettingChange({ tau: value })}
                                parser={(v) => parseFloat(v)}
                                disabled={disabled}
                                min="0.5" max="1.0" step="0.01"
                                className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"
                                title="Consensus threshold for online mode. Stops when the top answer's vote share exceeds this value (e.g., 0.95)."
                            />
                        </div>
                        <div>
                            <label htmlFor={`groupWindow-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Group Window</label>
                            <NumericInput
                                type="number"
                                id={`groupWindow-${config.id}`}
                                value={config.settings.groupWindow}
                                onCommit={(value) => handleSettingChange({ groupWindow: value })}
                                parser={(v) => parseInt(v, 10)}
                                disabled={disabled}
                                min="8" max="4096" step="8"
                                className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"
                                title="Sliding window size (in tokens) for calculating group confidence."
                            />
                        </div>
                    </>
                }


                {config.provider === 'gemini' ? (
                    <div className="col-span-2">
                        <label htmlFor={`gemini-effort-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Thinking Effort</label>
                        <select
                            id={`gemini-effort-${config.id}`}
                            value={config.settings.effort}
                            onChange={(e) => handleSettingChange({ effort: e.target.value as GeminiThinkingEffort })}
                            disabled={disabled}
                            className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"
                            title="Controls how much 'thinking' the Gemini model performs before answering. 'Dynamic' is recommended. 'High' can improve quality for complex tasks but increases latency. 'None' is fastest but least thorough."
                        >
                            <option value="dynamic">Dynamic</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                            <option value="none" disabled={config.model === GEMINI_PRO_MODEL}>None (No Thinking)</option>
                        </select>
                    </div>
                ) : config.provider === 'openai' ? (
                    <div className="col-span-2 grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor={`openai-effort-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Reasoning</label>
                             <select
                                id={`openai-effort-${config.id}`}
                                value={(config.settings as OpenAIAgentSettings).effort}
                                onChange={(e) => handleSettingChange({ effort: e.target.value as OpenAIAgentSettings['effort'] })}
                                disabled={disabled}
                                className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"
                                title="Controls the model's reasoning process. 'High' enables more complex, step-by-step thinking, which can improve accuracy for difficult prompts. 'Medium' is faster and suitable for general tasks."
                            >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                            </select>
                        </div>
                        <div>
                             <label htmlFor={`openai-verbosity-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Verbosity</label>
                             <select
                                id={`openai-verbosity-${config.id}`}
                                value={(config.settings as OpenAIAgentSettings).verbosity}
                                onChange={(e) => handleSettingChange({ verbosity: e.target.value as OpenAIAgentSettings['verbosity'] })}
                                disabled={disabled}
                                className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"
                                title="Adjusts the length and detail of the agent's response. 'High' provides more comprehensive answers, while 'Low' is more concise."
                            >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                    </div>
                ) : ( // OpenRouter Settings
                     <div className="col-span-2 grid grid-cols-2 gap-3">
                        <div>
                         <label htmlFor={`or-temp-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Temperature</label>
                             <NumericInput type="number" id={`or-temp-${config.id}`} value={(config.settings as OpenRouterAgentSettings).temperature} onCommit={(value) => handleSettingChange({ temperature: value })} parser={(v) => parseFloat(v)} disabled={disabled} min="0" max="2" step="0.1" className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"/>
                        </div>
                        <div>
                             <label htmlFor={`or-topk-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Top K</label>
                             <NumericInput type="number" id={`or-topk-${config.id}`} value={(config.settings as OpenRouterAgentSettings).topK} onCommit={(value) => handleSettingChange({ topK: value })} parser={(v) => parseInt(v, 10)} disabled={disabled} min="1" step="1" className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"/>
                        </div>
                         <div>
                             <label htmlFor={`or-topp-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Top P</label>
                             <NumericInput type="number" id={`or-topp-${config.id}`} value={(config.settings as OpenRouterAgentSettings).topP} onCommit={(value) => handleSettingChange({ topP: value })} parser={(v) => parseFloat(v)} disabled={disabled} min="0" max="1" step="0.05" className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"/>
                        </div>
                         <div>
                             <label htmlFor={`or-repp-${config.id}`} className="block text-sm font-medium text-[var(--text-muted)] mb-1">Repetition Penalty</label>
                             <NumericInput type="number" id={`or-repp-${config.id}`} value={(config.settings as OpenRouterAgentSettings).repetitionPenalty} onCommit={(value) => handleSettingChange({ repetitionPenalty: value })} parser={(v) => parseFloat(v)} disabled={disabled} min="0" max="2" step="0.1" className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"/>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgentConfigCard;
