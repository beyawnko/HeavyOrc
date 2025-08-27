import React from 'react';

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number;
    onCommit: (value: number) => void;
    parser?: (value: string) => number;
}

const NumericInput: React.FC<NumericInputProps> = ({ value, onCommit, parser = parseFloat, ...rest }) => {
    const [inputValue, setInputValue] = React.useState<string>(String(value));

    React.useEffect(() => {
        setInputValue(String(value));
    }, [value]);

    const commit = () => {
        const parsed = parser(inputValue);
        if (!Number.isNaN(parsed)) {
            onCommit(parsed);
        } else {
            setInputValue(String(value));
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

