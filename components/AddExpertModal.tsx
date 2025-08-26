
import React, { useEffect } from 'react';
import { Expert } from '@/types';
import { XMarkIcon, SparklesIcon } from '@/components/icons';

interface AddExpertModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddExpert: (expert: Expert) => void;
    availableExperts: Expert[];
}

const AddExpertModal: React.FC<AddExpertModalProps> = ({ isOpen, onClose, onAddExpert, availableExperts }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleAdd = (expert: Expert) => {
        onAddExpert(expert);
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in-up p-4"
            style={{ animationDuration: '0.3s'}}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-expert-title"
        >
            <div
                className="bg-[var(--surface-2)] rounded-xl shadow-2xl border border-[var(--line)] w-full max-w-2xl h-full max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-[var(--line)] flex-shrink-0">
                    <h2 id="add-expert-title" className="text-lg font-bold text-[var(--text)]">
                        Add an Expert to the Ensemble
                    </h2>
                    <button onClick={onClose} type="button" className="p-1 rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-active)] hover:text-[var(--text)]" aria-label="Close modal">
                        <XMarkIcon className="w-6 h-6" aria-hidden="true" />
                    </button>
                </header>
                
                <main className="flex-grow p-4 sm:p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {availableExperts.map(expert => (
                            <button
                                key={expert.id}
                                onClick={() => handleAdd(expert)}
                                className="w-full h-full text-left p-4 bg-[var(--surface-2)] rounded-lg border border-[var(--line)] hover:bg-[var(--surface-active)] hover:border-[var(--accent)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] flex flex-col"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <SparklesIcon className="w-5 h-5 text-[var(--accent)] flex-shrink-0" aria-hidden="true" />
                                    <h3 className="font-bold text-[var(--text)]">{expert.name}</h3>
                                </div>
                                <p className="text-sm text-[var(--text-muted)] flex-grow">
                                    {expert.persona}
                                </p>
                            </button>
                        ))}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AddExpertModal;
