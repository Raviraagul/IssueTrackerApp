import { useState, useEffect } from 'react';
import { getTickets } from '../api';
import {
    Search, Filter, ChevronLeft, ChevronRight,
    Eye, Calendar, X, FileDown, Loader2
} from 'lucide-react';
import Select from '../components/Select';
import DateInput from '../components/DateInput';
import { useNavigate, useSearchParams } from 'react-router-dom';

// ── Color maps ────────────────────────────────────────────────────────────────
const PRIORITY_COLORS = {
    'High': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Medium': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Low': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function Badge({ text, colorMap, fallback = 'bg-gray-100 text-gray-600' }) {
    const cls = colorMap?.[text] || fallback;
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
            {text || '—'}
        </span>
    );
}

const fmt = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
};

const fmtLabel = (from, to) => {
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
    return (
        <div
            className="relative"
            onMouseEnter={e => { setPos({ x: e.clientX, y: e.clientY }); setShow(true); }}
            onMouseMove={e => setPos({ x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setShow(false)}
        >
            {children}
            {show && text && (
                <div style={{
                    position: 'fixed', left: pos.x + 12, top: pos.y + 12,
                    zIndex: 9999, maxWidth: '320px', pointerEvents: 'none',
                }}
                    className="bg-gray-900 dark:bg-gray-700 text-white text-xs
                        rounded-lg px-3 py-2 shadow-xl leading-relaxed
                        border border-gray-700 dark:border-gray-600">
                    {text}
                </div>
            )}
        </div>
    );
}

// ── PDF Export ────────────────────────────────────────────────────────────────
async function exportToWord(tickets, orientation = 'landscape') {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, AlignmentType, WidthType, PageOrientation, ShadingType, TextRun, VerticalAlign } = await import('docx');

    const rawToday = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const groups = {};
    tickets.forEach(t => {
        if (!groups[t.product_name]) groups[t.product_name] = [];
        groups[t.product_name].push(t);
    });

    const isLandscape = orientation === 'landscape';
    const children = [];

    // Helper for structured text sizing (size is half-points, 24 = 12pt)
    const createP = (text, align = AlignmentType.LEFT, bold = false, color = "000000") => {
        return new Paragraph({
            alignment: align,
            children: [new TextRun({ text, size: 24, bold, color })]
        });
    };

    // Helpers for cleaner cell creation
    const createHeaderCell = (text, align = AlignmentType.LEFT, widthPct = null) => new TableCell({
        children: [createP(text, align, true, "111827")], // Dark text
        shading: { fill: 'F3F4F6', type: ShadingType.CLEAR }, // Professional light gray background
        verticalAlign: VerticalAlign.CENTER,
        ...(widthPct ? { width: { size: widthPct, type: WidthType.PERCENTAGE } } : {})
    });

    const createCell = (text, align = AlignmentType.LEFT, widthPct = null) => new TableCell({
        children: [createP(text, align)],
        verticalAlign: VerticalAlign.CENTER,
        ...(widthPct ? { width: { size: widthPct, type: WidthType.PERCENTAGE } } : {})
    });

    // Master Document Header
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: "Production Moved Issues", size: 36, bold: true, color: "111827" })]
    }));
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 360 },
        children: [new TextRun({ text: `Report Date: ${rawToday}  |  Total Tickets: ${tickets.length}`, size: 22, color: "4B5563", italics: true })]
    }));

    Object.entries(groups).forEach(([productName, rows]) => {
        // Sub-title for each application
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 120 },
            children: [new TextRun({ text: productName, size: 28, bold: true, color: "2563EB" })] // Blue title
        }));

        const headerRow = new TableRow({
            tableHeader: true,
            cantSplit: true, // Prevents splitting header across pages
            children: [
                createHeaderCell('S NO', AlignmentType.CENTER, 5),
                createHeaderCell('Ticket No', AlignmentType.CENTER, 12),
                createHeaderCell('Module', AlignmentType.CENTER, 15),
                createHeaderCell(`Issue Description`, AlignmentType.CENTER, 46),
                createHeaderCell('Priority', AlignmentType.CENTER, 8),
                createHeaderCell('Moved Date', AlignmentType.CENTER, 14),
            ]
        });

        const bodyRows = rows.map((t, idx) => new TableRow({
            cantSplit: true, // Prevents splitting huge descriptions across pages
            children: [
                createCell(String(idx + 1), AlignmentType.CENTER, 5),
                createCell(t.ticket_no || '—', AlignmentType.CENTER, 12),
                createCell(t.module || '—', AlignmentType.LEFT, 15),
                createCell(t.issue_description || '—', AlignmentType.LEFT, 46),
                createCell(t.priority || '—', AlignmentType.CENTER, 8),
                createCell(fmt(t.fixed_date), AlignmentType.CENTER, 14),
            ]
        }));

        const table = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] });
        children.push(table);
        children.push(new Paragraph({ text: "", spacing: { after: 240 } })); // Visual gap between tables
    });

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 720, right: 720, bottom: 720, left: 720 }, // Narrow Margins (0.5 inch)
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
    a.download = `Live_Moved_Issues_${new Date().toISOString().split('T')[0]}.docx`;
    a.click();
    window.URL.revokeObjectURL(url);
}

async function exportToPDF(tickets, orientation = 'landscape', action = 'view') {
    // Dynamically import jsPDF so it doesn't bloat the initial bundle
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: orientation, unit: 'mm', format: 'a4' });
    const today = new Date().toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });

    // ── Group tickets by product_name ─────────────────────────────────────────
    const groups = {};
    tickets.forEach(t => {
        if (!groups[t.product_name]) groups[t.product_name] = [];
        groups[t.product_name].push(t);
    });

    let isFirstPage = true;

    // ── Master Report Header ──────────────────────────────────────────────
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(`Production Moved Issues`, pageWidth / 2, 12, { align: 'center' }); // Tighter top margin

    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(107, 114, 128);
    doc.text(`Report Date: ${today}  |  Total: ${tickets.length} tickets`, pageWidth / 2, 18, { align: 'center' });

    let currentY = 26; // Start Y for the first table

    Object.entries(groups).forEach(([productName, rows]) => {

        // If we are getting too close to the bottom of the page, forcefully add a break
        if (currentY > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage();
            currentY = 15;
        }

        // Subtitle
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(37, 99, 235); // Blue title
        // doc.text(productName, 10, currentY);
        doc.text(productName, pageWidth / 2, currentY, { align: 'center' });
        currentY += 4;

        // Table
        autoTable(doc, {
            startY: currentY,
            rowPageBreak: 'avoid', // Prevents slicing rows across pages!
            head: [[
                'S NO',
                'Ticket No',
                'Module',
                `Issue Description`,
                'Priority',
                'Moved Date',
            ]],
            body: rows.map((t, idx) => [
                idx + 1,
                t.ticket_no || '—',
                t.module || '—',
                t.issue_description || '—',
                t.priority || '—',
                fmt(t.fixed_date),
            ]),
            styles: {
                fontSize: 8,
                cellPadding: 3,
                overflow: 'linebreak',
                valign: 'middle',
            },
            headStyles: {
                fillColor: [243, 244, 246],
                textColor: [17, 24, 39],
                lineColor: [229, 231, 235],
                lineWidth: 0.1,
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'center',
            },
            alternateRowStyles: {
                fillColor: [245, 247, 250],
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 24, halign: 'center' },
                2: { cellWidth: 35 },
                3: { cellWidth: 'auto' },
                4: { cellWidth: 20, halign: 'center' },
                5: { cellWidth: 26, halign: 'center' },
            },
            margin: { left: 10, right: 10, top: 15 }, // Narrow margins!
        });

        // Update currentY for the next table
        currentY = doc.lastAutoTable.finalY + 12;
    });

    // Save file
    // const fileName = `Live_Moved_Issues_${new Date().toISOString().split('T')[0]}.pdf`;
    // doc.save(fileName);

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);

    if (action === 'download') {
        const fileName = `Live_Moved_Issues_${new Date().toISOString().split('T')[0]}.pdf`;
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
    } else {
        // Create a temporary link to open in new tab with the correct filename
        window.open(url, '_blank');
    }
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LiveMovedTicketsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // ── Applied filters from URL ──────────────────────────────────────────────
    const applied = {
        product: searchParams.get('product') || '',
        team: searchParams.get('team') || '',
        date_from: searchParams.get('date_from') || '',
        date_to: searchParams.get('date_to') || '',
        fixed_date_from: searchParams.get('fixed_date_from') || '',
        fixed_date_to: searchParams.get('fixed_date_to') || '',
    };
    const page = parseInt(searchParams.get('page') || '1');

    // ── Draft filters (local — not yet applied) ───────────────────────────────
    const [draft, setDraft] = useState({
        product: applied.product,
        team: applied.team,
        date_from: applied.date_from,
        date_to: applied.date_to,
        fixed_date_from: applied.fixed_date_from,
        fixed_date_to: applied.fixed_date_to,
    });

    // Sync draft when URL changes (back button support)
    useEffect(() => {
        setDraft({
            product: searchParams.get('product') || '',
            team: searchParams.get('team') || '',
            date_from: searchParams.get('date_from') || '',
            date_to: searchParams.get('date_to') || '',
            fixed_date_from: searchParams.get('fixed_date_from') || '',
            fixed_date_to: searchParams.get('fixed_date_to') || '',
        });
    }, [searchParams]);

    // ── Date panels ───────────────────────────────────────────────────────────
    const [createdOpen, setCreatedOpen] = useState(false);
    const [fixedOpen, setFixedOpen] = useState(false);

    // ── Server data ───────────────────────────────────────────────────────────
    const [tickets, setTickets] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [exportModal, setExportModal] = useState(false);
    const [exportConfig, setExportConfig] = useState({ format: 'pdf', orientation: 'landscape', action: 'view' });

    // ── Fetch tickets — always filter status_norm = 'Fixed' ──────────────────
    const fetchTickets = async () => {
        setLoading(true);
        try {
            const params = { page, limit: 20, status: 'Fixed' };
            if (applied.product) params.product = applied.product;
            if (applied.team) params.team = applied.team;
            if (applied.date_from) params.date_from = applied.date_from;
            if (applied.date_to) params.date_to = applied.date_to;
            if (applied.fixed_date_from) params.fixed_date_from = applied.fixed_date_from;
            if (applied.fixed_date_to) params.fixed_date_to = applied.fixed_date_to;

            const res = await getTickets(params);
            setTickets(res.data.tickets);
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
        } catch { }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTickets(); }, [searchParams]);

    // ── Helper: clean current URL params ─────────────────────────────────────
    const getCleanParams = () => {
        const p = {};
        if (applied.product) p.product = applied.product;
        if (applied.team) p.team = applied.team;
        if (applied.date_from) p.date_from = applied.date_from;
        if (applied.date_to) p.date_to = applied.date_to;
        if (applied.fixed_date_from) p.fixed_date_from = applied.fixed_date_from;
        if (applied.fixed_date_to) p.fixed_date_to = applied.fixed_date_to;
        return p;
    };

    // ── Apply filters → push draft to URL ────────────────────────────────────
    const applyFilters = () => {
        const p = {};
        if (draft.product) p.product = draft.product;
        if (draft.team) p.team = draft.team;
        if (draft.date_from) p.date_from = draft.date_from;
        if (draft.date_to) p.date_to = draft.date_to;
        if (draft.fixed_date_from) p.fixed_date_from = draft.fixed_date_from;
        if (draft.fixed_date_to) p.fixed_date_to = draft.fixed_date_to;
        p.page = '1';
        setSearchParams(p);
    };

    const clearFilters = () => {
        setDraft({ product: '', team: '', date_from: '', date_to: '', fixed_date_from: '', fixed_date_to: '' });
        setSearchParams({});
    };

    // ── Export Logic ────────────────────────────────────────────────────────────
    const executeExport = async () => {
        setExporting(true);
        try {
            // Fetch ALL matching records (no pagination) for PDF
            const params = { export: 'true', status: 'Fixed' };
            if (applied.product) params.product = applied.product;
            if (applied.team) params.team = applied.team;
            if (applied.date_from) params.date_from = applied.date_from;
            if (applied.date_to) params.date_to = applied.date_to;
            if (applied.fixed_date_from) params.fixed_date_from = applied.fixed_date_from;
            if (applied.fixed_date_to) params.fixed_date_to = applied.fixed_date_to;

            const res = await getTickets(params);

            if (exportConfig.format === 'word') {
                await exportToWord(res.data.tickets, exportConfig.orientation);
            } else {
                await exportToPDF(res.data.tickets, exportConfig.orientation, exportConfig.action);
            }
            setExportModal(false);
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setExporting(false);
        }
    };

    // ── Computed ──────────────────────────────────────────────────────────────
    const createdActive = !!applied.date_from;
    const fixedActive = !!applied.fixed_date_from;

    return (
        <div className="space-y-4">

            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Live Moved Tickets
                    </h1>
                    <p className="text-sm text-gray-400">
                        {total} tickets moved to live
                    </p>
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
                                    <button onClick={() => setExportConfig({ ...exportConfig, format: 'pdf' })} className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${exportConfig.format === 'pdf' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300'}`}>PDF</button>
                                    <button onClick={() => setExportConfig({ ...exportConfig, format: 'word' })} className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${exportConfig.format === 'word' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300'}`}>Word (DOCX)</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Orientation</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setExportConfig({ ...exportConfig, orientation: 'landscape' })} className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${exportConfig.orientation === 'landscape' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300'}`}>Landscape</button>
                                    <button onClick={() => setExportConfig({ ...exportConfig, orientation: 'portrait' })} className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${exportConfig.orientation === 'portrait' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300'}`}>Portrait</button>
                                </div>
                            </div>
                            {exportConfig.format === 'pdf' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Action</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => setExportConfig({ ...exportConfig, action: 'view' })} className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${exportConfig.action === 'view' ? 'bg-green-50 border-green-600 text-green-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300'}`}>View / Print</button>
                                        <button onClick={() => setExportConfig({ ...exportConfig, action: 'download' })} className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${exportConfig.action === 'download' ? 'bg-green-50 border-green-600 text-green-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300'}`}>Download</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                    <p className="text-xs text-amber-700 dark:text-amber-400">
                                        Note: Browsers cannot print Word files directly. This file will be downloaded automatically so you can view or print it using Microsoft Word.
                                    </p>
                                </div>
                            )}
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

            {/* ── Filters ── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm
                      border border-gray-100 dark:border-gray-700 space-y-3">

                {/* Row 1 — Dropdowns + Date toggles */}
                <div className="flex flex-wrap gap-3 items-end">

                    {/* Application */}
                    <div className="w-44">
                        <label className="block text-xs font-medium text-gray-500
                            dark:text-gray-400 mb-1.5">Application</label>
                        <Select
                            value={draft.product}
                            onChange={v => setDraft({ ...draft, product: v || '' })}
                            options={['Salesmatic', 'Distomatic']}
                            placeholder="All Applications"
                        />
                    </div>

                    {/* Team */}
                    <div className="w-36">
                        <label className="block text-xs font-medium text-gray-500
                            dark:text-gray-400 mb-1.5">Team</label>
                        <Select
                            value={draft.team}
                            onChange={v => setDraft({ ...draft, team: v || '' })}
                            options={['API', 'Web', 'App']}
                            placeholder="All Teams"
                        />
                    </div>

                    {/* Created Date toggle */}
                    <div className="flex flex-col gap-1.5">
                        <label className="block text-xs font-medium text-gray-500
                            dark:text-gray-400">Created Date</label>
                        <button
                            onClick={() => { setCreatedOpen(o => !o); setFixedOpen(false); }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                                font-medium border transition-colors
                                ${createdActive
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700'
                                    : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                }`}>
                            <Calendar size={14} />
                            {createdActive
                                ? fmtLabel(applied.date_from, applied.date_to)
                                : 'Select range'}
                            <span className={`transition-transform duration-200 ${createdOpen ? 'rotate-180' : ''}`}>▾</span>
                        </button>
                    </div>
                    {createdActive && (
                        <button onClick={() => {
                            setDraft({ ...draft, date_from: '', date_to: '' });
                            const p = { ...getCleanParams() };
                            delete p.date_from; delete p.date_to;
                            p.page = '1';
                            setSearchParams(p);
                        }}
                            className="flex items-center gap-1 px-2 py-2 self-end rounded-lg text-xs
                                text-red-500 border border-red-200 dark:border-red-800
                                hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <X size={11} /> Clear
                        </button>
                    )}

                    {/* Fixed Date toggle */}
                    <div className="flex flex-col gap-1.5">
                        <label className="block text-xs font-medium text-gray-500
                            dark:text-gray-400">Moved Date</label>
                        <button
                            onClick={() => { setFixedOpen(o => !o); setCreatedOpen(false); }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                                font-medium border transition-colors
                                ${fixedActive
                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700'
                                    : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                }`}>
                            <Calendar size={14} />
                            {fixedActive
                                ? fmtLabel(applied.fixed_date_from, applied.fixed_date_to)
                                : 'Select range'}
                            <span className={`transition-transform duration-200 ${fixedOpen ? 'rotate-180' : ''}`}>▾</span>
                        </button>
                    </div>
                    {fixedActive && (
                        <button onClick={() => {
                            setDraft({ ...draft, fixed_date_from: '', fixed_date_to: '' });
                            const p = { ...getCleanParams() };
                            delete p.fixed_date_from; delete p.fixed_date_to;
                            p.page = '1';
                            setSearchParams(p);
                        }}
                            className="flex items-center gap-1 px-2 py-2 self-end rounded-lg text-xs
                                text-red-500 border border-red-200 dark:border-red-800
                                hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <X size={11} /> Clear
                        </button>
                    )}
                </div>

                {/* Created date panel */}
                {createdOpen && (
                    <div className="flex flex-wrap gap-3 items-end pt-2
                        border-t border-gray-100 dark:border-gray-700">
                        <DateInput label="Created From" value={draft.date_from}
                            onChange={v => setDraft({ ...draft, date_from: v })} />
                        <DateInput label="Created To (optional)" value={draft.date_to}
                            onChange={v => setDraft({ ...draft, date_to: v })} />
                        <button onClick={() => {
                            applyFilters();
                            setCreatedOpen(false);
                        }} disabled={!draft.date_from}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600
                                hover:bg-blue-700 disabled:opacity-50 text-white text-sm
                                font-medium rounded-lg transition-colors mt-5">
                            <Search size={14} /> Apply
                        </button>
                        <button onClick={() => setCreatedOpen(false)}
                            className="px-4 py-2 text-sm text-gray-500 rounded-lg border
                                border-gray-300 dark:border-gray-600 transition-colors mt-5">
                            Cancel
                        </button>
                    </div>
                )}

                {/* Fixed date panel */}
                {fixedOpen && (
                    <div className="flex flex-wrap gap-3 items-end pt-2
                        border-t border-gray-100 dark:border-gray-700">
                        <DateInput label="Moved From" value={draft.fixed_date_from}
                            onChange={v => setDraft({ ...draft, fixed_date_from: v })} />
                        <DateInput label="Moved To (optional)" value={draft.fixed_date_to}
                            onChange={v => setDraft({ ...draft, fixed_date_to: v })} />
                        <button onClick={() => {
                            applyFilters();
                            setFixedOpen(false);
                        }} disabled={!draft.fixed_date_from}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600
                                hover:bg-green-700 disabled:opacity-50 text-white text-sm
                                font-medium rounded-lg transition-colors mt-5">
                            <Search size={14} /> Apply
                        </button>
                        <button onClick={() => setFixedOpen(false)}
                            className="px-4 py-2 text-sm text-gray-500 rounded-lg border
                                border-gray-300 dark:border-gray-600 transition-colors mt-5">
                            Cancel
                        </button>
                    </div>
                )}

                {/* Row 2 — Apply + Clear */}
                <div className="flex flex-wrap gap-3 items-center">
                    <button onClick={applyFilters}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600
                            hover:bg-blue-700 text-white text-sm font-medium
                            rounded-lg transition-colors">
                        <Filter size={14} /> Apply
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

            {/* ── Table ── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                      border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700 border-b
                                border-gray-200 dark:border-gray-600">
                                {['Ticket No', 'Created', 'Application', 'Team',
                                    'Module', 'Issue Description', 'Priority', 'Moved Date', ''].map(h => (
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
                                <tr><td colSpan={9} className="py-16 text-center">
                                    <div className="w-8 h-8 border-4 border-blue-500
                                        border-t-transparent rounded-full animate-spin mx-auto" />
                                </td></tr>
                            ) : tickets.length === 0 ? (
                                <tr><td colSpan={9} className="py-16 text-center text-gray-400 text-sm">
                                    No live moved tickets found
                                </td></tr>
                            ) : tickets.map(t => (
                                <tr key={t.id}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <button
                                            onClick={() => navigate(`/tickets/${t.id}`)}
                                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                                            {t.ticket_no}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {fmt(t.date)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                        {t.product_name}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded text-xs font-medium
                                            bg-indigo-100 text-indigo-700
                                            dark:bg-indigo-900/30 dark:text-indigo-400">
                                            {t.team}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[120px]">
                                        <Tooltip text={t.module}>
                                            <p className="truncate">{t.module || '—'}</p>
                                        </Tooltip>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[260px]">
                                        <Tooltip text={t.issue_description}>
                                            <p className="truncate">{t.issue_description || '—'}</p>
                                        </Tooltip>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge text={t.priority} colorMap={PRIORITY_COLORS} />
                                    </td>
                                    {/* Moved Date — green highlight since it's the key column */}
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="text-green-600 dark:text-green-400 font-medium">
                                            {fmt(t.fixed_date)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => navigate(`/tickets/${t.id}`)}
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

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700
                          flex items-center justify-between">
                        <p className="text-sm text-gray-400">
                            Page {page} of {totalPages} · {total} tickets
                        </p>
                        <div className="flex gap-2">
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
