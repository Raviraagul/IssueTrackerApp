// export default function DashboardPage() {
//     return <div className="text-gray-900 dark:text-white text-xl font-bold">Dashboard — Coming Soon</div>;
// }

import { useState, useEffect } from 'react';
import { getTicketsSummary, getImportLogs } from '../api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, PieChart, Pie, Cell,
    ResponsiveContainer
} from 'recharts';
import {
    Ticket, AlertCircle, Clock, CheckCircle,
    TrendingUp, RefreshCw, Upload
} from 'lucide-react';

// ── Colours per status ────────────────────────────────────────────────────────
const STATUS_COLORS = {
    'Yet to Start (Dev)': '#f59e0b',
    'In-Progress (Dev)': '#3b82f6',
    'Completed (Dev)': '#8b5cf6',
    'Pre Production': '#06b6d4',
    'Fixed': '#10b981',
    'Closed': '#6b7280',
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

// ── Small reusable card ───────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, sub }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm
                    border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {label}
                </span>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon size={18} className="text-white" />
                </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const [summary, setSummary] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [sumRes, logRes] = await Promise.all([
                getTicketsSummary(),
                getImportLogs(),
            ]);
            setSummary(sumRes.data);
            setLogs(logRes.data.slice(0, 5));
            setLastRefresh(new Date());
        } catch (err) {
            setError('Failed to load dashboard data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ── Build chart data ────────────────────────────────────────────────────────
    const teamChartData = () => {
        if (!summary?.byTeam) return [];
        const teams = ['API', 'Web', 'App'];
        return teams.map((team) => {
            const row = { team };
            summary.byTeam
                .filter((r) => r.team === team)
                .forEach((r) => { row[r.status_norm] = parseInt(r.count); });
            return row;
        });
    };

    const productChartData = () => {
        if (!summary?.byProduct) return [];
        const map = {};
        summary.byProduct.forEach((r) => {
            if (!map[r.product_name]) map[r.product_name] = 0;
            map[r.product_name] += parseInt(r.count);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    };

    const priorityChartData = () => {
        if (!summary?.byPriority) return [];
        return summary.byPriority.map((r) => ({
            name: r.priority || 'Unknown',
            value: parseInt(r.count),
        }));
    };

    // ── Loading ─────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent
                      rounded-full animate-spin" />
        </div>
    );

    if (error) return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200
                    dark:border-red-800 rounded-xl p-6 text-red-600
                    dark:text-red-400">
            {error}
        </div>
    );

    const kpi = summary?.kpi || {};

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Dashboard
                    </h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Last updated: {lastRefresh.toLocaleTimeString()}
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600
                     hover:bg-blue-700 text-white text-sm font-medium
                     rounded-lg transition-colors"
                >
                    <RefreshCw size={15} />
                    Refresh
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Total Tickets"
                    value={kpi.total || 0}
                    icon={Ticket}
                    color="bg-blue-500"
                />
                <KpiCard
                    label="Yet to Start"
                    value={kpi.yet_to_start || 0}
                    icon={Clock}
                    color="bg-amber-500"
                    sub="Pending dev"
                />
                <KpiCard
                    label="In Progress"
                    value={kpi.in_progress || 0}
                    icon={AlertCircle}
                    color="bg-blue-400"
                    sub="Active development"
                />
                <KpiCard
                    label="Pre Production"
                    value={kpi.pre_production || 0}
                    icon={TrendingUp}
                    color="bg-cyan-500"
                    sub="In staging"
                />
                <KpiCard
                    label="Completed Dev"
                    value={kpi.completed_dev || 0}
                    icon={CheckCircle}
                    color="bg-purple-500"
                    sub="Dev done"
                />
                <KpiCard
                    label="Fixed (Live)"
                    value={kpi.fixed || 0}
                    icon={CheckCircle}
                    color="bg-green-500"
                    sub="Moved to live"
                />
                <KpiCard
                    label="Closed"
                    value={kpi.closed || 0}
                    icon={CheckCircle}
                    color="bg-gray-500"
                    sub="Invalid / Enhancement"
                />
                <KpiCard
                    label="Total Imports"
                    value={logs.length > 0 ? logs[0]?.new_tickets || 0 : 0}
                    icon={Upload}
                    color="bg-indigo-500"
                    sub="Last import new tickets"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Team Bar Chart Stacked */}
                {/* <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5
                        shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                        Issues by Team
                    </h2>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={teamChartData()} barSize={18}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="team" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            {Object.entries(STATUS_COLORS).map(([status, color]) => (
                                <Bar key={status} dataKey={status} fill={color}
                                    stackId="a" radius={[2, 2, 0, 0]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div> */}

                {/* Team Bar Chart Grouped */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5
                        shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                        Issues by Team
                    </h2>

                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                            data={teamChartData()}
                            barSize={22} // 18
                            barGap={6} // 4
                            barCategoryGap="25%"
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                            <XAxis dataKey="team" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />

                            {/* <Tooltip /> */}
                            <Tooltip
                                shared={false}
                                contentStyle={{
                                    background: "transparent",
                                    border: "none",
                                    boxShadow: "none",
                                    padding: 0
                                }}
                                itemStyle={{ fontWeight: 500 }}
                            /> {/* cursor={{ fill: "transparent" }} */}
                            <Legend wrapperStyle={{ fontSize: 11 }} />

                            {Object.entries(STATUS_COLORS).map(([status, color]) => (
                                <Bar
                                    key={status}
                                    dataKey={status}
                                    fill={color}
                                    radius={[4, 4, 0, 0]}
                                />
                            ))}

                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Product Pie Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm
                        border border-gray-100 dark:border-gray-700">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                        Issues by Product
                    </h2>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie
                                data={productChartData()}
                                cx="50%" cy="50%"
                                innerRadius={50} outerRadius={80}
                                paddingAngle={3} dataKey="value"
                                label={({ name, percent }) =>
                                    `${name} ${(percent * 100).toFixed(0)}%`
                                }
                                labelLine={false}
                            >
                                {productChartData().map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div className="mt-2 space-y-1">
                        {productChartData().map((item, i) => (
                            <div key={item.name} className="flex items-center justify-between
                                              text-xs text-gray-600 dark:text-gray-300">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full"
                                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                    {item.name}
                                </div>
                                <span className="font-medium">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Priority + Recent Imports Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Priority Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm
                        border border-gray-100 dark:border-gray-700">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                        Issues by Priority
                    </h2>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={priorityChartData()} layout="vertical" barSize={16}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Recent Imports */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm
                        border border-gray-100 dark:border-gray-700">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                        Recent Imports
                    </h2>
                    {logs.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <Upload size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No imports yet</p>
                            <p className="text-xs mt-1">Go to Import page to upload your Excel</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map((log) => (
                                <div key={log.id}
                                    className="flex items-center justify-between p-3 rounded-lg
                                bg-gray-50 dark:bg-gray-700">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900
                                  dark:text-white truncate max-w-[180px]">
                                            {log.filename}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(log.imported_at).toLocaleString()} —{' '}
                                            {log.imported_by_name}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-medium text-green-600
                                     dark:text-green-400">
                                            +{log.new_tickets} new
                                        </span>
                                        {log.updated_tickets > 0 && (
                                            <p className="text-xs text-blue-500">
                                                {log.updated_tickets} updated
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}