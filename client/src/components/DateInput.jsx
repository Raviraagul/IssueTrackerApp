import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DateInput({ label, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(() => value ? new Date(value).getFullYear() : new Date().getFullYear());
    const [viewMonth, setViewMonth] = useState(() => value ? new Date(value).getMonth() : new Date().getMonth());
    const ref = useRef();

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = value ? new Date(value + 'T00:00:00') : null;

    const displayValue = selected
        ? selected.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Select date';

    const getDays = () => {
        const first = new Date(viewYear, viewMonth, 1).getDay();
        const total = new Date(viewYear, viewMonth + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < first; i++) cells.push(null);
        for (let d = 1; d <= total; d++) cells.push(d);
        return cells;
    };

    const select = (day) => {
        if (!day) return;
        const mm = String(viewMonth + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        onChange(`${viewYear}-${mm}-${dd}`);
        setOpen(false);
    };

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const isSelected = (day) => {
        if (!selected || !day) return false;
        return selected.getFullYear() === viewYear &&
            selected.getMonth() === viewMonth &&
            selected.getDate() === day;
    };

    const isToday = (day) => {
        const t = new Date();
        return t.getFullYear() === viewYear &&
            t.getMonth() === viewMonth &&
            t.getDate() === day;
    };

    return (
        <div ref={ref} className="relative">
            {label && (
                <label className="block text-xs font-medium text-gray-500
                           dark:text-gray-400 mb-1.5">
                    {label}
                </label>
            )}

            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border
                    text-sm w-full transition-colors bg-white dark:bg-gray-700
                    text-gray-900 dark:text-white
                    ${open
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                    }`}
            >
                <Calendar size={14} className="text-gray-400 shrink-0" />
                <span className={value ? '' : 'text-gray-400'}>{displayValue}</span>
            </button>

            {/* Calendar popup */}
            {open && (
                <div className="absolute z-50 mt-1 bg-white dark:bg-gray-800 rounded-xl
                        shadow-xl border border-gray-200 dark:border-gray-700
                        p-3 w-64">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <button onClick={prevMonth}
                            className="p-1 rounded-lg hover:bg-gray-100
                               dark:hover:bg-gray-700 text-gray-500">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {MONTHS[viewMonth]} {viewYear}
                        </span>
                        <button onClick={nextMonth}
                            className="p-1 rounded-lg hover:bg-gray-100
                               dark:hover:bg-gray-700 text-gray-500">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 mb-1">
                        {DAYS.map(d => (
                            <div key={d} className="text-center text-xs font-medium
                                      text-gray-400 py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-y-0.5">
                        {getDays().map((day, i) => (
                            <button
                                key={i}
                                onClick={() => select(day)}
                                disabled={!day}
                                className={`h-8 w-8 mx-auto rounded-lg text-xs font-medium
                            transition-colors flex items-center justify-center
                            ${!day ? '' :
                                        isSelected(day)
                                            ? 'bg-blue-600 text-white'
                                            : isToday(day)
                                                ? 'border border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                            >
                                {day || ''}
                            </button>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between mt-3 pt-2
                          border-t border-gray-100 dark:border-gray-700">
                        <button
                            onClick={() => { onChange(''); setOpen(false); }}
                            className="text-xs text-gray-400 hover:text-gray-600
                         dark:hover:text-gray-200 transition-colors"
                        >
                            Clear
                        </button>
                        <button
                            onClick={() => {
                                const t = new Date();
                                setViewYear(t.getFullYear());
                                setViewMonth(t.getMonth());
                                select(t.getDate());
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400
                         font-medium hover:text-blue-700 transition-colors"
                        >
                            Today
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}