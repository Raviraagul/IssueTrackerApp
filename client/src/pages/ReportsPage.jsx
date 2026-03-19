import { useState } from 'react';
import { getTeamWiseReport, getOverallReport, getSummaryReport } from '../api';
import { FileBarChart, Download, Search } from 'lucide-react';
import Select from '../components/Select';
import DateInput from '../components/DateInput';

function exportToExcel(data, filename) {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const rows = data.map(r => headers.map(h => r[h] ?? '').join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function ReportTable({ columns, rows, loading }) {
    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent
                      rounded-full animate-spin" />
        </div>
    );
    if (!rows.length) return (
        <p className="text-center text-gray-400 py-12 text-sm">
            No data found — select a date and click Generate
        </p>
    );
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700 border-b
                         border-gray-200 dark:border-gray-600">
                        {columns.map(c => (
                            <th key={c.key}
                                className="px-4 py-3 text-left text-xs font-semibold
                             text-gray-500 dark:text-gray-400 uppercase
                             tracking-wider whitespace-nowrap">
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            {columns.map(c => (
                                <td key={c.key}
                                    className="px-4 py-3 text-gray-700 dark:text-gray-300
                               whitespace-nowrap">
                                    {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Tab({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  ${active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
        >
            {label}
        </button>
    );
}

// ── Per-tab panel ─────────────────────────────────────────────────────────────
function ReportPanel({ fetchFn, columns, title, exportName, needsBothDates }) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const generate = async () => {
        if (!dateFrom) return;
        if (needsBothDates && !dateTo) return;
        setLoading(true);
        try {
            const res = await fetchFn({
                date_from: dateFrom,
                date_to: dateTo || dateFrom,
            });
            setData(res.data);
        } catch { }
        finally { setLoading(false); }
    };

    return (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm
                      border border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap gap-3 items-end">
                    {/* <div>
                        <label className="block text-xs font-medium text-gray-500
                               dark:text-gray-400 mb-1">
                            {needsBothDates ? 'Date From *' : 'Date'}
                        </label>
                        <input type="date" value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-300
                         dark:border-gray-600 bg-white dark:bg-gray-700
                         text-gray-900 dark:text-white text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500
                               dark:text-gray-400 mb-1">
                            {needsBothDates ? 'Date To *' : 'Date To (optional)'}
                        </label>
                        <input type="date" value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-300
                         dark:border-gray-600 bg-white dark:bg-gray-700
                         text-gray-900 dark:text-white text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div> */}
                    <DateInput
                        label={needsBothDates ? 'Date From *' : 'Date'}
                        value={dateFrom}
                        onChange={setDateFrom}
                    />
                    <DateInput
                        label={needsBothDates ? 'Date To *' : 'Date To (optional)'}
                        value={dateTo}
                        onChange={setDateTo}
                    />
                    <button
                        onClick={generate}
                        disabled={!dateFrom || (needsBothDates && !dateTo)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600
                       hover:bg-blue-700 disabled:opacity-50
                       disabled:cursor-not-allowed text-white text-sm
                       font-medium rounded-lg transition-colors"
                    >
                        <Search size={14} /> Generate
                    </button>
                    {data.length > 0 && (
                        <button
                            onClick={() => exportToExcel(data, exportName)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600
                         hover:bg-green-700 text-white text-sm font-medium
                         rounded-lg transition-colors"
                        >
                            <Download size={14} /> Export CSV
                        </button>
                    )}
                </div>
                {needsBothDates && (!dateFrom || !dateTo) && (
                    <p className="text-xs text-amber-500 mt-2">
                        Summary report requires both From and To dates
                    </p>
                )}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                      border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700
                        flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileBarChart size={18} className="text-gray-400" />
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                            {title}
                        </h2>
                    </div>
                    {data.length > 0 && (
                        <span className="text-xs text-gray-400">{data.length} rows</span>
                    )}
                </div>
                <ReportTable columns={columns} rows={data} loading={loading} />
            </div>
        </div>
    );
}

// ── Column definitions ────────────────────────────────────────────────────────
const teamwiseCols = [
    {
        key: 'snapshot_date', label: 'Date',
        render: v => v ? new Date(v).toLocaleDateString() : '—'
    },
    { key: 'snapshot_time', label: 'Time' },
    { key: 'product_name', label: 'Product' },
    { key: 'team', label: 'Team' },
    { key: 'pre_production', label: 'Pre Prod' },
    { key: 'yet_to_start', label: 'Yet to Start' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed_dev', label: 'Completed' },
    {
        key: 'total_active', label: 'Total Active',
        render: v => <span className="font-bold text-blue-600">{v}</span>
    },
    {
        key: 'total_issue', label: 'Total Issue',
        render: v => <span className="font-bold text-orange-600">{v}</span>
    },
];

const overallCols = [
    {
        key: 'snapshot_date', label: 'Date',
        render: v => v ? new Date(v).toLocaleDateString() : '—'
    },
    { key: 'snapshot_time', label: 'Time' },
    { key: 'product_name', label: 'Product' },
    { key: 'pre_production', label: 'Pre Prod' },
    { key: 'yet_to_start', label: 'Yet to Start' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed_dev', label: 'Completed' },
    {
        key: 'total_active', label: 'Total Active',
        render: v => <span className="font-bold text-blue-600">{v}</span>
    },
    {
        key: 'total_issue', label: 'Total Issue',
        render: v => <span className="font-bold text-orange-600">{v}</span>
    },
];

const summaryCols = [
    { key: 'product_name', label: 'Product' },
    { key: 'team', label: 'Team' },
    { key: 'total_snapshots', label: 'Snapshots' },
    { key: 'avg_yet_to_start', label: 'Avg Yet to Start' },
    { key: 'avg_in_progress', label: 'Avg In Progress' },
    { key: 'avg_completed_dev', label: 'Avg Completed' },
    { key: 'avg_pre_production', label: 'Avg Pre Prod' },
    {
        key: 'avg_total_active', label: 'Avg Active',
        render: v => <span className="font-bold text-blue-600">{v}</span>
    },
    {
        key: 'max_active', label: 'Max Active',
        render: v => <span className="font-bold text-red-500">{v}</span>
    },
    {
        key: 'min_active', label: 'Min Active',
        render: v => <span className="font-bold text-green-600">{v}</span>
    },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
    const [tab, setTab] = useState('teamwise');

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Reports
                </h1>
                <p className="text-sm text-gray-400">
                    Generate and export daily or summary reports
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <Tab label="Team Wise" active={tab === 'teamwise'}
                    onClick={() => setTab('teamwise')} />
                <Tab label="Overall" active={tab === 'overall'}
                    onClick={() => setTab('overall')} />
                <Tab label="Summary" active={tab === 'summary'}
                    onClick={() => setTab('summary')} />
            </div>

            {/* Each tab keeps its own state — data is retained on switch */}
            <div className={tab === 'teamwise' ? '' : 'hidden'}>
                <ReportPanel
                    fetchFn={getTeamWiseReport}
                    columns={teamwiseCols}
                    title="Team Wise Issue Count"
                    exportName="TeamWise_Report"
                    needsBothDates={false}
                />
            </div>
            <div className={tab === 'overall' ? '' : 'hidden'}>
                <ReportPanel
                    fetchFn={getOverallReport}
                    columns={overallCols}
                    title="Overall Issue Count"
                    exportName="Overall_Report"
                    needsBothDates={false}
                />
            </div>
            <div className={tab === 'summary' ? '' : 'hidden'}>
                <ReportPanel
                    fetchFn={getSummaryReport}
                    columns={summaryCols}
                    title="Summary Report"
                    exportName="Summary_Report"
                    needsBothDates={true}
                />
            </div>
        </div>
    );
}