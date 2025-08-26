import React, { useState, useId } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from './icons';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  isDisabled?: boolean;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, isDisabled = false, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  const toggleOpen = () => {
    if (!isDisabled) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={`border border-[var(--line)] rounded-lg transition-opacity ${isDisabled ? 'opacity-50' : ''}`}>
      <button
        type="button"
        onClick={toggleOpen}
        disabled={isDisabled}
        className="w-full flex justify-between items-center p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-1)] rounded-t-lg"
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <h4 className="text-base font-medium text-[var(--text)]">{title}</h4>
        {isOpen ? (
          <ChevronUpIcon className="w-5 h-5 text-[var(--text-muted)]" aria-hidden="true" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-[var(--text-muted)]" aria-hidden="true" />
        )}
      </button>
      <div id={contentId} className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px]' : 'max-h-0'}`}>
        <div className="p-4 border-t border-[var(--line)]">
            {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
