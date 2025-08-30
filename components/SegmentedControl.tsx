
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
  const containerClasses = [
    'flex w-full p-1 bg-[var(--surface-1)] border border-[var(--line)] rounded-lg',
    'overflow-x-auto sm:overflow-x-visible',
    '[scrollbar-width:thin] [scrollbar-color:var(--line)_transparent]',
    '[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[var(--line)]',
    disabled ? 'opacity-70 cursor-not-allowed' : '',
  ].join(' ');

  const baseButtonClasses = [
    'relative px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none',
    'focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
    'focus-visible:ring-offset-[var(--surface-1)] z-10 whitespace-nowrap flex-none sm:flex-1 max-w-[8rem] sm:max-w-none truncate',
  ].join(' ');

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={containerClasses}
    >
      {options.map((option, index) => {
        const isSelected = value === option.value;
        const buttonClasses = [
          baseButtonClasses,
          index === 0 ? 'rounded-l-md' : '',
          index === options.length - 1 ? 'rounded-r-md' : '',
          isSelected ? 'text-[#0D1411]' : 'text-[var(--text)] hover:bg-[var(--surface-active)]',
          disabled ? 'cursor-not-allowed' : '',
        ].join(' ');

        return (
          <button
            key={option.value}
            onClick={() => !disabled && onChange(option.value)}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={disabled}
            aria-disabled={disabled}
            title={option.tooltip ?? option.label}
            className={buttonClasses}
          >
            {isSelected && (
              <span className="absolute inset-0 bg-[var(--accent)] rounded-md -z-10 motion-safe:transition-transform" />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
