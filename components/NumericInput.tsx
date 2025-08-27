import React from 'react';

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number;
    onCommit: (value: number) => void;
    parser?: (value: string) => number;
    onCancel?: () => void;
}

const NumericInput: React.FC<NumericInputProps> = ({ value, onCommit, parser = parseFloat, onCancel, ...rest }) => {
    const [inputValue, setInputValue] = React.useState<string>(String(value));

    React.useEffect(() => {
        setInputValue(String(value));
    }, [value]);

    const commit = () => {
        let parsed = parser(inputValue);
        if (!Number.isNaN(parsed)) {
            const min = rest.min !== undefined ? Number(rest.min) : undefined;
            const max = rest.max !== undefined ? Number(rest.max) : undefined;
            if (min !== undefined) parsed = Math.max(parsed, min);
            if (max !== undefined) parsed = Math.min(parsed, max);
            onCommit(parsed);
        } else {
            setInputValue(String(value));
            onCancel?.();
        }
    };

    return (
        <input
            {...rest}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                    (e.target as HTMLInputElement).blur();
                }
            }}
        />
    );
};

export default NumericInput;

