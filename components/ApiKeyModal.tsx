
import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (apiKey: string) => void;
    currentApiKey: string;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentApiKey }) => {
    const [apiKey, setApiKey] = useState(currentApiKey);

    useEffect(() => {
        setApiKey(currentApiKey);
    }, [currentApiKey, isOpen]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);


    if (!isOpen) return null;

    const handleSave = () => {
        onSave(apiKey);
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in-up"
            style={{ animationDuration: '0.3s'}}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="apiKeyModalTitle"
        >
            <div 
                className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md p-6 m-4"
                onClick={e => e.stopPropagation()}
            >
                <h2 id="apiKeyModalTitle" className="text-xl font-bold text-gray-200 mb-4">OpenAI API Key</h2>
                <p className="text-gray-400 text-sm mb-4">
                    To use OpenAI models like GPT-4o, please provide your API key. Your key is stored securely in your browser's local storage and is never sent to our servers.
                </p>
                <div>
                    <label htmlFor="openai-api-key" className="block text-sm font-medium text-gray-300 mb-2">
                        API Key
                    </label>
                    <input
                        id="openai-api-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    />
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        type="button"
                        className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        type="button"
                        className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-500 disabled:bg-gray-600 transition-colors"
                    >
                        Save Key
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
