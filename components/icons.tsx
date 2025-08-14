
import React from 'react';

export const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M10 2.5a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-1.5 0v-.5a.75.75 0 0 1 .75-.75Zm-3.25 3.5a.75.75 0 0 0-.5 1.3l.25.14a.75.75 0 0 0 1-1.3l-.25-.14a.75.75 0 0 0-.5-1.3Zm7 0a.75.75 0 0 0-.5 1.3l.25.14a.75.75 0 0 0 1-1.3l-.25-.14a.75.75 0 0 0-.5-1.3ZM10 8a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-1.5 0v-.5A.75.75 0 0 1 10 8Zm-4.12 3.12a.75.75 0 0 0-1.06 0l-.25.25a.75.75 0 0 0 0 1.06l.25.25a.75.75 0 0 0 1.06 0l.25-.25a.75.75 0 0 0 0-1.06l-.25-.25Zm8.24 0a.75.75 0 0 0-1.06 0l-.25.25a.75.75 0 0 0 0 1.06l.25.25a.75.75 0 0 0 1.06 0l.25-.25a.75.75 0 0 0 0-1.06l-.25-.25ZM10 13.5a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-1.5 0v-.5a.75.75 0 0 1 .75-.75ZM3.75 10a.75.75 0 0 0-1.5 0v.5a.75.75 0 0 0 1.5 0v-.5Zm12.5 0a.75.75 0 0 0-1.5 0v.5a.75.75 0 0 0 1.5 0v-.5Z" clipRule="evenodd" />
  </svg>
);

export const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className={className}>
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
    </svg>
);

export const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
    </svg>
);
