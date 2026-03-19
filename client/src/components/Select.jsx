import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function Select({ value, onChange, options, placeholder = 'Select...' }) {
    const [open, setOpen] = useState(false);
    const ref = useRef();

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = options.find(o =>
        (typeof o === 'string' ? o : o.value) === value
    );
    const label = selected
        ? (typeof selected === 'string' ? selected : selected.label)
        : placeholder;

    return (
        <div ref={ref} className="relative w-full">
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between gap-2
                    px-3 py-2 rounded-lg border text-sm transition-colors
                    bg-white dark:bg-gray-700
                    text-gray-900 dark:text-white
                    ${open
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
            >
                <span className={value ? '' : 'text-gray-400'}>
                    {label}
                </span>
                <ChevronDown
                    size={15}
                    className={`text-gray-400 transition-transform shrink-0
                      ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800
                        border border-gray-200 dark:border-gray-700
                        rounded-xl shadow-lg overflow-hidden">
                    {/* Placeholder option */}
                    {placeholder && (
                        <button
                            type="button"
                            onClick={() => { onChange(''); setOpen(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2.5
                          text-sm text-left transition-colors
                          ${!value
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                    : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            {placeholder}
                            {!value && <Check size={14} />}
                        </button>
                    )}

                    {/* Options */}
                    {options.map((opt) => {
                        const val = typeof opt === 'string' ? opt : opt.value;
                        const lbl = typeof opt === 'string' ? opt : opt.label;
                        const isSelected = value === val;
                        return (
                            <button
                                key={val}
                                type="button"
                                onClick={() => { onChange(val); setOpen(false); }}
                                className={`w-full flex items-center justify-between px-3 py-2.5
                            text-sm text-left transition-colors
                            ${isSelected
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                            >
                                {lbl}
                                {isSelected && <Check size={14} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}