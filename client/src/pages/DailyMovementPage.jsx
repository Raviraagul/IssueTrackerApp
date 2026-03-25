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
        // const dtKey = `${r.snapshot_date}_${r.snapshot_time}`;
        const dtKey = `${r.snapshot_date}`;
        const prodKey = `${dtKey}_${r.product_name}`;
        let dtCount = 0, prodCount = 0, j = i;
        while (j < rows.length &&
            // `${rows[j].snapshot_date}_${rows[j].snapshot_time}` === dtKey) {
            `${rows[j].snapshot_date}` === dtKey) {
            dtCount++; j++;
        }
        j = i;
        while (j < rows.length &&
            // `${rows[j].snapshot_date}_${rows[j].snapshot_time}_${rows[j].product_name}` === prodKey) {
            `${rows[j].snapshot_date}_${rows[j].product_name}` === prodKey) {
            prodCount++; j++;
        }
        grouped.push({ ...r, dtCount, prodCount, dtKey, prodKey });
        i++;
    }

    const renderedDt = new Set();
    const renderedProd = new Set();

    // Alternate shading per date block
    const dateBlocks = [...new Set(grouped.map(r => r.dtKey))];
    const dateShade = {};
    dateBlocks.forEach((key, idx) => {
        dateShade[key] = idx % 2 === 0 ? '' : 'bg-gray-50/60 dark:bg-gray-700/30';
    });

    const thBase = `px-4 py-3 text-left text-xs font-semibold text-gray-500
                  dark:text-gray-400 uppercase tracking-wider whitespace-nowrap`;
    const thCenter = `px-4 py-3 text-center text-xs font-semibold text-gray-500
                    dark:text-gray-400 uppercase tracking-wider whitespace-nowrap`;

    return (
        <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                    {/* <tr className="bg-gray-50 dark:bg-gray-700 border-b-2
                         border-gray-200 dark:border-gray-600"> */}
                    <tr className="bg-gray-50 dark:bg-gray-700 border-b-2
                         border-gray-300/60 dark:border-gray-700/60">
                        <th className={thBase}>Date</th>
                        {/* <th className={thBase}>Time</th> */}
                        <th className={thBase}>Application</th>
                        {viewType === 'teamwise' && (
                            <th className={thBase}>Team</th>
                        )}
                        <th className={`${thCenter} text-green-600 dark:text-green-400`}>
                            Live Move
                        </th>
                        <th className={`${thCenter} text-red-500 dark:text-red-400`}>
                            Others
                        </th>
                        <th className={thCenter}>Pre Prod</th>
                        <th className={`${thCenter} text-sky-600 dark:text-sky-400`}>
                            New Issues
                        </th>
                        <th className={`${thCenter} text-violet-600 dark:text-violet-400`}>
                            Dev Total
                        </th>
                        <th className={thCenter}>In Progress</th>
                        <th className={thCenter}>Yet to Start</th>
                        <th className={thCenter}>Dev Completed</th>
                        <th className={`${thCenter} text-orange-500 dark:text-orange-400`}>
                            Total Issue
                        </th>
                        <th className={`${thCenter} text-orange-600 dark:text-orange-300`}>
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {grouped.map((row, idx) => {
                        const showDt = !renderedDt.has(row.dtKey);
                        const showProd = !renderedProd.has(row.prodKey);
                        if (showDt) renderedDt.add(row.dtKey);
                        if (showProd) renderedProd.add(row.prodKey);
                        const shade = dateShade[row.dtKey];

                        return (
                            <tr key={idx}
                                className={`hover:bg-blue-50/30 dark:hover:bg-blue-900/10
                              transition-colors ${shade}`}>
                                {/* Date */}
                                {showDt && (
                                    <td rowSpan={row.dtCount}
                                        className={`px-4 py-3 align-middle border-r border-b
                                 border-gray-300/60 dark:border-gray-700 ${shade}`}>
                                        <span className="font-semibold text-gray-900 dark:text-white
                                     whitespace-nowrap">
                                            {new Date(row.snapshot_date + 'T00:00:00')
                                                .toLocaleDateString('en-GB', {
                                                    day: '2-digit', month: 'short', year: 'numeric'
                                                })}
                                        </span>
                                    </td>
                                )}
                                {/* Time */}
                                {/* {showDt && (
                                    <td rowSpan={row.dtCount}
                                        className={`px-4 py-3 align-middle border-r border-b
                                 border-gray-300/60 dark:border-gray-700 ${shade}`}>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                                            ${row.snapshot_time === 'AM'
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                            }`}>
                                            {row.snapshot_time}
                                        </span>
                                    </td>
                                )} */}
                                {/* Application */}
                                {showProd && (
                                    <td rowSpan={row.prodCount}
                                        className={`px-4 py-3 align-middle border-r border-b
                                 border-gray-300/60 dark:border-gray-700 ${shade}`}>
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold
                                            ${row.product_name === 'Salesmatic'
                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                            }`}>
                                            {row.product_name}
                                        </span>
                                    </td>
                                )}
                                {/* Team */}
                                {viewType === 'teamwise' && (
                                    <td className={`px-4 py-3 border-b border-gray-300/60 dark:border-gray-700 ${shade}`}>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium
                                            ${row.team === 'API'
                                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                : row.team === 'Web'
                                                    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                                                    : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                                            }`}>
                                            {row.team}
                                        </span>
                                    </td>
                                )}
                                {/* Live Move */}
                                <td className={`px-4 py-3 border-b border-gray-300/60 dark:border-gray-700 text-center ${shade}`}>
                                    {row.live_move > 0
                                        ? <span className="font-bold text-green-600
                                       dark:text-green-400">{row.live_move}</span>
                                        : <span className="text-gray-300 dark:text-gray-600">—</span>
                                    }
                                </td>
                                {/* Others */}
                                <td className={`px-4 py-3 border-b border-gray-300/60 dark:border-gray-700 text-center ${shade}`}>
                                    {row.closed > 0
                                        ? <span className="font-bold text-red-500
                                       dark:text-red-400">{row.closed}</span>
                                        : <span className="text-gray-300 dark:text-gray-600">—</span>
                                    }
                                </td>
                                {/* Pre Prod */}
                                <td className={`px-4 py-3 border-b border-gray-300/60 dark:border-gray-700 text-center text-gray-600
                                dark:text-gray-300 ${shade}`}>
                                    {row.pre_production ||
                                        <span className="text-gray-300 dark:text-gray-600">—</span>}
                                </td>
                                {/* New Issues */}
                                <td className={`px-4 py-3 border-b border-gray-300/60 dark:border-gray-700 text-center ${shade}`}>
                                    {row.new_tickets > 0
                                        ? <span className="font-semibold text-sky-600
                                       dark:text-sky-400">+{row.new_tickets}</span>
                                        : <span className="text-gray-300 dark:text-gray-600">—</span>
                                    }
                                </td>
                                {/* Dev Pending */}
                                <td className={`px-4 py-3 border-b border-gray-300/60 dark:border-gray-700 text-center ${shade}`}>
                                    <span className="font-bold text-violet-600
                                   dark:text-violet-400">
                                        {row.dev_pending}
                                    </span>
                                </td>
                                {/* In Progress */}
                                <td className={`px-4 py-3 border-b border-gray-300/60 dark:border-gray-700 text-center text-gray-500
                                dark:text-gray-400 ${shade}`}>
                                    {row.in_progress ||
                                        <span className="text-gray-300 dark:text-gray-600">—</span>}
                                </td>
                                {/* Yet to Start */}
                                <td className={`px-4 py-3 border-b border-gray-300/60 dark:border-gray-700 text-center text-gray-500
                                dark:text-gray-400 ${shade}`}>
                                    {row.yet_to_start ||
                                        <span className="text-gray-300 dark:text-gray-600">—</span>}
                                </td>
                                {/* Completed */}
                                <td className={`px-4 py-3 border-b border-gray-300/60 dark:border-gray-700 text-center text-gray-500
                                dark:text-gray-400 ${shade}`}>
                                    {row.completed_dev ||
                                        <span className="text-gray-300 dark:text-gray-600">—</span>}
                                </td>
                                {/* Total Issue */}
                                <td className={`px-4 py-3 border-b border-gray-300/60 dark:border-gray-700 text-center ${shade}`}>
                                    <span className="font-bold text-orange-500
                                   dark:text-orange-400">
                                        {row.total_issue}
                                    </span>
                                </td>
                                {/* Total (merged per product) */}
                                {showProd && (
                                    <td rowSpan={row.prodCount}
                                        className="px-4 py-3 text-center align-middle
                                 bg-orange-50 dark:bg-orange-900/10
                                 border-l border-b border-orange-200
                                 dark:border-orange-900">
                                        <span className="text-xl font-black text-orange-600
                                     dark:text-orange-400">
                                            {row.product_total}
                                        </span>
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
                // const key = `${r.snapshot_date}_${r.snapshot_time}_${r.product_name}`;
                const key = `${r.snapshot_date}_${r.product_name}`;
                if (!map[key]) {
                    map[key] = { ...r };
                } else {
                    map[key].live_move += r.live_move;
                    // map[key].others += r.others;
                    map[key].closed += r.closed;
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
                // const k = `${r.snapshot_date}_${r.snapshot_time}_${r.product_name}`;
                const k = `${r.snapshot_date}_${r.product_name}`;
                prodTotals[k] = r.total_issue;
            });
            return result.map(r => ({
                ...r,
                product_total: prodTotals[
                    // `${r.snapshot_date}_${r.snapshot_time}_${r.product_name}`
                    `${r.snapshot_date}_${r.product_name}`
                ] || 0,
            }));
        })()
        : data;

    return (
        <div className="space-y-5 overflow-hidden">
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
                      border border-gray-100 dark:border-gray-700 overflow-visible">
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
                border border-gray-100 dark:border-gray-700 flex flex-col
                overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700
                  flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <FileBarChart size={18} className="text-gray-400" />
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                            {viewType === 'teamwise' ? 'Team Wise' : 'Overall'} Daily Report
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