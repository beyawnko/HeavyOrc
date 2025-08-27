import React from 'react';

interface NumericInputProps {
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
    title?: string;
}

const NumericInput: React.FC<NumericInputProps> = ({ id, label, value, onChange, disabled, min, max, step, title }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-[var(--text-muted)] mb-1">{label}</label>
        <input
            type="number"
            id={id}
            value={value}
            onChange={e => onChange(e.target.valueAsNumber)}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            className="w-full p-1.5 text-sm bg-[var(--surface-1)] border border-[var(--line)] rounded-md focus:ring-2 focus:ring-[var(--accent)]"
            title={title}
        />
    </div>
);

export default NumericInput;
