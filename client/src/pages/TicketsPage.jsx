// ── Imports ───────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { getTickets } from '../api';
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Calendar, X, FileDown, Loader2 } from 'lucide-react';
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

// ── Tooltip component ─────────────────────────────────────────────────────────
function Tooltip({ text, children }) {
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });

    const handleMouseEnter = (e) => {
        setPos({ x: e.clientX, y: e.clientY });
        setShow(true);
    };
    const handleMouseMove = (e) => {
        setPos({ x: e.clientX, y: e.clientY });
    };

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setShow(false)}
        >
            {children}
            {show && text && (
                <div
                    style={{
                        position: 'fixed',
                        left: pos.x + 12,
                        top: pos.y + 12,
                        zIndex: 9999,
                        maxWidth: '320px',
                        pointerEvents: 'none',
                    }}
                    className="bg-gray-900 dark:bg-gray-700 text-white text-xs
                        rounded-lg px-3 py-2 shadow-xl leading-relaxed
                        border border-gray-700 dark:border-gray-600"
                >
                    {text}
                </div>
            )}
        </div>
    );
}

// ── Word Export ───────────────────────────────────────────────────────────────
async function exportToWord(tickets, orientation = 'landscape') {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, AlignmentType, WidthType, PageOrientation, ShadingType, TextRun, VerticalAlign, TableLayoutType } = await import('docx');

    const rawToday = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const groups = {};
    tickets.forEach(t => {
        const prod = t.product_name || 'Other';
        if (!groups[prod]) groups[prod] = [];
        groups[prod].push(t);
    });

    const isLandscape = orientation === 'landscape';
    const children = [];

    const createP = (text, align = AlignmentType.LEFT, bold = false, color = "000000") => {
        return new Paragraph({
            alignment: align,
            children: [new TextRun({ text, size: 24, bold, color })]
        });
    };

    const createHeaderCell = (text, align = AlignmentType.LEFT, widthPct = null) => new TableCell({
        children: [createP(text, align, true, "111827")],
        shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
        verticalAlign: VerticalAlign.CENTER,
        ...(widthPct ? { width: { size: widthPct, type: WidthType.PERCENTAGE } } : {})
    });

    const createCell = (text, align = AlignmentType.LEFT, widthPct = null) => new TableCell({
        children: [createP(text, align)],
        verticalAlign: VerticalAlign.CENTER,
        ...(widthPct ? { width: { size: widthPct, type: WidthType.PERCENTAGE } } : {})
    });

    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: "Tickets Report", size: 36, bold: true, color: "111827" })]
    }));
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 360 },
        children: [new TextRun({ text: `Report Date: ${rawToday}  |  Total Tickets: ${tickets.length}`, size: 22, color: "4B5563", italics: true })]
    }));

    Object.entries(groups).forEach(([productName, rows]) => {
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 120 },
            children: [new TextRun({ text: productName, size: 28, bold: true, color: "2563EB" })]
        }));

        const headerRow = new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: [
                createHeaderCell('S NO', AlignmentType.CENTER, 5),
                createHeaderCell('Module', AlignmentType.CENTER, 20),
                createHeaderCell('Issue Description', AlignmentType.CENTER, 45),
                createHeaderCell('Priority', AlignmentType.CENTER, 10),
                createHeaderCell('Comments/Api', AlignmentType.CENTER, 20),
            ]
        });

        const bodyRows = rows.map((t, idx) => new TableRow({
            cantSplit: true,
            children: [
                createCell(String(idx + 1), AlignmentType.CENTER, 5),
                createCell(t.module || '—', AlignmentType.LEFT, 20),
                createCell(t.issue_description || '—', AlignmentType.LEFT, 45),
                createCell(t.priority || '—', AlignmentType.CENTER, 10),
                createCell('', AlignmentType.LEFT, 20),
            ]
        }));

        const table = new Table({
            layout: TableLayoutType.FIXED,
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...bodyRows]
        });
        children.push(table);
        children.push(new Paragraph({ text: "", spacing: { after: 240 } }));
    });

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 720, right: 720, bottom: 720, left: 720 },
                    size: { orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }
                }
            },
            children: children
        }]
    });

    const buffer = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(buffer);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tickets_Report_${new Date().toISOString().split('T')[0]}.docx`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// ── Excel Export ──────────────────────────────────────────────────────────────
async function exportToExcel(tickets, applied = {}) {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tickets Report');

    const hideTeam = !!applied.team;
    const hideStatus = !!applied.status;

    // Hide gridlines and freeze top panel
    workbook.creator = 'Issue Tracker App';
    worksheet.views = [{ showGridLines: false, state: 'frozen', xSplit: 0, ySplit: 5 }];

    // Dynamically build headers and columns based on requirements
    const headers = [
        { key: 'A', header: '', width: 3 },
        { key: 'sno', header: 'S.NO', width: 6 },
        { key: 'ticket', header: 'TICKET NO', width: 14 },
        { key: 'date', header: 'DATE', width: 14 }
    ];

    if (!hideTeam) headers.push({ key: 'team', header: 'TEAM', width: 10 });

    headers.push({ key: 'module', header: 'MODULE', width: 22 });
    headers.push({ key: 'issueDesc', header: 'ISSUE DESCRIPTION', width: 60 });
    headers.push({ key: 'priority', header: 'PRIORITY', width: 12 });

    if (!hideStatus) headers.push({ key: 'status', header: 'STATUS', width: 18 });

    headers.push({ key: 'assignee', header: 'ASSIGNED TO', width: 18 });
    headers.push({ key: 'comments', header: 'COMMENTS / API', width: 25 });
    headers.push({ key: 'Z', header: '', width: 3 });

    worksheet.columns = headers.map(h => ({ key: h.key, width: h.width }));
    const totalCols = headers.length;

    const rawToday = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // ── Master Report Header ──
    const corporateBlue = 'FF0F172A'; // Slate 900

    // numeric mergeCells(topRow, leftCol, bottomRow, rightCol)
    worksheet.mergeCells(2, 2, 3, totalCols - 1);
    const titleCell = worksheet.getCell(2, 2);
    titleCell.value = "TICKETS REPORT";
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corporateBlue } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.mergeCells(4, 2, 4, totalCols - 1);
    const subtitleCell = worksheet.getCell(4, 2);
    // subtitleCell.value = `    Generated: ${rawToday}   |   Total Issues: ${tickets.length}`;
    const activeFilters = [];
    if (applied.status) activeFilters.push(`Status: ${applied.status}`);
    if (applied.team) activeFilters.push(`Team: ${applied.team}`);
    const filterBadge = activeFilters.length ? `   |   ${activeFilters.join(', ')}` : '';
    subtitleCell.value = `    Generated: ${rawToday}   |   Total Issues: ${tickets.length}${filterBadge}`;
    subtitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } }; // Slate 500
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    subtitleCell.border = { bottom: { style: 'thick', color: { argb: corporateBlue } } };

    let currentRow = 6; // Start grouping below the headers

    const groups = {};
    tickets.forEach(t => {
        const prod = t.product_name || 'Other';
        if (!groups[prod]) groups[prod] = [];
        groups[prod].push(t);
    });

    Object.entries(groups).forEach(([productName, rows]) => {
        // Group Title Ribbon
        worksheet.mergeCells(currentRow, 2, currentRow, totalCols - 1);
        const groupTitleCell = worksheet.getCell(currentRow, 2);
        groupTitleCell.value = `  ${productName.toUpperCase()}  (${rows.length} Tickets)`;
        groupTitleCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF1E293B' } }; // Slate 800
        groupTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // Slate 200
        groupTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
        currentRow++;

        // Table Headers
        const headerRow = worksheet.getRow(currentRow);
        headerRow.height = 25;
        headerRow.values = headers.map(h => h.header);

        for (let col = 2; col <= totalCols - 1; col++) {
            const cell = headerRow.getCell(col);
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF475569' } }; // Slate 600
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // Slate 50
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, top: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
        }

        // Left align specific text-heavy headers
        const descCol = headers.findIndex(h => h.key === 'issueDesc') + 1;
        const commCol = headers.findIndex(h => h.key === 'comments') + 1;
        const assigneeCol = headers.findIndex(h => h.key === 'assignee') + 1;
        headerRow.getCell(descCol).alignment = { vertical: 'middle', horizontal: 'left' };
        headerRow.getCell(commCol).alignment = { vertical: 'middle', horizontal: 'left' };
        currentRow++;

        // Data Rows
        rows.forEach((t, idx) => {
            const row = worksheet.getRow(currentRow);
            const dateStr = t.date ? new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

            const rowData = {
                'A': '',
                'sno': idx + 1,
                'ticket': t.ticket_no || '—',
                'date': dateStr,
                'module': t.module || '—',
                'issueDesc': t.issue_description || '—',
                'priority': t.priority || '—',
                'assignee': t.assigned_to || '—',
                'comments': t.comments || '',
                'Z': ''
            };
            if (!hideTeam) rowData['team'] = t.team || '—';
            if (!hideStatus) rowData['status'] = t.status_norm || '—';

            row.values = headers.map(h => rowData[h.key]);

            // Priority Colors
            let priorityColor = 'FF64748B'; // Default Slate 500
            if (t.priority === 'High') priorityColor = 'FFEF4444'; // Red 500
            else if (t.priority === 'Medium') priorityColor = 'FFF59E0B'; // Amber 500
            else if (t.priority === 'Low') priorityColor = 'FF10B981'; // Emerald 500

            // Status Colors
            let statusColor = 'FF64748B';
            if (t.status_norm === 'Fixed') statusColor = 'FF10B981';
            else if (t.status_norm === 'In-Progress (Dev)') statusColor = 'FF3B82F6';
            else if (t.status_norm === 'Completed (Dev)') statusColor = 'FF8B5CF6';
            else if (t.status_norm === 'Pre Production') statusColor = 'FF06B6D4';
            else if (t.status_norm === 'Yet to Start (Dev)') statusColor = 'FFF59E0B';

            for (let col = 2; col <= totalCols - 1; col++) {
                const cell = row.getCell(col);
                cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF334155' } }; // Slate 700
                cell.alignment = { vertical: 'top', horizontal: 'center' };
                cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }; // Slate 200
            }

            // Text heavy left blocks
            row.getCell(descCol).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
            row.getCell(commCol).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };

            // Wrap text for assigned column
            row.getCell(assigneeCol).alignment = { vertical: 'top', horizontal: 'center', wrapText: true };

            // Special Colored Styling
            if (!hideStatus) {
                const statusColIdx = headers.findIndex(h => h.key === 'status') + 1;
                const statusCell = row.getCell(statusColIdx);
                statusCell.alignment = { vertical: 'top', horizontal: 'center' };
                statusCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: statusColor } };
            }

            const priorityColIdx = headers.findIndex(h => h.key === 'priority') + 1;
            const priorityCell = row.getCell(priorityColIdx);
            priorityCell.alignment = { vertical: 'top', horizontal: 'center' };
            priorityCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: priorityColor } };

            currentRow++;
        });

        // Extra spacing between groups
        currentRow += 2;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tickets_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function TicketsPage() {
    const location = useLocation();
    console.log(location.pathname + location.search);

    const navigate = useNavigate();
    const [selectedTicket, setSelectedTicket] = useState(null);

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

    const [exporting, setExporting] = useState(false);
    const [exportModal, setExportModal] = useState(false);
    const [exportConfig, setExportConfig] = useState({ format: 'excel', orientation: 'landscape' });

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

    // ── Export Logic ────────────────────────────────────────────────────────────
    const executeExport = async () => {
        setExporting(true);
        try {
            // Fetch ALL matching records (no pagination) for Export
            const params = { export: 'true' };
            if (applied.search) params.search = applied.search;
            if (applied.team) params.team = applied.team;
            if (applied.product) params.product = applied.product;
            if (applied.status) params.status = applied.status;
            if (applied.priority) params.priority = applied.priority;
            if (applied.missing) params.missing = applied.missing;
            if (applied.date_from) params.date_from = applied.date_from;
            if (applied.date_to) params.date_to = applied.date_to;

            const res = await getTickets(params);

            if (exportConfig.format === 'word') {
                await exportToWord(res.data.tickets, exportConfig.orientation);
            } else {
                await exportToExcel(res.data.tickets, applied);
            }
            setExportModal(false);
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setExporting(false);
        }
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
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Tickets
                    </h1>
                    <p className="text-sm text-gray-400">{total} total tickets</p>
                </div>

                <button
                    onClick={() => setExportModal(true)}
                    disabled={exporting || total === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600
                        hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                        text-white text-sm font-medium rounded-lg transition-colors">
                    <FileDown size={15} /> Export Report
                </button>
            </div>

            {/* ── Export Modal ── */}
            {exportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full overflow-hidden border border-gray-100 dark:border-gray-700">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Export Options</h2>
                            <button onClick={() => setExportModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Format</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setExportConfig({ ...exportConfig, format: 'excel' })} className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${exportConfig.format === 'excel' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300'}`}>Excel (XLSX)</button>
                                    <button onClick={() => setExportConfig({ ...exportConfig, format: 'word' })} className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${exportConfig.format === 'word' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300'}`}>Word (DOCX)</button>
                                </div>
                            </div>
                            {exportConfig.format === 'word' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Orientation</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => setExportConfig({ ...exportConfig, orientation: 'landscape' })} className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${exportConfig.orientation === 'landscape' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300'}`}>Landscape</button>
                                        <button onClick={() => setExportConfig({ ...exportConfig, orientation: 'portrait' })} className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${exportConfig.orientation === 'portrait' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300'}`}>Portrait</button>
                                    </div>
                                </div>
                            )}
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                    The downloaded report will automatically group the tickets by application/product name.
                                </p>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700">
                            <button onClick={() => setExportModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 font-medium hover:text-gray-900 dark:hover:text-white transition-colors">Cancel</button>
                            <button onClick={executeExport} disabled={exporting} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors">
                                {exporting ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : 'Confirm Export'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                    'Module', 'Description', 'Priority', 'Status', 'Assigned To', ''].map((h) => (
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
                                        {/* {t.company} */}
                                        <Tooltip text={t.company}>
                                            <p className="truncate">{t.company}</p>
                                        </Tooltip>
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
                                        {/* {t.module} */}
                                        <Tooltip text={t.module}>
                                            <p className="truncate">{t.module}</p>
                                        </Tooltip>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[260px]">
                                        <Tooltip text={t.issue_description}>
                                            <p className="truncate">{t.issue_description}</p>
                                        </Tooltip>
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
