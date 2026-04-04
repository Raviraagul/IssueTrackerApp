import { useState, useEffect } from 'react';
import { getTicketsSummary, getImportLogs, getTrendReport } from '../api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, PieChart, Pie, Cell,
    ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
    Ticket, AlertCircle, Clock, CheckCircle,
    TrendingUp, RefreshCw, Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Select from '../components/Select';

// ── Colours ───────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
    'Yet to Start (Dev)': '#f59e0b',
    'In-Progress (Dev)': '#3b82f6',
    'Completed (Dev)': '#8b5cf6',
    'Pre Production': '#06b6d4',
    'Fixed': '#10b981',
    'Closed': '#6b7280',
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const TREND_COLORS = {
    new_tickets: '#3b82f6',
    live_move: '#10b981',
    closed: '#6b7280',
    total_active: '#f59e0b',
    yet_to_start: '#ef4444',
};

const TREND_LABELS = {
    new_tickets: 'New Tickets',
    live_move: 'Live Move',
    closed: 'Closed',
    total_active: 'Total Active',
    yet_to_start: 'Yet to Start',
};

const PRODUCT_OPTIONS = [
    { value: '', label: 'All Products' },
    { value: 'Salesmatic', label: 'Salesmatic' },
    { value: 'Distomatic', label: 'Distomatic' },
];

const TEAM_OPTIONS = [
    { value: '', label: 'All Teams' },
    { value: 'API', label: 'API' },
    { value: 'Web', label: 'Web' },
    { value: 'App', label: 'App' },
];

const PRODUCT_LINE_COLORS = {
    Salesmatic: { new_tickets: '#3b82f6', total_active: '#f59e0b', live_move: '#10b981' },
    Distomatic: { new_tickets: '#8b5cf6', total_active: '#ef4444', live_move: '#06b6d4' },
};

// Range presets
const RANGE_TABS = [
    { key: '1W', label: '1W' },
    { key: '1M', label: '1M' },
    { key: '3M', label: '3M' },
    { key: '6M', label: '6M' },
    { key: '1Y', label: '1Y' },
];

// ── KPI Card ──────────────────────────────────────────────────────────────────
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

// ── Custom Tooltip (works for Bar, Pie, and Area/Line charts) ─────────────────
// Recharts passes these props automatically:
// active  → true when hovering
// payload → array of data points being hovered
// label   → x-axis label (for bar/line) or undefined (for pie)
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;

    // Detect chart type by inspecting payload structure:
    // Pie  → payload[0].name exists and no label
    // Bar  → label exists, payload has fill property
    // Area → label exists, payload has stroke property
    const isPie = !label && payload[0]?.name;
    const isArea = label && payload[0]?.stroke;

    return (
        <div style={{ position: 'relative' }}
            className="bg-gray-900 dark:bg-gray-800 text-white rounded-lg
                px-3 py-2.5 shadow-xl text-xs border border-gray-700
                dark:border-gray-600 min-w-[150px]">

            {/* Header — period for area, team for bar, product for pie */}
            {(label || isPie) && (
                <p className="font-semibold text-gray-200 mb-2 pb-1.5
                    border-b border-gray-700">
                    {isPie ? payload[0].name : label}
                </p>
            )}

            {/* Rows — one per metric */}
            {payload.map((entry, i) => {
                // Skip zero values to keep tooltip clean
                if (entry.value === 0 || entry.value === null) return null;

                // Color dot — use fill for bar/pie, stroke for area lines
                const color = entry.stroke || entry.fill ||
                    entry.payload?.fill || '#6b7280';

                // Label — use TREND_LABELS map for area chart keys,
                // otherwise use entry.name directly
                const entryLabel = TREND_LABELS[entry.dataKey]
                    || entry.name
                    || entry.dataKey;

                return (
                    <div key={i} className="flex items-center
                        justify-between gap-4 py-0.5">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm shrink-0"
                                style={{ background: color }} />
                            <span className="text-gray-300">{entryLabel}</span>
                        </div>
                        <span className="font-semibold text-white">
                            {entry.value}
                        </span>
                    </div>
                );
            })}

            {/* Arrow pointer at bottom */}
            {/* <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2
                w-3 h-3 bg-gray-900 dark:bg-gray-800 rotate-45
                border-r border-b border-gray-700 dark:border-gray-600" /> */}
        </div>
    );
}

// ── Monthly Trend Chart ───────────────────────────────────────────────────────
function MonthlyTrendChart({ teamScope }) {
    const [trendData, setTrendData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('combined');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [selectedTeam, setSelectedTeam] = useState('');
    const [range, setRange] = useState('3M');

    // ── Theme sync ────────────────────────────────────────────────────────────
    const [isDark, setIsDark] = useState(
        document.documentElement.classList.contains('dark')
    );
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });
        return () => observer.disconnect();
    }, []);

    // ── Theme-aware colors ────────────────────────────────────────────────────
    const gridColor = isDark ? '#374151' : '#e5e7eb';
    const tickColor = isDark ? '#9ca3af' : '#6b7280';
    const tooltipBg = isDark ? '#1f2937' : '#ffffff';
    const tooltipBorder = isDark ? '#374151' : '#e5e7eb';
    const tooltipText = isDark ? '#f9fafb' : '#111827';

    const fetchTrend = async () => {
        setLoading(true);
        try {
            const params = { range };
            if (selectedProduct) params.product = selectedProduct;
            if (selectedTeam) params.team = selectedTeam;
            const res = await getTrendReport(params);
            setTrendData(res.data);
            console.log("Trend Data", res.data);
        } catch { }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTrend(); }, [selectedProduct, selectedTeam, range]);

    // ── Build chart data ──────────────────────────────────────────────────────
    const buildChartData = () => {
        if (!trendData.length) return viewMode === 'combined' ? [] : { data: [], products: [] };

        if (viewMode === 'combined') {
            const periodMap = {};
            trendData.forEach(r => {
                if (!periodMap[r.period]) {
                    periodMap[r.period] = {
                        period: r.period,
                        new_tickets: 0, live_move: 0,
                        closed: 0, total_active: 0, yet_to_start: 0,
                    };
                }
                periodMap[r.period].new_tickets += parseInt(r.new_tickets) || 0;
                periodMap[r.period].live_move += parseInt(r.live_move) || 0;
                periodMap[r.period].closed += parseInt(r.closed) || 0;
                periodMap[r.period].total_active += parseInt(r.total_active) || 0;
                periodMap[r.period].yet_to_start += parseInt(r.yet_to_start) || 0;
            });
            return Object.values(periodMap);
        } else {
            const periodMap = {};
            const products = [...new Set(trendData.map(r => r.product_name))];
            trendData.forEach(r => {
                if (!periodMap[r.period]) {
                    periodMap[r.period] = { period: r.period };
                    products.forEach(p => {
                        periodMap[r.period][`${p}_new_tickets`] = 0;
                        periodMap[r.period][`${p}_total_active`] = 0;
                        periodMap[r.period][`${p}_live_move`] = 0;
                    });
                }
                periodMap[r.period][`${r.product_name}_new_tickets`] = parseInt(r.new_tickets) || 0;
                periodMap[r.period][`${r.product_name}_total_active`] = parseInt(r.total_active) || 0;
                periodMap[r.period][`${r.product_name}_live_move`] = parseInt(r.live_move) || 0;
            });
            return { data: Object.values(periodMap), products };
        }
    };

    const chartResult = buildChartData();
    const chartData = viewMode === 'combined' ? chartResult : (chartResult.data || []);
    const products = viewMode === 'per_product' ? (chartResult.products || []) : [];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm
                border border-gray-100 dark:border-gray-700">

            {/* Header row 1 — title + range tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    Trend
                </h2>

                {/* Range preset tabs */}
                <div className="flex rounded-lg border border-gray-200
                    dark:border-gray-600 overflow-hidden">
                    {RANGE_TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setRange(tab.key)}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors
                                ${range === tab.key
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Header row 2 — filters + combined/per product */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* Team filter — only for users who can see all teams */}
                {!teamScope && (
                    <div className="w-32">
                        <Select
                            value={selectedTeam}
                            onChange={v => setSelectedTeam(v || '')}
                            options={TEAM_OPTIONS}
                            placeholder="All Teams"
                        />
                    </div>
                )}
                {/* Product filter */}
                <div className="w-36">
                    <Select
                        value={selectedProduct}
                        onChange={v => setSelectedProduct(v || '')}
                        options={PRODUCT_OPTIONS}
                        placeholder="All Products"
                    />
                </div>
                {/* Combined / Per Product toggle */}
                <div className="flex rounded-lg border border-gray-200
                        dark:border-gray-600 overflow-hidden">
                    <button
                        onClick={() => setViewMode('combined')}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors
                                ${viewMode === 'combined'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}>
                        Combined
                    </button>
                    <button
                        onClick={() => setViewMode('per_product')}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors
                                ${viewMode === 'per_product'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}>
                        Per Product
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent
                        rounded-full animate-spin" />
                </div>
            ) : chartData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                    No data available for this range
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <defs>
                            {Object.entries(TREND_COLORS).map(([key, color]) => (
                                <linearGradient key={key} id={`grad_${key}`}
                                    x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color}
                                        stopOpacity={isDark ? 0.4 : 0.25} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                                </linearGradient>
                            ))}
                            {Object.entries(PRODUCT_LINE_COLORS).flatMap(([p, cols]) =>
                                Object.entries(cols).map(([key, color]) => (
                                    <linearGradient key={`${p}_${key}`}
                                        id={`grad_${p}_${key}`}
                                        x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={color}
                                            stopOpacity={isDark ? 0.4 : 0.25} />
                                        <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                                    </linearGradient>
                                ))
                            )}
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis
                            dataKey="period"
                            tick={{ fontSize: 11, fill: tickColor }}
                            axisLine={{ stroke: gridColor }}
                            tickLine={{ stroke: gridColor }}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: tickColor }}
                            axisLine={{ stroke: gridColor }}
                            tickLine={{ stroke: gridColor }}
                        />
                        {/* <Tooltip
                            contentStyle={{
                                background: tooltipBg,
                                border: `1px solid ${tooltipBorder}`,
                                borderRadius: '8px',
                                fontSize: 12,
                                color: tooltipText,
                            }}
                            itemStyle={{ color: tooltipText }}
                            labelStyle={{ color: tooltipText, fontWeight: 500 }}
                        /> */}
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, color: tickColor }} />

                        {viewMode === 'combined'
                            ? Object.entries(TREND_COLORS).map(([key, color]) => (
                                <Area
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    name={TREND_LABELS[key]}
                                    stroke={color}
                                    fill={color}
                                    fillOpacity={isDark ? 0.15 : 0.1}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 5 }}
                                />
                            ))
                            : products.flatMap(p => [
                                <Area key={`${p}_new_tickets`}
                                    type="monotone"
                                    dataKey={`${p}_new_tickets`}
                                    name={`${p} New`}
                                    stroke={PRODUCT_LINE_COLORS[p]?.new_tickets || '#3b82f6'}
                                    fill={PRODUCT_LINE_COLORS[p]?.new_tickets || '#3b82f6'}
                                    fillOpacity={isDark ? 0.15 : 0.1}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 5 }}
                                />,
                                <Area key={`${p}_total_active`}
                                    type="monotone"
                                    dataKey={`${p}_total_active`}
                                    name={`${p} Active`}
                                    stroke={PRODUCT_LINE_COLORS[p]?.total_active || '#f59e0b'}
                                    fill={PRODUCT_LINE_COLORS[p]?.total_active || '#f59e0b'}
                                    fillOpacity={isDark ? 0.15 : 0.1}
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    activeDot={{ r: 5 }}
                                />,
                                <Area key={`${p}_live_move`}
                                    type="monotone"
                                    dataKey={`${p}_live_move`}
                                    name={`${p} Live`}
                                    stroke={PRODUCT_LINE_COLORS[p]?.live_move || '#10b981'}
                                    fill={PRODUCT_LINE_COLORS[p]?.live_move || '#10b981'}
                                    fillOpacity={isDark ? 0.15 : 0.1}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 5 }}
                                />,
                            ])
                        }
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const { user, isAdmin } = useAuth();
    const [summary, setSummary] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastRefresh, setLastRefresh] = useState(new Date());

    // Team scope — null means can see all teams
    const teamScope = (user?.team && user.team !== 'Support') ? user.team : null;

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [sumRes, logRes] = await Promise.all([
                getTicketsSummary(),
                isAdmin ? getImportLogs() : Promise.resolve({ data: [] }),
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

    // ── Chart data builders ───────────────────────────────────────────────────
    const teamChartData = () => {
        if (!summary?.byTeam) return [];
        const teams = ['API', 'Web', 'App'];
        return teams.map((team) => {
            const row = { team };
            summary.byTeam
                .filter(r => r.team === team)
                .forEach(r => { row[r.status_norm] = parseInt(r.count); });
            return row;
        });
    };

    /* const productChartData = () => {
        if (!summary?.byProduct) return [];
        const map = {};
        summary.byProduct.forEach(r => {
            if (!map[r.product_name]) map[r.product_name] = 0;
            map[r.product_name] += parseInt(r.count);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }; */
    const productChartData = () => {
        if (!summary?.byProduct) return [];
        const map = {};
        summary.byProduct.forEach((r) => {
            if (!map[r.product_name]) map[r.product_name] = 0;
            map[r.product_name] += parseInt(r.count);
        });
        const entries = Object.entries(map).map(([name, value]) => ({ name, value }));
        return entries.map((e, i) => ({
            ...e,
            fill: PIE_COLORS[i % PIE_COLORS.length]
        }));
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent
                      rounded-full animate-spin" />
        </div>
    );

    if (error) return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200
                    dark:border-red-800 rounded-xl p-6 text-red-600 dark:text-red-400">
            {error}
        </div>
    );

    const kpi = summary?.kpi || {};

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Last updated: {lastRefresh.toLocaleTimeString()}
                    </p>
                </div>
                <button onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600
                     hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                    <RefreshCw size={15} />
                    Refresh
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Total Tickets" value={kpi.total || 0}
                    icon={Ticket} color="bg-blue-500" />
                <KpiCard label="Yet to Start" value={kpi.yet_to_start || 0}
                    icon={Clock} color="bg-amber-500" sub="Pending dev" />
                <KpiCard label="In Progress" value={kpi.in_progress || 0}
                    icon={AlertCircle} color="bg-blue-400" sub="Active development" />
                <KpiCard label="Pre Production" value={kpi.pre_production || 0}
                    icon={TrendingUp} color="bg-cyan-500" sub="In staging" />
                <KpiCard label="Completed Dev" value={kpi.completed_dev || 0}
                    icon={CheckCircle} color="bg-purple-500" sub="Dev done" />
                <KpiCard label="Fixed (Live)" value={kpi.fixed || 0}
                    icon={CheckCircle} color="bg-green-500" sub="Moved to live" />
                <KpiCard label="Closed" value={kpi.closed || 0}
                    icon={CheckCircle} color="bg-gray-500" sub="Invalid / Enhancement" />
                <KpiCard
                    label="Last Import"
                    value={isAdmin && logs.length > 0 ? `+${logs[0]?.new_tickets || 0}` : '—'}
                    icon={Upload} color="bg-indigo-500"
                    sub={isAdmin ? 'New tickets last import' : 'Admin only'}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Team Bar Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5
                        shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                        Issues by Team
                    </h2>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={teamChartData()} barSize={22} barGap={6} barCategoryGap="25%">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="team" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            {/* <Tooltip shared={false}
                                contentStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
                                itemStyle={{ fontWeight: 500 }} /> */}
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            {Object.entries(STATUS_COLORS).map(([status, color]) => (
                                <Bar key={status} dataKey={status} fill={color} radius={[4, 4, 0, 0]} />
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
                            <Pie data={productChartData()} cx="50%" cy="50%"
                                innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}>
                                {productChartData().map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            {/* <Tooltip /> */}
                            <Tooltip content={<CustomTooltip />} />
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

            {/* Trend + Recent Imports Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                    <MonthlyTrendChart teamScope={teamScope} />
                </div>

                {/* Recent Imports — admin only */}
                {isAdmin ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm
                            border border-gray-100 dark:border-gray-700">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                            Recent Imports
                        </h2>
                        {logs.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <Upload size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No imports yet</p>
                                <p className="text-xs mt-1">Go to Import page to upload</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {logs.map(log => (
                                    <div key={log.id} className="flex items-center justify-between
                                        p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900
                                    dark:text-white truncate max-w-[180px]">
                                                {log.filename}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(log.imported_at).toLocaleString()} — {log.imported_by_name}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-medium text-green-600 dark:text-green-400">
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
                ) : (
                    <div className="hidden lg:block" />
                )}
            </div>
        </div>
    );
}
