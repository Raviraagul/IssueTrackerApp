// ── Imports ───────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { getTickets } from '../api';
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Calendar, X } from 'lucide-react';
import Select from '../components/Select';
import DateInput from '../components/DateInput';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';

// ──────────────────────────────────────────────────────────────────────────────
// HOW THIS PAGE WORKS — READ THIS FIRST
// ──────────────────────────────────────────────────────────────────────────────
//
// PROBLEM: React state is destroyed when you navigate away.
// SOLUTION: Store filters in the URL instead of React state.
//
// URL example: /tickets?team=API&status=Fixed&date_from=2026-03-01&page=2
//
// We have TWO kinds of state:
//
// 1. APPLIED (URL) — the active filters used to fetch data
//    → Lives in the URL query params
//    → Survives navigation, back button, refresh
//    → Read via: searchParams.get('team') etc.
//    → Written via: setSearchParams({...})
//
// 2. DRAFT (local) — what the user is currently selecting in the UI
//    → Lives in React state (useState)
//    → Changes on every dropdown/input interaction
//    → Only pushed to URL when user clicks Apply
//    → Why? So user can change multiple filters before applying
//
// FLOW:
//   User changes dropdown → draft updates (UI reflects change)
//   User clicks Apply → draft pushed to URL → URL changes
//   URL change → useEffect detects → fetchTickets() runs → data loads
//   User navigates away and back → URL still has filters → data reloads correctly
//
// ──────────────────────────────────────────────────────────────────────────────
// ── Static color maps ─────────────────────────────────────────────────────────
// These never change — defined outside component to avoid recreating on every render
const STATUS_COLORS = {
    'Yet to Start (Dev)': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'In-Progress (Dev)': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Completed (Dev)': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'Pre Production': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    'Fixed': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'Closed': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const PRIORITY_COLORS = {
    'High': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Medium': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Low': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

// ── Badge component ───────────────────────────────────────────────────────────
function Badge({ text, colorMap, fallback = 'bg-gray-100 text-gray-600' }) {
    const cls = colorMap?.[text] || fallback;
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
            {text || '—'}
        </span>
    );
}

// ── Date formatter ────────────────────────────────────────────────────────────
const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
};

// ── Date range label for the active filter badge ──────────────────────────────
// e.g. "09 Mar 2026" or "09 Mar 2026 – 16 Mar 2026"
const formatDateLabel = (from, to) => {
    if (!from) return null;
    const f = new Date(from + 'T00:00:00').toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
    if (!to || to === from) return f;
    const t = new Date(to + 'T00:00:00').toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
    return `${f} – ${t}`;
};

// ── Main Page Component ───────────────────────────────────────────────────────
export default function TicketsPage() {
    const location = useLocation();
    console.log(location.pathname + location.search);

    const navigate = useNavigate();

    // ── useSearchParams ───────────────────────────────────────────────────────
    // searchParams   → read URL params  (like reading from localStorage)
    // setSearchParams → write URL params (like writing to localStorage)
    // Every time setSearchParams is called:
    //   1. URL updates in the browser address bar
    //   2. Browser adds it to history (back button works)
    //   3. searchParams object updates → component re-renders
    const [searchParams, setSearchParams] = useSearchParams();

    // ── APPLIED filters — read directly from URL ──────────────────────────────
    // These reflect what's CURRENTLY ACTIVE (in the URL)
    // .get() returns null if param doesn't exist → we default to ''
    // ALL filters including date are in the URL so they survive navigation
    const applied = {
        search: searchParams.get('search') || '',
        team: searchParams.get('team') || '',
        product: searchParams.get('product') || '',
        status: searchParams.get('status') || '',
        priority: searchParams.get('priority') || '',
        missing: searchParams.get('missing') || '',
        date_from: searchParams.get('date_from') || '',
        date_to: searchParams.get('date_to') || '',
    };

    // Page number also lives in the URL
    // parseInt because URL values are always strings, but we need a number
    // Default to page 1 if not in URL
    const page = parseInt(searchParams.get('page') || '1');

    // ── Draft filters (local state — what the user is currently typing/selecting)
    // This is SEPARATE from applied filters
    // Think of it as the "pending" state — not yet applied to the URL
    // Why separate? So the user can change multiple dropdowns before hitting Apply
    // Without this, every dropdown change would immediately refetch data
    // Initialized from the URL so back button also restores the input values
    const [draft, setDraft] = useState({
        search: applied.search,
        team: applied.team,
        product: applied.product,
        status: applied.status,
        priority: applied.priority,
        missing: applied.missing,
    });

    // Date inputs are also draft — separate because they have their own UI panel
    // Initialized from URL so they restore correctly on back navigation
    const [dateFrom, setDateFrom] = useState(applied.date_from);
    const [dateTo, setDateTo] = useState(applied.date_to);

    // ── Date panel open/close ─────────────────────────────────────────────────
    // This is purely UI state — doesn't need to survive navigation
    const [dateOpen, setDateOpen] = useState(false);

    // ── Server data ───────────────────────────────────────────────────────────
    const [tickets, setTickets] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);

    // ── Sync draft inputs when URL changes ────────────────────────────────────
    // Scenario: user is on page 2 with team=API, hits browser back button
    // URL changes to previous state → this effect runs → inputs update to match
    // Without this, the dropdowns would show wrong values after back button
    useEffect(() => {
        setDraft({
            search: searchParams.get('search') || '',
            team: searchParams.get('team') || '',
            product: searchParams.get('product') || '',
            status: searchParams.get('status') || '',
            priority: searchParams.get('priority') || '',
            missing: searchParams.get('missing') || '',
        });
        // Also sync date inputs from URL
        setDateFrom(searchParams.get('date_from') || '');
        setDateTo(searchParams.get('date_to') || '');
    }, [searchParams]);
    // Dependency: [searchParams] — runs every time the URL changes

    // ── Fetch tickets ─────────────────────────────────────────────────────────
    // Reads from `applied` (URL) not `draft` (local)
    // Only include non-empty params to keep API calls clean
    const fetchTickets = async () => {
        setLoading(true);
        try {
            // Build params object — only include non-empty values
            // This keeps API calls clean
            const params = { page, limit: 20 };
            if (applied.search) params.search = applied.search;
            if (applied.team) params.team = applied.team;
            if (applied.product) params.product = applied.product;
            if (applied.status) params.status = applied.status;
            if (applied.priority) params.priority = applied.priority;
            if (applied.missing) params.missing = applied.missing;
            if (applied.date_from) params.date_from = applied.date_from;
            if (applied.date_to) params.date_to = applied.date_to;

            const res = await getTickets(params);

            setTickets(res.data.tickets);
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
        } catch (error) {
            console.log(`Error from /tickets: ${error}`);
        }
        finally { setLoading(false); }
    };

    // ── Auto-fetch when URL changes ───────────────────────────────────────────
    // This is the ONLY place fetchTickets() is called
    // Every action (apply, clear, paginate) just updates the URL
    // URL change → this effect → fetchTickets()
    // Clean single source of truth for data fetching
    useEffect(() => {
        fetchTickets();
    }, [searchParams]);
    // Dependency: [searchParams] — runs every time URL changes

    // ── Helper: clean params from current URL ─────────────────────────────────
    // Returns only non-empty applied values as a plain object
    // Used when updating URL while preserving existing filters
    // Example: changing page should keep team=API, don't lose it
    const getCleanParams = () => {
        const params = {};
        if (applied.search) params.search = applied.search;
        if (applied.team) params.team = applied.team;
        if (applied.product) params.product = applied.product;
        if (applied.status) params.status = applied.status;
        if (applied.priority) params.priority = applied.priority;
        if (applied.missing) params.missing = applied.missing;
        return params;
    };

    // ── Apply filters ─────────────────────────────────────────────────────────
    // Called when user clicks the Apply button
    // Takes the draft values and pushes them to the URL
    // Only includes non-empty values to keep URL clean
    // Setting page: '1' resets to first page when filters change
    // Note: URL values must be strings, not numbers
    const applyFilters = () => {
        const params = {};
        if (draft.search) params.search = draft.search;
        if (draft.team) params.team = draft.team;
        if (draft.product) params.product = draft.product;
        if (draft.status) params.status = draft.status;
        if (draft.priority) params.priority = draft.priority;
        if (draft.missing) params.missing = draft.missing;
        // Preserve date filter when applying other filters
        if (applied.date_from) params.date_from = applied.date_from;
        if (applied.date_to) params.date_to = applied.date_to;
        params.page = '1';
        setSearchParams(params);
        // After this: URL changes → searchParams changes → useEffect runs → fetchTickets()
        // The data fetch is automatic, no need to call fetchTickets() here
    };

    // ── Clear all filters ─────────────────────────────────────────────────────
    // Clears both draft (inputs) and URL (applied filters)
    // setSearchParams({}) sets URL to /tickets with no params at all
    const clearFilters = () => {
        setDraft({ search: '', team: '', product: '', status: '', priority: '', missing: '' });
        setDateFrom('');
        setDateTo('');
        setSearchParams({});
    };

    // ── Apply date filter ─────────────────────────────────────────────────────
    // Add date_from and date_to to URL while keeping other filters
    const applyDateFilter = () => {
        if (!dateFrom) return;
        const params = { ...getCleanParams(), page: '1' };
        params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        setSearchParams(params);
        setDateOpen(false);
    };

    // ── Clear date filter ─────────────────────────────────────────────────────
    // Remove date params from URL while keeping other filters
    const clearDateFilter = () => {
        setDateFrom('');
        setDateTo('');
        const params = { ...getCleanParams() };
        delete params.date_from; // remove from params object
        delete params.date_to;
        params.page = '1';
        setSearchParams(params);
    };

    // ── Computed UI values ────────────────────────────────────────────────────
    // dateActive: true when date filter is applied (date_from exists in URL)
    const dateActive = !!applied.date_from;
    // dateLabel: formatted string shown on the button e.g. "09 Mar – 16 Mar 2026"
    const dateLabel = formatDateLabel(applied.date_from, applied.date_to);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Tickets
                    </h1>
                    <p className="text-sm text-gray-400">{total} total tickets</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm
                      border border-gray-100 dark:border-gray-700 space-y-3">

                {/* Row 1 — Search + Dropdowns + Date filter */}
                <div className="flex flex-wrap gap-3 items-end">

                    {/* Search — updates draft.search on every keystroke */}
                    {/* Enter key shortcut calls applyFilters() */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search ticket, company, module..."
                            value={draft.search}
                            onChange={(e) => setDraft({ ...draft, search: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300
                         dark:border-gray-600 bg-white dark:bg-gray-700
                         text-gray-900 dark:text-white text-sm focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Team dropdown — v || '' ensures empty string when cleared */}
                    <div className="w-36">
                        <Select
                            value={draft.team}
                            onChange={v => setDraft({ ...draft, team: v || '' })}
                            options={['API', 'Web', 'App']}
                            placeholder="All Teams"
                        />
                    </div>

                    {/* Product dropdown */}
                    <div className="w-40">
                        <Select
                            value={draft.product}
                            onChange={v => setDraft({ ...draft, product: v || '' })}
                            options={['Salesmatic', 'Distomatic']}
                            placeholder="All Products"
                        />
                    </div>

                    {/* Status dropdown */}
                    <div className="w-48">
                        <Select
                            value={draft.status}
                            onChange={v => setDraft({ ...draft, status: v || '' })}
                            options={[
                                'Yet to Start (Dev)', 'In-Progress (Dev)',
                                'Completed (Dev)', 'Pre Production', 'Fixed', 'Closed'
                            ]}
                            placeholder="All Statuses"
                        />
                    </div>

                    {/* Priority dropdown */}
                    <div className="w-40">
                        <Select
                            value={draft.priority}
                            onChange={v => setDraft({ ...draft, priority: v || '' })}
                            options={['High', 'Medium', 'Low']}
                            placeholder="All Priorities"
                        />
                    </div>

                    {/* Date filter toggle button */}
                    {/* Blue highlight when dateActive (date is in URL) */}
                    <button
                        onClick={() => setDateOpen(o => !o)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                            font-medium border transition-colors
                            ${dateActive
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700'
                                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}>
                        <Calendar size={14} />
                        {/* Show range label when active, generic text when not */}
                        {dateActive ? `Date: ${dateLabel}` : 'Filter by Date'}
                        <span className={`transition-transform duration-200 ${dateOpen ? 'rotate-180' : ''}`}>
                            ▾
                        </span>
                    </button>

                    {/* Clear date — only rendered when date filter is active */}
                    {dateActive && (
                        <button
                            onClick={clearDateFilter}
                            className="flex items-center gap-1 px-2 py-2 rounded-lg text-xs
                                text-red-500 dark:text-red-400 border border-red-200
                                dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20
                                transition-colors">
                            <X size={11} /> Clear date
                        </button>
                    )}
                </div>

                {/* Collapsible date panel — only rendered when dateOpen is true */}
                {dateOpen && (
                    <div className="flex flex-wrap gap-3 items-end pt-2
                        border-t border-gray-100 dark:border-gray-700">
                        <DateInput label="Date From" value={dateFrom} onChange={setDateFrom} />
                        <DateInput label="Date To (optional)" value={dateTo} onChange={setDateTo} />
                        <button
                            onClick={applyDateFilter}
                            disabled={!dateFrom}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600
                                hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                                text-white text-sm font-medium rounded-lg transition-colors mt-5">
                            <Search size={14} /> Apply Date
                        </button>
                        <button
                            onClick={() => setDateOpen(false)}
                            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400
                                hover:text-gray-700 dark:hover:text-gray-200
                                rounded-lg border border-gray-300 dark:border-gray-600
                                transition-colors mt-5">
                            Cancel
                        </button>
                    </div>
                )}

                {/* Row 2 — Action buttons */}
                <div className="flex flex-wrap gap-3 items-center">

                    {/* Apply — pushes draft state to URL */}
                    <button onClick={applyFilters}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600
                             hover:bg-blue-700 text-white text-sm font-medium
                             rounded-lg transition-colors">
                        <Filter size={14} /> Apply
                    </button>

                    {/* Missing only — toggles missing=true in draft */}
                    {/* Highlighted when draft.missing === 'true' */}
                    <button
                        onClick={() => setDraft({
                            ...draft,
                            missing: draft.missing === 'true' ? '' : 'true'
                        })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                                    font-medium border transition-colors whitespace-nowrap
                                    ${draft.missing === 'true'
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            }`}>
                        ⚠️ Missing only
                    </button>

                    {/* Clear — resets everything: draft inputs + URL params */}
                    <button onClick={clearFilters}
                        className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400
                             hover:text-gray-700 dark:hover:text-gray-200
                             rounded-lg border border-gray-300 dark:border-gray-600
                             transition-colors">
                        Clear
                    </button>
                </div>
            </div>

            {/* ── Tickets Table ── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                      border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700 border-b
                             border-gray-200 dark:border-gray-600">
                                {['Ticket No', 'Date', 'Company', 'Product', 'Team',
                                    'Module', 'Priority', 'Status', 'Assigned To', ''].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                                          text-gray-500 dark:text-gray-400 uppercase
                                          tracking-wider whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan={10} className="py-16 text-center">
                                    <div className="w-8 h-8 border-4 border-blue-500
                                  border-t-transparent rounded-full animate-spin mx-auto" />
                                </td></tr>
                            ) : tickets.length === 0 ? (
                                <tr><td colSpan={10} className="py-16 text-center text-gray-400 text-sm">
                                    No tickets found
                                </td></tr>
                            ) : tickets.map((t) => (
                                <tr key={t.id}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => navigate(`/tickets/${t.id}${location.search}`)}
                                                className="font-medium text-blue-600 dark:text-blue-400
                                                        hover:underline text-left">
                                                {t.ticket_no}
                                            </button>
                                            {t.is_missing && (
                                                <span className="px-1.5 py-0.5 rounded text-xs font-medium
                                                            bg-amber-100 text-amber-700
                                                            dark:bg-amber-900/30 dark:text-amber-400">
                                                    Missing
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {formatDate(t.date)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-900 dark:text-white max-w-[120px] truncate">
                                        {t.company}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                        {t.product_name}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded text-xs font-medium
                                     bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                                            {t.team}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[120px] truncate">
                                        {t.module}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge text={t.priority} colorMap={PRIORITY_COLORS} />
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <Badge text={t.status_norm} colorMap={STATUS_COLORS} />
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[100px] truncate">
                                        {t.assigned_to || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => navigate(`/tickets/${t.id}${location.search}`)}
                                            className="p-1.5 rounded-lg text-gray-400
                                 hover:text-blue-600 hover:bg-blue-50
                                 dark:hover:bg-blue-900/20 transition-colors">
                                            <Eye size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination ── */}
                {/* Only shown when there are multiple pages */}
                {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700
                          flex items-center justify-between">
                        <p className="text-sm text-gray-400">
                            Page {page} of {totalPages} · {total} tickets
                        </p>
                        <div className="flex gap-2">
                            {/* Previous page */}
                            {/* getCleanParams() preserves all current filters */}
                            {/* String() converts number to string for URL */}
                            {/* Math.max(1, page-1) prevents going below page 1 */}
                            <button
                                onClick={() => setSearchParams({
                                    ...getCleanParams(),
                                    page: String(Math.max(1, page - 1))
                                })}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600
                           disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <ChevronLeft size={16} />
                            </button>
                            {/* Next page */}
                            {/* Math.min(totalPages, page+1) prevents going beyond last page */}
                            <button
                                onClick={() => setSearchParams({
                                    ...getCleanParams(),
                                    page: String(Math.min(totalPages, page + 1))
                                })}
                                disabled={page === totalPages}
                                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600
                           disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
