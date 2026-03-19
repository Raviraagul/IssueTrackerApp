import { useState } from 'react';
import { getDailyMovementReport } from '../api';
import { FileBarChart, Download, Search } from 'lucide-react';
import DateInput from '../components/DateInput';

function exportToCSV(data, filename) {
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

function Tab({ label, active, onClick }) {
    return (
        <button onClick={onClick}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
        ${active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}>
            {label}
        </button>
    );
}

function DailyMovementTable({ rows, loading, viewType }) {
    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent
                      rounded-full animate-spin" />
        </div>
    );
    if (!rows.length) return (
        <p className="text-center text-gray-400 py-12 text-sm">
            No data found — select a date range and click Generate
        </p>
    );

    const grouped = [];
    let i = 0;
    while (i < rows.length) {
        const r = rows[i];
        const dtKey = `${r.snapshot_date}_${r.snapshot_time}`;
        const prodKey = `${dtKey}_${r.product_name}`;
        let dtCount = 0;
        let prodCount = 0;
        let j = i;
        while (j < rows.length &&
            `${rows[j].snapshot_date}_${rows[j].snapshot_time}` === dtKey) {
            dtCount++; j++;
        }
        j = i;
        while (j < rows.length &&
            `${rows[j].snapshot_date}_${rows[j].snapshot_time}_${rows[j].product_name}` === prodKey) {
            prodCount++; j++;
        }
        grouped.push({ ...r, dtCount, prodCount, dtKey, prodKey });
        i++;
    }

    const renderedDt = new Set();
    const renderedProd = new Set();

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700 border-b
                         border-gray-200 dark:border-gray-600">
                        <th className="px-3 py-3 text-left text-xs font-semibold
                           text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold
                           text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold
                           text-gray-500 uppercase tracking-wider">Application</th>
                        {viewType === 'teamwise' && (
                            <th className="px-3 py-3 text-left text-xs font-semibold
                             text-gray-500 uppercase tracking-wider">Team</th>
                        )}
                        <th className="px-3 py-3 text-center text-xs font-semibold
                           text-green-600 uppercase">Live Move</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold
                           text-red-400 uppercase">Others</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold
                           text-gray-500 uppercase">Pre Prod</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold
                           text-gray-500 uppercase">New Issues</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold
                           text-yellow-600 uppercase">Dev Pending</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold
                           text-gray-500 uppercase">In Progress</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold
                           text-gray-500 uppercase">Yet to Start</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold
                           text-gray-500 uppercase">Completed</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold
                           text-orange-500 uppercase">Total Issue</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold
                           text-orange-600 uppercase">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {grouped.map((row, idx) => {
                        const showDt = !renderedDt.has(row.dtKey);
                        const showProd = !renderedProd.has(row.prodKey);
                        if (showDt) renderedDt.add(row.dtKey);
                        if (showProd) renderedProd.add(row.prodKey);
                        return (
                            <tr key={idx}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700/50
                             border-b border-gray-100 dark:border-gray-700">
                                {showDt && (
                                    <td rowSpan={row.dtCount}
                                        className="px-3 py-3 font-medium text-gray-900
                                 dark:text-white border-r border-gray-200
                                 dark:border-gray-600 align-middle">
                                        {new Date(row.snapshot_date + 'T00:00:00')
                                            .toLocaleDateString('en-GB')}
                                    </td>
                                )}
                                {showDt && (
                                    <td rowSpan={row.dtCount}
                                        className="px-3 py-3 text-gray-500 border-r
                                 border-gray-200 dark:border-gray-600 align-middle">
                                        {row.snapshot_time}
                                    </td>
                                )}
                                {showProd && (
                                    <td rowSpan={row.prodCount}
                                        className="px-3 py-3 font-medium text-gray-900
                                 dark:text-white border-r border-gray-200
                                 dark:border-gray-600 align-middle">
                                        {row.product_name}
                                    </td>
                                )}
                                {viewType === 'teamwise' && (
                                    <td className="px-3 py-3">
                                        <span className="px-2 py-0.5 rounded text-xs font-medium
                                     bg-indigo-100 text-indigo-700
                                     dark:bg-indigo-900/30 dark:text-indigo-400">
                                            {row.team}
                                        </span>
                                    </td>
                                )}
                                <td className="px-3 py-3 text-center">
                                    <span className={`font-bold ${row.live_move > 0
                                        ? 'text-green-600' : 'text-gray-400'}`}>
                                        {row.live_move || '—'}
                                    </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <span className={`font-medium ${row.others > 0
                                        ? 'text-red-400' : 'text-gray-400'}`}>
                                        {row.others || '—'}
                                    </span>
                                </td>
                                <td className="px-3 py-3 text-center text-gray-600
                               dark:text-gray-300">
                                    {row.pre_production || '—'}
                                </td>
                                <td className="px-3 py-3 text-center text-gray-600
                               dark:text-gray-300">
                                    {row.new_tickets || '—'}
                                </td>
                                <td className="px-3 py-3 text-center font-bold text-yellow-600">
                                    {row.dev_pending}
                                </td>
                                <td className="px-3 py-3 text-center text-gray-600
                               dark:text-gray-300">
                                    {row.in_progress || '—'}
                                </td>
                                <td className="px-3 py-3 text-center text-gray-600
                               dark:text-gray-300">
                                    {row.yet_to_start || '—'}
                                </td>
                                <td className="px-3 py-3 text-center text-gray-600
                               dark:text-gray-300">
                                    {row.completed_dev || '—'}
                                </td>
                                <td className="px-3 py-3 text-center font-bold text-orange-500">
                                    {row.total_issue}
                                </td>
                                {showProd && (
                                    <td rowSpan={row.prodCount}
                                        className="px-3 py-3 text-center font-bold text-orange-600
                                 text-lg border-l border-gray-200
                                 dark:border-gray-600 align-middle
                                 bg-orange-50 dark:bg-orange-900/10">
                                        {row.product_total}
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default function DailyMovementPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [viewType, setViewType] = useState('teamwise');

    const generate = async () => {
        if (!dateFrom) return;
        setLoading(true);
        try {
            const res = await getDailyMovementReport({
                date_from: dateFrom,
                date_to: dateTo || dateFrom,
            });
            setData(res.data);
        } catch { }
        finally { setLoading(false); }
    };

    const displayData = viewType === 'overall'
        ? (() => {
            const map = {};
            data.forEach(r => {
                const key = `${r.snapshot_date}_${r.snapshot_time}_${r.product_name}`;
                if (!map[key]) {
                    map[key] = { ...r };
                } else {
                    map[key].live_move += r.live_move;
                    map[key].others += r.others;
                    map[key].pre_production += r.pre_production;
                    map[key].new_tickets += r.new_tickets;
                    map[key].dev_pending += r.dev_pending;
                    map[key].in_progress += r.in_progress;
                    map[key].yet_to_start += r.yet_to_start;
                    map[key].completed_dev += r.completed_dev;
                    map[key].total_issue += r.total_issue;
                }
            });
            // Recalculate product_total for overall
            const result = Object.values(map);
            const prodTotals = {};
            result.forEach(r => {
                const k = `${r.snapshot_date}_${r.snapshot_time}_${r.product_name}`;
                prodTotals[k] = r.total_issue;
            });
            return result.map(r => ({
                ...r,
                product_total: prodTotals[
                    `${r.snapshot_date}_${r.snapshot_time}_${r.product_name}`
                ] || 0,
            }));
        })()
        : data;

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Daily Movement Report
                </h1>
                <p className="text-sm text-gray-400">
                    Track daily Live Move, Closed and pending issues
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <Tab label="Team Wise" active={viewType === 'teamwise'}
                    onClick={() => setViewType('teamwise')} />
                <Tab label="Overall" active={viewType === 'overall'}
                    onClick={() => setViewType('overall')} />
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm
                      border border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap gap-3 items-end">
                    <DateInput label="Date From" value={dateFrom} onChange={setDateFrom} />
                    <DateInput label="Date To (optional)" value={dateTo} onChange={setDateTo} />
                    <button onClick={generate} disabled={!dateFrom}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600
                       hover:bg-blue-700 disabled:opacity-50
                       disabled:cursor-not-allowed text-white text-sm
                       font-medium rounded-lg transition-colors mt-5">
                        <Search size={14} /> Generate
                    </button>
                    {displayData.length > 0 && (
                        <button
                            onClick={() => exportToCSV(displayData,
                                viewType === 'teamwise'
                                    ? 'Daily_Movement_TeamWise'
                                    : 'Daily_Movement_Overall'
                            )}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600
                         hover:bg-green-700 text-white text-sm font-medium
                         rounded-lg transition-colors mt-5">
                            <Download size={14} /> Export CSV
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                      border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700
                        flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileBarChart size={18} className="text-gray-400" />
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                            {viewType === 'teamwise' ? 'Team Wise' : 'Overall'} Daily Movement
                        </h2>
                    </div>
                    {displayData.length > 0 && (
                        <span className="text-xs text-gray-400">
                            {displayData.length} rows
                        </span>
                    )}
                </div>
                <DailyMovementTable
                    rows={displayData}
                    loading={loading}
                    viewType={viewType}
                />
            </div>
        </div>
    );
}