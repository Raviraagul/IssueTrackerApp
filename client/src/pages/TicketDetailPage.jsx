import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTicket, updateTicket } from '../api';
import {
    ArrowLeft, Pencil, Save, X, AlertTriangle,
    Calendar, Building2, Package, Users, Tag,
    MessageSquare, CheckCircle2, Clock
} from 'lucide-react';
import DateInput from '../components/DateInput';

// ── Status pipeline config ────────────────────────────────────────────────────
const getPipeline = (statusKey) => [
    { key: 'yet_to_start', label: 'Yet to Start', color: 'blue' },
    { key: 'in_progress', label: 'In Progress', color: 'yellow' },
    { key: 'completed_dev', label: 'Completed (Dev)', color: 'purple' },
    { key: 'pre_prod', label: 'Pre Production', color: 'cyan' },
    statusKey === 'closed'
        ? { key: 'closed', label: 'Closed', color: 'gray' }
        : { key: 'fixed', label: 'Fixed', color: 'green' },
];

const STATUS_MAP = {
    'Yet to Start (Dev)': 'yet_to_start',
    'In-Progress (Dev)': 'in_progress',
    'Completed (Dev)': 'completed_dev',
    'Pre Production': 'pre_prod',
    'Fixed': 'fixed',
    'Closed': 'closed',
};

const PIPELINE_COLORS = {
    blue: { active: 'bg-blue-600 text-white', dot: 'bg-blue-600', line: 'bg-blue-600' },
    yellow: { active: 'bg-yellow-500 text-white', dot: 'bg-yellow-500', line: 'bg-yellow-500' },
    purple: { active: 'bg-purple-600 text-white', dot: 'bg-purple-600', line: 'bg-purple-600' },
    cyan: { active: 'bg-cyan-500 text-white', dot: 'bg-cyan-500', line: 'bg-cyan-500' },
    green: { active: 'bg-green-600 text-white', dot: 'bg-green-600', line: 'bg-green-600' },
    gray: { active: 'bg-gray-500 text-white', dot: 'bg-gray-500', line: 'bg-gray-500' },
};

const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d + '').toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
};

const priorityColor = (p) => {
    if (!p) return 'bg-gray-100 text-gray-600';
    const l = p.toLowerCase();
    if (l === 'high') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (l === 'medium') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
};

// ── Field row component ───────────────────────────────────────────────────────
function Field({ icon: Icon, label, value, highlight }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs font-medium
                      text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {Icon && <Icon size={12} />}
                {label}
            </div>
            <div className={`text-sm font-medium ${highlight
                ? highlight
                : 'text-gray-800 dark:text-gray-100'
                }`}>
                {value || '—'}
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TicketDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAdmin } = useAuth();

    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        assigned_to: '', fixed_date: '', comments: ''
    });

    useEffect(() => {
        setLoading(true);
        getTicket(id)
            .then(r => {
                setTicket(r.data);
                setForm({
                    assigned_to: r.data.assigned_to || '',
                    fixed_date: r.data.fixed_date
                        ? new Date(r.data.fixed_date).toLocaleDateString('en-CA')
                        : '',
                    comments: r.data.comments || '',
                });
            })
            .catch(() => setError('Ticket not found.'))
            .finally(() => setLoading(false));
    }, [id]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await updateTicket(id, form);
            setTicket(res.data);
            setEditing(false);
        } catch {
            setError('Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setForm({
            assigned_to: ticket.assigned_to || '',
            fixed_date: ticket.fixed_date
                ? new Date(ticket.fixed_date).toLocaleDateString('en-CA')
                : '',
            comments: ticket.comments || '',
        });
        setEditing(false);
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent
                      rounded-full animate-spin" />
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <p className="text-red-500">{error}</p>
            <button onClick={() => navigate('/tickets')}
                className="text-blue-600 hover:underline text-sm">
                ← Back to Tickets
            </button>
        </div>
    );

    const currentKey = STATUS_MAP[ticket.status_norm] || 'yet_to_start';
    const PIPELINE = getPipeline(currentKey);
    const currentIndex = PIPELINE.findIndex(s => s.key === currentKey);

    const inputCls = `w-full px-3 py-2 rounded-lg border text-sm
    bg-white dark:bg-gray-700
    border-gray-300 dark:border-gray-600
    text-gray-900 dark:text-white
    focus:outline-none focus:ring-2 focus:ring-blue-500`;

    return (
        <div className="max-w-5xl mx-auto space-y-5">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/tickets')}
                    className="flex items-center gap-2 text-sm text-gray-500
                     dark:text-gray-400 hover:text-gray-700
                     dark:hover:text-gray-200 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to Tickets
                </button>

                {isAdmin && !editing && (
                    <button
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg
                       bg-blue-600 hover:bg-blue-700 text-white text-sm
                       font-medium transition-colors"
                    >
                        <Pencil size={14} />
                        Edit
                    </button>
                )}

                {editing && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCancel}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg
                         border border-gray-300 dark:border-gray-600
                         text-gray-600 dark:text-gray-300 text-sm
                         hover:bg-gray-50 dark:hover:bg-gray-700
                         transition-colors"
                        >
                            <X size={14} />
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg
                         bg-green-600 hover:bg-green-700 text-white text-sm
                         font-medium transition-colors disabled:opacity-60"
                        >
                            <Save size={14} />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Title card ── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                      border border-gray-100 dark:border-gray-700 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs font-bold text-gray-400
                               dark:text-gray-500 tracking-widest uppercase">
                                {ticket.ticket_no}
                            </span>
                            {ticket.is_missing && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full
                                 text-xs font-medium bg-amber-100 text-amber-700
                                 dark:bg-amber-900/30 dark:text-amber-400">
                                    <AlertTriangle size={11} />
                                    Missing from last import
                                </span>
                            )}
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white
                           leading-snug">
                            {ticket.issue_description}
                        </h1>
                    </div>
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold
                            shrink-0 ${priorityColor(ticket.priority)}`}>
                        {ticket.priority}
                    </span>
                </div>
            </div>

            {/* ── Status Pipeline ── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                            border border-gray-100 dark:border-gray-700 px-6 py-5">
                <p className="text-xs font-semibold text-gray-400 uppercase
                            tracking-wider mb-4">Status Pipeline</p>


                <div className="flex items-center mb-4">
                    {PIPELINE.map((step, idx) => {
                        const isPast = idx < currentIndex;
                        const isCurrent = idx === currentIndex;
                        const colors = PIPELINE_COLORS[step.color];
                        return (
                            <div key={step.key} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center gap-1.5">
                                    <div className={`w-8 h-8 rounded-full flex items-center
                                        justify-center text-xs font-bold transition-all
                                            ${isCurrent
                                            ? colors.active + ' ring-4 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-opacity-30 ' + colors.dot.replace('bg-', 'ring-')
                                            : isPast
                                                ? 'bg-gray-200 dark:bg-gray-600 text-gray-500'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                                        }`}>
                                        {isPast
                                            ? <CheckCircle2 size={16} />
                                            : isCurrent
                                                ? <Clock size={14} />
                                                : idx + 1
                                        }
                                    </div>
                                    <span className={`text-xs font-medium text-center
                                            max-w-[70px] leading-tight
                                            ${isCurrent
                                            ? 'text-gray-900 dark:text-white font-bold'
                                            : isPast
                                                ? 'text-gray-400'
                                                : 'text-gray-400 dark:text-gray-500'
                                        }`}>
                                        {step.label}
                                    </span>
                                </div>
                                {idx < PIPELINE.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-1 mb-5 transition-all
                                            ${isPast || isCurrent
                                            ? colors.line
                                            : 'bg-gray-200 dark:bg-gray-700'
                                        }`} />
                                )}
                            </div>
                        );
                    })}
                </div>

            </div>

            {/* ── Details grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Left — main info */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Ticket info */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                          border border-gray-100 dark:border-gray-700 px-6 py-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase
                          tracking-wider mb-4">Ticket Information</p>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                            <Field icon={Calendar} label="Date Raised"
                                value={formatDate(ticket.date)} />
                            <Field icon={Building2} label="Company"
                                value={ticket.company} />
                            <Field icon={Package} label="Product"
                                value={ticket.product_name} />
                            <Field icon={Tag} label="Platform"
                                value={ticket.platform} />
                            <Field label="Team" value={ticket.team} />
                            <Field label="Module" value={ticket.module} />
                            <Field label="Sub Module" value={ticket.sub_module} />
                            <Field label="Fixed Status" value={ticket.fixed_status} />
                        </div>
                    </div>

                    {/* Comments */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                          border border-gray-100 dark:border-gray-700 px-6 py-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase
                          tracking-wider mb-4 flex items-center gap-2">
                            <MessageSquare size={13} />
                            Comments
                        </p>
                        {editing
                            ? <textarea
                                rows={4}
                                value={form.comments}
                                onChange={e => setForm({ ...form, comments: e.target.value })}
                                className={inputCls}
                                placeholder="Add comments..."
                            />
                            : <p className="text-sm text-gray-700 dark:text-gray-300
                              whitespace-pre-wrap leading-relaxed">
                                {ticket.comments || (
                                    <span className="text-gray-400 italic">No comments</span>
                                )}
                            </p>
                        }
                    </div>
                </div>

                {/* Right — side info */}
                <div className="space-y-5">

                    {/* Assignment */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                          border border-gray-100 dark:border-gray-700 px-6 py-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase
                          tracking-wider mb-4">Assignment</p>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-medium text-gray-400 uppercase
                               tracking-wider mb-1.5 flex items-center gap-1">
                                    <Users size={11} /> Assigned To
                                </p>
                                {editing
                                    ? <input
                                        type="text"
                                        value={form.assigned_to}
                                        onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                                        className={inputCls}
                                        placeholder="Enter name..."
                                    />
                                    : <p className="text-sm font-medium text-gray-800
                                  dark:text-gray-100">
                                        {ticket.assigned_to || '—'}
                                    </p>
                                }
                            </div>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                          border border-gray-100 dark:border-gray-700 px-6 py-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase
                          tracking-wider mb-4">Dates</p>
                        <div className="space-y-4">
                            <Field icon={Calendar} label="Fixed Date"
                                value={editing
                                    ? null
                                    : formatDate(ticket.fixed_date)
                                }
                            />
                            {editing && (
                                <DateInput
                                    value={form.fixed_date}
                                    onChange={v => setForm({ ...form, fixed_date: v })}
                                    placeholder="Select fixed date"
                                />
                            )}
                            <Field icon={Calendar} label="Last Updated"
                                value={formatDate(ticket.last_updated)} />
                            <Field icon={Calendar} label="Last Seen"
                                value={formatDate(ticket.last_seen_date)} />
                        </div>
                    </div>

                    {/* Status */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                          border border-gray-100 dark:border-gray-700 px-6 py-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase
                          tracking-wider mb-4">Status</p>
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Current Status</p>
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold
                                    ${currentKey === 'fixed'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : currentKey === 'closed'
                                            ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                            : currentKey === 'pre_prod'
                                                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                    {ticket.status_norm}
                                </span>
                            </div>
                            {ticket.status_changed_date && (
                                <Field label="Status Changed"
                                    value={formatDate(ticket.status_changed_date)} />
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}