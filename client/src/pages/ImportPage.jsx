import { useState, useRef } from 'react';
import { importExcel, getImportLogs } from '../api';
import { useEffect } from 'react';
import {
    Upload, FileSpreadsheet, CheckCircle,
    AlertCircle, Clock, X
} from 'lucide-react';
import DateInput from '../components/DateInput';

function LogRow({ log }) {
    return (
        <div className="flex items-center justify-between p-4 rounded-lg
                    bg-gray-50 dark:bg-gray-700 text-sm">
            <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                    {log.filename}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(log.imported_at).toLocaleString()} · {log.imported_by_name}
                </p>
            </div>
            <div className="flex gap-4 text-xs ml-4 shrink-0">
                <span className="text-green-600 dark:text-green-400 font-medium">
                    +{log.new_tickets} new
                </span>
                <span className="text-blue-500 font-medium">
                    {log.updated_tickets} updated
                </span>
                <span className="text-amber-500 font-medium">
                    {log.archived_tickets} archived
                </span>
            </div>
        </div>
    );
}

export default function ImportPage() {
    const [file, setFile] = useState(null);
    const [date, setDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    // const [time, setTime] = useState('AM');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [logs, setLogs] = useState([]);
    const [dragging, setDragging] = useState(false);
    const fileRef = useRef();

    useEffect(() => { fetchLogs(); }, []);

    const fetchLogs = async () => {
        try {
            const res = await getImportLogs();
            setLogs(res.data);
        } catch { }
    };

    const handleFile = (f) => {
        if (!f) return;
        if (!f.name.match(/\.(xlsx|xls)$/i)) {
            setError('Only Excel files (.xlsx or .xls) are allowed.');
            return;
        }
        setError('');
        setResult(null);
        setFile(f);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files[0]);
    };

    const handleSubmit = async () => {
        if (!file) return;
        setUploading(true);
        setProgress(0);
        setError('');
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('snapshot_date', date);
            // formData.append('snapshot_time', time);

            const res = await importExcel(formData, setProgress);
            setResult(res.data);
            setFile(null);
            fetchLogs();
        } catch (err) {
            setError(err.response?.data?.error || 'Import failed. Please try again.');
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Import Excel
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">
                    Upload your SharePoint Excel file to sync ticket data
                </p>
            </div>

            {/* Upload Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                      border border-gray-100 dark:border-gray-700 p-6 space-y-5">

                {/* Drop Zone */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center
                      cursor-pointer transition-colors
                      ${dragging
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                >
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => handleFile(e.target.files[0])}
                    />

                    {file ? (
                        <div className="flex items-center justify-center gap-3">
                            <FileSpreadsheet size={32} className="text-green-500" />
                            <div className="text-left">
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {file.name}
                                </p>
                                <p className="text-sm text-gray-400">
                                    {(file.size / 1024).toFixed(1)} KB — ready to import
                                </p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                className="ml-2 p-1 text-gray-400 hover:text-red-500"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <Upload size={36} className="mx-auto text-gray-300
                                           dark:text-gray-600 mb-3" />
                            <p className="font-medium text-gray-700 dark:text-gray-200">
                                Drop your Excel file here
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                                or click to browse — .xlsx / .xls only
                            </p>
                        </>
                    )}
                </div>

                {/* Date + Time */}
                <div className="grid grid-cols-2 gap-4">
                    {/* <div>
                        <label className="block text-sm font-medium text-gray-700
                               dark:text-gray-300 mb-1.5">
                            Snapshot Date
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300
                         dark:border-gray-600 bg-white dark:bg-gray-700
                         text-gray-900 dark:text-white focus:outline-none
                         focus:ring-2 focus:ring-blue-500"
                        />
                    </div> */}
                    <DateInput
                        label="Snapshot Date"
                        value={date}
                        onChange={setDate}
                    />
                    {/* <div>
                        <label className="block text-sm font-medium text-gray-700
                               dark:text-gray-300 mb-1.5">
                            Snapshot Time
                        </label>
                        <div className="flex gap-2">
                            {['AM', 'PM'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTime(t)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium
                              border transition-colors
                              ${time === t
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div> */}
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-start gap-2 px-4 py-3 bg-red-50
                          dark:bg-red-900/20 border border-red-200
                          dark:border-red-800 rounded-lg text-red-600
                          dark:text-red-400 text-sm">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Success */}
                {result && (
                    <div className="px-4 py-4 bg-green-50 dark:bg-green-900/20
                          border border-green-200 dark:border-green-800
                          rounded-lg">
                        <div className="flex items-center gap-2 text-green-700
                            dark:text-green-400 font-medium mb-3">
                            <CheckCircle size={18} />
                            Import completed successfully!
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-center">
                            {[
                                { label: 'New', value: result.stats?.new, color: 'text-green-600' },
                                { label: 'Updated', value: result.stats?.updated, color: 'text-blue-600' },
                                // { label: 'Archived', value: result.stats?.archived, color: 'text-amber-600' },
                                { label: 'Missing', value: result.stats?.missing, color: 'text-amber-600' },
                                { label: 'Changes', value: result.stats?.field_changes, color: 'text-purple-600' },
                            ].map((s) => (
                                <div key={s.label} className="bg-white dark:bg-gray-800
                                              rounded-lg p-3 shadow-sm">
                                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Progress bar */}
                {uploading && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>Uploading and processing...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={!file || uploading}
                    className="w-full flex items-center justify-center gap-2 py-3
                     bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                     disabled:cursor-not-allowed text-white font-medium
                     rounded-lg transition-colors"
                >
                    {uploading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent
                              rounded-full animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Upload size={18} />
                            Import Excel
                        </>
                    )}
                </button>
            </div>

            {/* Import History */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                      border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={18} className="text-gray-400" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Import History
                    </h2>
                </div>
                {logs.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                        No imports yet
                    </p>
                ) : (
                    <div className="space-y-2">
                        {logs.map((log) => <LogRow key={log.id} log={log} />)}
                    </div>
                )}
            </div>
        </div>
    );
}