import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTicket, updateTicket } from '../api';
import axios from 'axios';
import {
    ArrowLeft, Pencil, Save, X, AlertTriangle,
    Calendar, Building2, Package, Users, Tag,
    MessageSquare, CheckCircle2, Clock, History,
    ShieldAlert
} from 'lucide-react';
import DateInput from '../components/DateInput';
import Select from '../components/Select';

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

const STATUS_OPTIONS = [
    { value: 'Yet to Start (Dev)', label: 'Yet to Start (Dev)' },
    { value: 'In-Progress (Dev)', label: 'In-Progress (Dev)' },
    { value: 'Completed (Dev)', label: 'Completed (Dev)' },
    { value: 'Pre Production', label: 'Pre Production' },
    { value: 'Fixed', label: 'Fixed' },
    { value: 'Closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
    { value: 'High', label: 'High' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Low', label: 'Low' },
];

const TEAM_OPTIONS = [
    { value: 'API', label: 'API' },
    { value: 'Web', label: 'Web' },
    { value: 'App', label: 'App' },
];

const ROOT_CAUSE_CATEGORIES = [
    { value: 'Code Bug', label: 'Code Bug' },
    { value: 'Design Issue', label: 'Design Issue' },
    { value: 'Requirement Gap', label: 'Requirement Gap' },
    { value: 'Environment Issue', label: 'Environment Issue' },
    { value: 'Third Party / Integration', label: 'Third Party / Integration' },
    { value: 'Others', label: 'Others' },
];

const PIPELINE_COLORS = {
    blue: { active: 'bg-blue-600 text-white', dot: 'bg-blue-600', line: 'bg-blue-600' },
    yellow: { active: 'bg-yellow-500 text-white', dot: 'bg-yellow-500', line: 'bg-yellow-500' },
    purple: { active: 'bg-purple-600 text-white', dot: 'bg-purple-600', line: 'bg-purple-600' },
    cyan: { active: 'bg-cyan-500 text-white', dot: 'bg-cyan-500', line: 'bg-cyan-500' },
    green: { active: 'bg-green-600 text-white', dot: 'bg-green-600', line: 'bg-green-600' },
    gray: { active: 'bg-gray-500 text-white', dot: 'bg-gray-500', line: 'bg-gray-500' },
};

const STATUS_TIMELINE_COLORS = {
    'Yet to Start (Dev)': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'In-Progress (Dev)': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Completed (Dev)': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    'Pre Production': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    'Fixed': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    'Closed': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
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
            <div className={`text-sm font-medium ${highlight || 'text-gray-800 dark:text-gray-100'}`}>
                {value || '—'}
            </div>
        </div>
    );
}

// ── Status History Timeline ───────────────────────────────────────────────────
function StatusTimeline({ history }) {
    if (!history.length) return (
        <p className="text-sm text-gray-400 italic">No status history found.</p>
    );

    return (
        <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-3.5 top-4 bottom-4 w-0.5
                bg-gray-200 dark:bg-gray-700" />

            <div className="space-y-4">
                {history.map((h, idx) => (
                    <div key={h.id} className="flex gap-4 relative">
                        {/* Dot */}
                        <div className={`w-7 h-7 rounded-full flex items-center
                            justify-center shrink-0 z-10 border-2 border-white
                            dark:border-gray-800
                            ${idx === history.length - 1
                                ? 'bg-blue-600'
                                : 'bg-gray-300 dark:bg-gray-600'
                            }`}>
                            {idx === history.length - 1
                                ? <Clock size={12} className="text-white" />
                                : <CheckCircle2 size={12} className="text-white" />
                            }
                        </div>

                        {/* Content */}
                        <div className="flex-1 pb-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                {h.old_status ? (
                                    <>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                                            ${STATUS_TIMELINE_COLORS[h.old_status] || 'bg-gray-100 text-gray-600'}`}>
                                            {h.old_status}
                                        </span>
                                        <span className="text-gray-400 text-xs">→</span>
                                    </>
                                ) : (
                                    <span className="text-xs text-gray-400 italic">New ticket</span>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                                    ${STATUS_TIMELINE_COLORS[h.new_status] || 'bg-gray-100 text-gray-600'}`}>
                                    {h.new_status}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                    <Calendar size={11} />
                                    {formatDate(h.changed_date)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Users size={11} />
                                    {h.changed_by || '—'}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-xs
                                    ${h.method === 'manual'
                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                    }`}>
                                    {h.method === 'manual' ? '✏️ Manual' : '📥 Import'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TicketDetailPage() {

    const location = useLocation();
    console.log(`pathname = ${location.pathname}, search = ${location.search}`);

    const { id } = useParams();
    const navigate = useNavigate();
    const { canEditTicket } = useAuth();

    const [ticket, setTicket] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const [form, setForm] = useState({
        status_norm: '',
        assigned_to: '',
        fixed_date: '',
        comments: '',
        priority: '',
        team: '',
        root_cause: '',
        root_cause_category: '',
        fix_description: '',
    });

    const loadTicket = (data) => {
        setTicket(data);
        setForm({
            status_norm: data.status_norm || '',
            assigned_to: data.assigned_to || '',
            fixed_date: data.fixed_date
                ? new Date(data.fixed_date).toLocaleDateString('en-CA')
                : '',
            comments: data.comments || '',
            priority: data.priority || '',
            team: data.team || '',
            root_cause: data.root_cause || '',
            root_cause_category: data.root_cause_category || '',
            fix_description: data.fix_description || '',
        });
    };

    useEffect(() => {
        setLoading(true);
        Promise.all([
            getTicket(id),
            axios.get(`/api/tickets/${id}/history`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            }),
        ])
            .then(([ticketRes, historyRes]) => {
                loadTicket(ticketRes.data);
                setHistory(historyRes.data);
            })
            .catch(() => setError('Ticket not found.'))
            .finally(() => setLoading(false));
    }, [id]);

    const handleSave = async () => {
        if (form.status_norm === 'Fixed' && !form.fixed_date) {
            setSaveError('Fixed date is required when status is Fixed.');
            return;
        }
        setSaving(true);
        setSaveError('');
        try {
            const res = await updateTicket(id, form);
            loadTicket(res.data);
            // Reload history after save
            const histRes = await axios.get(`/api/tickets/${id}/history`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setHistory(histRes.data);
            setEditing(false);
        } catch (err) {
            setSaveError(err.response?.data?.error || 'Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        loadTicket(ticket);
        setEditing(false);
        setSaveError('');
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent
                      rounded-full animate-spin" />
        </div>
    );
    console.log(`Windows history: ${JSON.stringify(window.history.length)}`);

    if (error) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <p className="text-red-500">{error}</p>
            {/* <button onClick={() => navigate('/tickets')} */}
            <button onClick={() => navigate(-1)}
                className="text-blue-600 hover:underline text-sm">
                ← Back to Tickets
            </button>
        </div>
    );

    const currentKey = STATUS_MAP[ticket.status_norm] || 'yet_to_start';
    const PIPELINE = getPipeline(currentKey);
    const currentIndex = PIPELINE.findIndex(s => s.key === currentKey);
    const userCanEdit = canEditTicket(ticket.team);

    const inputCls = `w-full px-3 py-2 rounded-lg border text-sm
    bg-white dark:bg-gray-700
    border-gray-300 dark:border-gray-600
    text-gray-900 dark:text-white
    focus:outline-none focus:ring-2 focus:ring-blue-500`;

    const labelCls = `block text-xs font-medium text-gray-400 dark:text-gray-500
        uppercase tracking-wider mb-1.5`;

    return (
        <div className="max-w-5xl mx-auto space-y-5">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                {/* <button onClick={() => navigate('/tickets')} */}
                <button onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-sm text-gray-500
                     dark:text-gray-400 hover:text-gray-700
                     dark:hover:text-gray-200 transition-colors">
                    <ArrowLeft size={16} />
                    Back to Tickets
                </button>

                {userCanEdit && !editing && (
                    <button onClick={() => setEditing(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg
                       bg-blue-600 hover:bg-blue-700 text-white text-sm
                       font-medium transition-colors">
                        <Pencil size={14} />
                        Edit
                    </button>
                )}

                {editing && (
                    <div className="flex items-center gap-2">
                        <button onClick={handleCancel}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg
                         border border-gray-300 dark:border-gray-600
                         text-gray-600 dark:text-gray-300 text-sm
                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <X size={14} />
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg
                         bg-green-600 hover:bg-green-700 text-white text-sm
                         font-medium transition-colors disabled:opacity-60">
                            <Save size={14} />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}
            </div>

            {/* Save error */}
            {saveError && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border
                    border-red-200 dark:border-red-800 rounded-lg
                    text-red-600 dark:text-red-400 text-sm">
                    {saveError}
                </div>
            )}

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
                                <span className="flex items-center gap-1 px-2 py-0.5
                                 rounded-full text-xs font-medium bg-amber-100
                                 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
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
                    {/* Priority — editable */}
                    {editing ? (
                        <div className="w-36 shrink-0">
                            <Select
                                value={form.priority}
                                onChange={v => setForm({ ...form, priority: v })}
                                options={PRIORITY_OPTIONS}
                                placeholder="Priority"
                            />
                        </div>
                    ) : (
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold
                            shrink-0 ${priorityColor(ticket.priority)}`}>
                            {ticket.priority}
                        </span>
                    )}
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
                            ? <textarea rows={4} value={form.comments}
                                onChange={e => setForm({ ...form, comments: e.target.value })}
                                className={inputCls}
                                placeholder="Add comments..." />
                            : <p className="text-sm text-gray-700 dark:text-gray-300
                              whitespace-pre-wrap leading-relaxed">
                                {ticket.comments || (
                                    <span className="text-gray-400 italic">No comments</span>
                                )}
                            </p>
                        }
                    </div>

                    {/* ── Root Cause Section ── */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                          border border-gray-100 dark:border-gray-700 px-6 py-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase
                          tracking-wider mb-4 flex items-center gap-2">
                            <ShieldAlert size={13} />
                            Root Cause Analysis
                        </p>

                        {editing ? (
                            <div className="space-y-4">
                                <div>
                                    <label className={labelCls}>Root Cause Category</label>
                                    <Select
                                        value={form.root_cause_category}
                                        onChange={v => setForm({ ...form, root_cause_category: v })}
                                        options={ROOT_CAUSE_CATEGORIES}
                                        placeholder="Select category..."
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Root Cause Description</label>
                                    <textarea rows={3} value={form.root_cause}
                                        onChange={e => setForm({ ...form, root_cause: e.target.value })}
                                        className={inputCls}
                                        placeholder="Describe the root cause..." />
                                </div>
                                <div>
                                    <label className={labelCls}>Fix Description</label>
                                    <textarea rows={3} value={form.fix_description}
                                        onChange={e => setForm({ ...form, fix_description: e.target.value })}
                                        className={inputCls}
                                        placeholder="Describe how it was fixed..." />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {ticket.root_cause_category && (
                                    <div>
                                        <p className={labelCls}>Category</p>
                                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold
                                            bg-orange-100 text-orange-700
                                            dark:bg-orange-900/30 dark:text-orange-400">
                                            {ticket.root_cause_category}
                                        </span>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <p className={labelCls}>Root Cause</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300
                                            whitespace-pre-wrap leading-relaxed">
                                            {ticket.root_cause || (
                                                <span className="text-gray-400 italic">Not filled yet</span>
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className={labelCls}>Fix Description</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300
                                            whitespace-pre-wrap leading-relaxed">
                                            {ticket.fix_description || (
                                                <span className="text-gray-400 italic">Not filled yet</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Status History Timeline ── */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                          border border-gray-100 dark:border-gray-700 px-6 py-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase
                          tracking-wider mb-5 flex items-center gap-2">
                            <History size={13} />
                            Status History
                        </p>
                        <StatusTimeline history={history} />
                    </div>
                </div>

                {/* Right — side info */}
                <div className="space-y-5">

                    {/* Status */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                          border border-gray-100 dark:border-gray-700 px-6 py-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase
                          tracking-wider mb-4">Status</p>
                        <div className="space-y-3">
                            {editing ? (
                                <div>
                                    <label className={labelCls}>Current Status</label>
                                    <Select
                                        value={form.status_norm}
                                        onChange={v => setForm({ ...form, status_norm: v })}
                                        options={STATUS_OPTIONS}
                                        placeholder="Select status..."
                                    />
                                </div>
                            ) : (
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
                            )}
                            {ticket.status_changed_date && (
                                <Field label="Status Changed"
                                    value={formatDate(ticket.status_changed_date)} />
                            )}
                        </div>
                    </div>

                    {/* Assignment */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                          border border-gray-100 dark:border-gray-700 px-6 py-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase
                          tracking-wider mb-4">Assignment</p>
                        <div className="space-y-4">
                            {/* Assigned To */}
                            <div>
                                <p className={`${labelCls} flex items-center gap-1`}>
                                    <Users size={11} /> Assigned To
                                </p>
                                {editing
                                    ? <input type="text" value={form.assigned_to}
                                        onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                                        className={inputCls}
                                        placeholder="Enter name..." />
                                    : <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                        {ticket.assigned_to || '—'}
                                    </p>
                                }
                            </div>

                            {/* Team */}
                            <div>
                                <p className={labelCls}>Team</p>
                                {editing ? (
                                    <>
                                        <Select
                                            value={form.team}
                                            onChange={v => setForm({ ...form, team: v })}
                                            options={TEAM_OPTIONS}
                                            placeholder="Select team"
                                        />
                                        <p className="text-xs text-amber-500 mt-1.5 flex items-center gap-1">
                                            <AlertTriangle size={11} />
                                            This will be overwritten on next import
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                        {ticket.team || '—'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                        border border-gray-100 dark:border-gray-700 px-6 py-5">
                        <p className="text-xs font-semibold text-gray-400 uppercase
                        tracking-wider mb-4">Dates</p>
                        <div className="space-y-4">
                            {/* Fixed Date — only shown when status is Fixed */}
                            {(form.status_norm === 'Fixed' || ticket.status_norm === 'Fixed') && (
                                <div>
                                    <label className={labelCls}>
                                        Fixed Date
                                        {form.status_norm === 'Fixed' && (
                                            <span className="text-red-500 ml-1">*</span>
                                        )}
                                    </label>
                                    {editing ? (
                                        <>
                                            <DateInput
                                                value={form.fixed_date}
                                                onChange={v => setForm({ ...form, fixed_date: v })}
                                                placeholder="Select fixed date"
                                            />
                                            {form.status_norm === 'Fixed' && !form.fixed_date && (
                                                <p className="text-xs text-red-500 mt-1">
                                                    Fixed date is required when status is Fixed
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <Field icon={Calendar} label="Fixed Date"
                                            value={formatDate(ticket.fixed_date)} />
                                    )}
                                </div>
                            )}
                            <Field icon={Calendar} label="Last Updated"
                                value={formatDate(ticket.last_updated)} />
                            <Field icon={Calendar} label="Last Seen"
                                value={formatDate(ticket.last_seen_date)} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
