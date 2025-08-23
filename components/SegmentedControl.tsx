
import React from 'react';

// Using a generic type T that extends string for the value
export interface SegmentedControlOption<T extends string> {
  label: string;
  value: T;
  tooltip?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  'aria-label': string; // Enforce accessibility
}

const SegmentedControl = <T extends string>({ options, value, onChange, disabled = false, 'aria-label': ariaLabel }: SegmentedControlProps<T>) => {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex w-full p-1 bg-gray-900 border border-gray-600 rounded-lg ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          onClick={() => !disabled && onChange(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          title={option.tooltip}
          className={`relative flex-1 px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 z-10
            ${index === 0 ? 'rounded-l-md' : ''}
            ${index === options.length - 1 ? 'rounded-r-md' : ''}
            ${value === option.value ? 'text-white' : 'text-gray-300 hover:bg-gray-700/50'}
            ${disabled ? 'cursor-not-allowed' : ''}
          `}
        >
          {value === option.value && (
             <span className="absolute inset-0 bg-indigo-600 rounded-md -z-10 motion-safe:transition-transform" />
          )}
          <span className="relative">{option.label}</span>
        </button>
      ))}
    </div>
  );
};

export default SegmentedControl;
