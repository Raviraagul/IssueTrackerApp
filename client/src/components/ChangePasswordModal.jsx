import { useState } from 'react';
import { changePassword } from '../api';
import { KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function ChangePasswordModal({ onClose }) {
    const [current, setCurrent] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showCur, setShowCur] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showCon, setShowCon] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {
        setError('');
        if (!current || !newPwd || !confirm) {
            setError('All fields are required.'); return;
        }
        if (newPwd.length < 6) {
            setError('New password must be at least 6 characters.'); return;
        }
        if (newPwd !== confirm) {
            setError('New passwords do not match.'); return;
        }
        if (current === newPwd) {
            setError('New password must be different from current password.'); return;
        }
        setLoading(true);
        try {
            await changePassword({ current_password: current, new_password: newPwd });
            setSuccess(true);
            setTimeout(onClose, 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to change password.');
        } finally {
            setLoading(false);
        }
    };

    const inputCls = `w-full px-3 py-2 pr-10 rounded-lg border border-gray-300
    dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900
    dark:text-white text-sm focus:outline-none focus:ring-2
    focus:ring-blue-500 transition-colors`;

    const strength = newPwd.length === 0 ? 0
        : newPwd.length < 6 ? 1
            : newPwd.length < 9 ? 2
                : newPwd.length < 12 ? 3 : 4;

    const strengthLabel = ['', 'Too short', 'Fair', 'Good', 'Strong'][strength];
    const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-green-500'][strength];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                    p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
                      w-full max-w-md">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700
                        flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <KeyRound size={18} className="text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            Change Password
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
                              dark:bg-green-900/30 flex items-center
                              justify-center">
                                <CheckCircle size={28} className="text-green-600
                                                   dark:text-green-400" />
                            </div>
                            <p className="text-base font-semibold text-gray-900 dark:text-white">
                                Password changed successfully!
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

                            {/* Current Password */}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700
                                   dark:text-gray-300">Current Password</label>
                                <div className="relative">
                                    <input type={showCur ? 'text' : 'password'}
                                        value={current} onChange={e => setCurrent(e.target.value)}
                                        placeholder="••••••••" className={inputCls} />
                                    <button type="button" onClick={() => setShowCur(!showCur)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2
                               text-gray-400 hover:text-gray-600">
                                        {showCur ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* New Password */}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700
                                   dark:text-gray-300">New Password</label>
                                <div className="relative">
                                    <input type={showNew ? 'text' : 'password'}
                                        value={newPwd} onChange={e => setNewPwd(e.target.value)}
                                        placeholder="••••••••" className={inputCls} />
                                    <button type="button" onClick={() => setShowNew(!showNew)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2
                               text-gray-400 hover:text-gray-600">
                                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {/* Strength bar */}
                                {newPwd && (
                                    <div className="space-y-1 pt-1">
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i}
                                                    className={`h-1 flex-1 rounded-full transition-colors
                            ${i <= strength ? strengthColor : 'bg-gray-200 dark:bg-gray-700'}`}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-400">{strengthLabel}</p>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700
                                   dark:text-gray-300">Confirm New Password</label>
                                <div className="relative">
                                    <input type={showCon ? 'text' : 'password'}
                                        value={confirm} onChange={e => setConfirm(e.target.value)}
                                        placeholder="••••••••" className={inputCls} />
                                    <button type="button" onClick={() => setShowCon(!showCon)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2
                               text-gray-400 hover:text-gray-600">
                                        {showCon ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {confirm && newPwd && (
                                    <p className={`text-xs ${newPwd === confirm
                                        ? 'text-green-500' : 'text-red-400'}`}>
                                        {newPwd === confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
                                    </p>
                                )}
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button onClick={handleSubmit} disabled={loading}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700
                             disabled:opacity-50 disabled:cursor-not-allowed
                             text-white text-sm font-medium rounded-lg
                             transition-colors flex items-center
                             justify-center gap-2">
                                    {loading
                                        ? <div className="w-4 h-4 border-2 border-white
                                      border-t-transparent rounded-full animate-spin" />
                                        : 'Change Password'}
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