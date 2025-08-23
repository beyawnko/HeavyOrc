import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon } from './icons';

interface FinalAnswerCardProps extends React.HTMLAttributes<HTMLDivElement> {
  answer: string;
  title?: string;
  isStreaming?: boolean;
}

const FinalAnswerCard: React.FC<FinalAnswerCardProps> = ({ answer, title = "Arbiter's Final Answer", isStreaming = false, className, ...rest }) => {
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const animationIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // When streaming stops, immediately show the final answer and clear any running interval.
    if (!isStreaming) {
      if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
      setDisplayedAnswer(answer);
      return;
    }

    // If the answer resets (new run), reset the displayed answer.
    if (answer === '' && displayedAnswer !== '') {
        if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
        setDisplayedAnswer('');
        return;
    }

    // If an animation is already running, let it continue.
    // This prevents restarting the interval on every minor update to the `answer` prop.
    if (animationIntervalRef.current) {
        return;
    }
    
    // Start a new animation interval if we are streaming and not already animating.
    animationIntervalRef.current = window.setInterval(() => {
        setDisplayedAnswer(currentDisplayed => {
            if (currentDisplayed.length < answer.length) {
                // Append the next chunk of characters to simulate typing
                const nextChunk = answer.substring(currentDisplayed.length, currentDisplayed.length + 1);
                return currentDisplayed + nextChunk;
            } else {
                // We've caught up, stop the interval.
                if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
                animationIntervalRef.current = null;
                return currentDisplayed;
            }
        });
    }, 15); // Typing speed in milliseconds

  }, [answer, isStreaming]);

  const hasContent = displayedAnswer || isStreaming;
  const showCursor = isStreaming && (!animationIntervalRef.current || displayedAnswer.length === answer.length);

  return (
    <div className={`final-answer-glow rounded-xl shadow-2xl ${className}`} {...rest}>
      <div className="bg-gray-800/50 p-0 rounded-xl flex flex-col w-full min-h-[200px]">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-3">
                <SparklesIcon className="w-6 h-6 text-indigo-400"/>
                <h2 className="text-xl font-bold text-gray-200">{title}</h2>
            </div>
        </div>
        {/* Content */}
        <div className="p-4 flex-grow min-h-0 overflow-y-auto max-h-[70vh]">
            {hasContent ? (
                <p className="text-gray-200 whitespace-pre-wrap font-serif leading-relaxed">
                    {displayedAnswer}
                    {showCursor && <span className="inline-block w-2 h-5 bg-indigo-400 animate-pulse ml-1" />}
                </p>
            ) : (
                <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500 italic">Waiting for arbiter's response...</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default FinalAnswerCard;