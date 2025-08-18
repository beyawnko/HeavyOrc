import React from 'react';
import { SparklesIcon, DownloadIcon } from './icons';

interface FinalAnswerCardProps extends React.HTMLAttributes<HTMLDivElement> {
  answer: string;
  prompt: string;
  title?: string;
}

const FinalAnswerCard: React.FC<FinalAnswerCardProps> = ({ answer, prompt, title = "Arbiter's Final Answer", className, ...rest }) => {
  
  const generateFilename = (promptStr: string): string => {
    const sanitized = promptStr
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // remove non-word chars except space and hyphen
        .trim()
        .replace(/\s+/g, '-') // replace spaces with hyphens
        .slice(0, 50); // truncate
    return `${sanitized || 'gemini-answer'}.md`;
  };

  const handleSave = () => {
    if (!answer) return;

    const fileContent = `# Prompt\n\n${prompt}\n\n---\n\n# Arbiter's Answer\n\n${answer}`;

    const blob = new Blob([fileContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generateFilename(prompt);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`bg-gray-800/50 p-6 rounded-xl shadow-2xl border border-indigo-500 min-h-[200px] ${className}`} {...rest}>
        <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
                <SparklesIcon className="w-6 h-6 text-indigo-400"/>
                <h2 className="text-2xl font-bold text-gray-200">{title}</h2>
            </div>
            <button
                onClick={handleSave}
                disabled={!answer}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-md text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Save answer to a Markdown file"
                aria-label="Save answer to a Markdown file"
            >
                <DownloadIcon className="w-4 h-4" />
                Save
            </button>
        </div>
        <div className="border-t border-gray-700 pt-4">
            <p className="text-gray-200 whitespace-pre-wrap font-serif leading-relaxed">
                {answer}
            </p>
        </div>
    </div>
  );
};

export default FinalAnswerCard;