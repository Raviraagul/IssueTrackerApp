import { useState } from 'react';
import { updateName } from '../api';
import { UserPen, CheckCircle } from 'lucide-react';

export default function ChangeNameModal({ onClose, currentName, onNameChanged }) {
    const [name, setName] = useState(currentName || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSave = async () => {
        setError('');
        if (!name.trim()) { setError('Name cannot be empty.'); return; }
        if (name.trim() === currentName) { onClose(); return; }
        setSaving(true);
        try {
            await updateName(name.trim());
            onNameChanged(name.trim());
            setSuccess(true);
            setTimeout(onClose, 1500);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update name.');
        } finally {
            setSaving(false);
        }
    };

    const inputCls = `w-full px-3 py-2 rounded-lg border border-gray-300
        dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900
        dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                    p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
                      w-full max-w-sm">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700
                        flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <UserPen size={18} className="text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            Change Name
                        </h2>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600
                             dark:hover:text-gray-200 hover:bg-gray-100
                             dark:hover:bg-gray-700">
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    {success ? (
                        <div className="flex flex-col items-center py-6 gap-3">
                            <div className="w-14 h-14 rounded-full bg-green-100
                                dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle size={28} className="text-green-600
                                    dark:text-green-400" />
                            </div>
                            <p className="text-base font-semibold text-gray-900 dark:text-white">
                                Name updated successfully!
                            </p>
                            <p className="text-sm text-gray-400">Closing automatically...</p>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20
                                    border border-red-200 dark:border-red-800
                                    rounded-lg text-red-600 dark:text-red-400 text-sm">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700
                                     dark:text-gray-300">Full Name</label>
                                <input
                                    className={inputCls}
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                                    placeholder="Enter your name"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={handleSave} disabled={saving}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        text-white text-sm font-medium rounded-lg
                                        transition-colors flex items-center
                                        justify-center gap-2">
                                    {saving
                                        ? <div className="w-4 h-4 border-2 border-white
                                            border-t-transparent rounded-full animate-spin" />
                                        : 'Save'}
                                </button>
                                <button onClick={onClose}
                                    className="flex-1 py-2.5 border border-gray-300
                                        dark:border-gray-600 text-gray-600
                                        dark:text-gray-300 text-sm font-medium
                                        rounded-lg hover:bg-gray-50
                                        dark:hover:bg-gray-700 transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}