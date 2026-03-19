import { useState, useEffect } from 'react';
import { getTickets } from '../api';
import { Search, Filter, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import Select from '../components/Select';
import { useNavigate } from 'react-router-dom';


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

function Badge({ text, colorMap, fallback = 'bg-gray-100 text-gray-600' }) {
    const cls = colorMap?.[text] || fallback;
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
            {text || '—'}
        </span>
    );
}

const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
};

/* function TicketModal({ ticket, onClose }) {
    if (!ticket) return null;
    const rows = [
        ['Ticket No', ticket.ticket_no],
        ['Date', formatDate(ticket.date)],
        ['Company', ticket.company],
        ['Product', ticket.product_name],
        ['Team', ticket.team],
        ['Platform', ticket.platform],
        ['Module', ticket.module],
        ['Sub Module', ticket.sub_module],
        ['Priority', ticket.priority],
        ['Status', ticket.status_norm],
        ['Assigned To', ticket.assigned_to],
        ['Fixed Status', ticket.fixed_status],
        ['Fixed Date', formatDate(ticket.fixed_date)],
        ['Comments', ticket.comments],
    ];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl
                      max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4
                        border-b border-gray-200 dark:border-gray-700 flex
                        items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {ticket.ticket_no}
                    </h2>
                    <button onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600
                             dark:hover:text-gray-200 hover:bg-gray-100
                             dark:hover:bg-gray-700">
                        ✕
                    </button>
                </div>
                <div className="px-6 py-4">
                    <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                            Issue Description
                        </p>
                        <p className="text-gray-900 dark:text-white text-sm leading-relaxed">
                            {ticket.issue_description || '—'}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {rows.map(([label, value]) => (
                            <div key={label} className="space-y-0.5">
                                <p className="text-xs text-gray-400">{label}</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {value || '—'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
} */

export default function TicketsPage() {
    const [tickets, setTickets] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    // const [selected, setSelected] = useState(null);
    const navigate = useNavigate();

    const [filters, setFilters] = useState({
        search: '', team: '', product: '', status: '', priority: '', missing: ''
    });
    const [applied, setApplied] = useState({});

    const fetchTickets = async (f = applied, p = page) => {
        setLoading(true);
        try {
            const res = await getTickets({ ...f, page: p, limit: 20 });
            setTickets(res.data.tickets);
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
        } catch { }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTickets(applied, page); }, [page]);

    const applyFilters = () => {
        setPage(1);
        setApplied(filters);
        fetchTickets(filters, 1);
    };

    const clearFilters = () => {
        const empty = { search: '', team: '', product: '', status: '', priority: '' };
        setFilters(empty);
        setApplied(empty);
        setPage(1);
        fetchTickets(empty, 1);
    };

    /* const Select = ({ field, options, placeholder }) => (
        <select
            value={filters[field]}
            onChange={(e) => setFilters({ ...filters, [field]: e.target.value })}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            <option value="">{placeholder}</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
    ); */

    return (
        <div className="space-y-4">
            {/* {selected && (
                <TicketModal ticket={selected} onClose={() => setSelected(null)} />
            )} */}

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
                      border border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap gap-3 items-end">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2
                                          text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search ticket, company, module..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300
                         dark:border-gray-600 bg-white dark:bg-gray-700
                         text-gray-900 dark:text-white text-sm focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    {/* <Select field="team" options={['API', 'Web', 'App']}
                        placeholder="All Teams" />
                    <Select field="product" options={['Salesmatic', 'Distomatic']}
                        placeholder="All Products" />
                    <Select field="status" options={[
                        'Yet to Start (Dev)', 'In-Progress (Dev)',
                        'Completed (Dev)', 'Pre Production', 'Fixed', 'Closed'
                    ]} placeholder="All Statuses" />
                    <Select field="priority" options={['High', 'Medium', 'Low']}
                        placeholder="All Priorities" /> */}
                    <div className="w-36">
                        <Select
                            value={filters.team}
                            onChange={v => setFilters({ ...filters, team: v })}
                            options={['API', 'Web', 'App']}
                            placeholder="All Teams"
                        />
                    </div>
                    <div className="w-40">
                        <Select
                            value={filters.product}
                            onChange={v => setFilters({ ...filters, product: v })}
                            options={['Salesmatic', 'Distomatic']}
                            placeholder="All Products"
                        />
                    </div>
                    <div className="w-48">
                        <Select
                            value={filters.status}
                            onChange={v => setFilters({ ...filters, status: v })}
                            options={[
                                'Yet to Start (Dev)', 'In-Progress (Dev)',
                                'Completed (Dev)', 'Pre Production', 'Fixed', 'Closed'
                            ]}
                            placeholder="All Statuses"
                        />
                    </div>
                    <div className="w-40">
                        <Select
                            value={filters.priority}
                            onChange={v => setFilters({ ...filters, priority: v })}
                            options={['High', 'Medium', 'Low']}
                            placeholder="All Priorities"
                        />
                    </div>
                    <button onClick={applyFilters}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600
                             hover:bg-blue-700 text-white text-sm font-medium
                             rounded-lg transition-colors">
                        <Filter size={14} /> Apply
                    </button>
                    <button
                        onClick={() => setFilters({
                            ...filters, missing: filters.missing === 'true' ? '' : 'true'
                        })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                                    font-medium border transition-colors whitespace-nowrap
                                    ${filters.missing === 'true'
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            }`}
                    >
                        ⚠️ Missing only
                    </button>
                    <button onClick={clearFilters}
                        className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400
                             hover:text-gray-700 dark:hover:text-gray-200
                             rounded-lg border border-gray-300 dark:border-gray-600
                             transition-colors">
                        Clear
                    </button>
                </div>
            </div>

            {/* Table */}
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
                                  border-t-transparent rounded-full
                                  animate-spin mx-auto" />
                                </td></tr>
                            ) : tickets.length === 0 ? (
                                <tr><td colSpan={10} className="py-16 text-center
                                                 text-gray-400 text-sm">
                                    No tickets found
                                </td></tr>
                            ) : tickets.map((t) => (
                                <tr key={t.id}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50
                                                transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {/* <span className="font-medium text-blue-600 dark:text-blue-400">
                                                {t.ticket_no}
                                            </span> */}
                                            <button
                                                onClick={() => navigate(`/tickets/${t.id}`)}
                                                className="font-medium text-blue-600 dark:text-blue-400
                                                        hover:underline text-left"
                                            >
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
                                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400
                                 whitespace-nowrap">
                                        {t.date ? new Date(t.date).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-900 dark:text-white
                                 max-w-[120px] truncate">
                                        {t.company}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-600
                                 dark:text-gray-300">
                                        {t.product_name}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded text-xs font-medium
                                     bg-indigo-100 text-indigo-700
                                     dark:bg-indigo-900/30 dark:text-indigo-400">
                                            {t.team}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300
                                 max-w-[120px] truncate">
                                        {t.module}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge text={t.priority} colorMap={PRIORITY_COLORS} />
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <Badge text={t.status_norm} colorMap={STATUS_COLORS} />
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300
                                 max-w-[100px] truncate">
                                        {t.assigned_to || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            // onClick={() => setSelected(t)}
                                            onClick={() => navigate(`/tickets/${t.id}`)}
                                            className="p-1.5 rounded-lg text-gray-400
                                 hover:text-blue-600 hover:bg-blue-50
                                 dark:hover:bg-blue-900/20 transition-colors"
                                        >
                                            <Eye size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700
                          flex items-center justify-between">
                        <p className="text-sm text-gray-400">
                            Page {page} of {totalPages} · {total} tickets
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600
                           disabled:opacity-40 hover:bg-gray-50
                           dark:hover:bg-gray-700 transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600
                           disabled:opacity-40 hover:bg-gray-50
                           dark:hover:bg-gray-700 transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}