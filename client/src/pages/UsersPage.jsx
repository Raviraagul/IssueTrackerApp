import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, resetUserPassword } from '../api';
import { UserPlus, Shield, Eye, EyeOff, Lock, Users } from 'lucide-react';
import Select from '../components/Select';

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                    p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
                      w-full max-w-md">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700
                        flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {title}
                    </h2>
                    <button onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600
                             dark:hover:text-gray-200 hover:bg-gray-100
                             dark:hover:bg-gray-700">
                        ✕
                    </button>
                </div>
                <div className="px-6 py-5">{children}</div>
            </div>
        </div>
    );
}

const inputCls = `w-full px-3 py-2 rounded-lg border border-gray-300
  dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900
  dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;

const ROLE_OPTIONS = [
    { value: 'viewer', label: 'Viewer' },
    { value: 'editor', label: 'Editor' },
    { value: 'admin', label: 'Admin' },
];

const TEAM_OPTIONS = [
    { value: 'API', label: 'API' },
    { value: 'Web', label: 'Web' },
    { value: 'App', label: 'App' },
    { value: 'Support', label: 'Support' },
];

const ROLE_COLORS = {
    admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    editor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const TEAM_COLORS = {
    API: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    Web: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    App: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    Support: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [resetting, setResetting] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Add form
    const [addName, setAddName] = useState('');
    const [addEmail, setAddEmail] = useState('');
    const [addPwd, setAddPwd] = useState('');
    const [addRole, setAddRole] = useState('viewer');
    const [addTeam, setAddTeam] = useState('');
    const [showPwd, setShowPwd] = useState(false);

    // Edit form
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('viewer');
    const [editTeam, setEditTeam] = useState('');
    const [editActive, setEditActive] = useState(true);

    // Reset form
    const [resetPwd, setResetPwd] = useState('');
    const [showResetPwd, setShowResetPwd] = useState(false);

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await getUsers();
            setUsers(res.data);
        } catch { }
        finally { setLoading(false); }
    };

    const handleAdd = async () => {
        setError('');
        if (!addName || !addEmail || !addPwd) {
            setError('All fields are required.'); return;
        }
        try {
            await createUser({
                name: addName,
                email: addEmail,
                password: addPwd,
                role: addRole,
                team: addRole === 'admin' ? null : (addTeam || null),
            });
            setSuccess('User created successfully!');
            setShowAdd(false);
            setAddName(''); setAddEmail(''); setAddPwd('');
            setAddRole('viewer'); setAddTeam('');
            fetchUsers();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create user.');
        }
    };

    const handleEdit = async () => {
        setError('');
        try {
            await updateUser(editing.id, {
                name: editName,
                role: editRole,
                team: editRole === 'admin' ? null : (editTeam || null),
                is_active: editActive,
            });
            setSuccess('User updated successfully!');
            setEditing(null);
            fetchUsers();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update user.');
        }
    };

    const handleReset = async () => {
        setError('');
        if (!resetPwd || resetPwd.length < 6) {
            setError('Password must be at least 6 characters.'); return;
        }
        try {
            await resetUserPassword(resetting.id, resetPwd);
            setSuccess(`Password reset for ${resetting.name}`);
            setResetting(null);
            setResetPwd('');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password.');
        }
    };

    const openEdit = (user) => {
        setEditing(user);
        setEditName(user.name);
        setEditRole(user.role);
        setEditTeam(user.team || '');
        setEditActive(user.is_active);
        setError('');
    };

    return (
        <div className="space-y-5">

            {/* Add User Modal */}
            {showAdd && (
                <Modal title="Add New User"
                    onClose={() => { setShowAdd(false); setError(''); }}>
                    <div className="space-y-4">
                        {error && (
                            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20
                            px-3 py-2 rounded-lg">{error}</p>
                        )}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700
                                 dark:text-gray-300">Full Name</label>
                            <input className={inputCls} placeholder="John Doe"
                                value={addName} onChange={e => setAddName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700
                                 dark:text-gray-300">Email</label>
                            <input className={inputCls} type="email"
                                placeholder="john@example.com"
                                value={addEmail} onChange={e => setAddEmail(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700
                                 dark:text-gray-300">Password</label>
                            <div className="relative">
                                <input className={inputCls + ' pr-10'}
                                    type={showPwd ? 'text' : 'password'}
                                    placeholder="Min 6 characters"
                                    value={addPwd} onChange={e => setAddPwd(e.target.value)} />
                                <button type="button" onClick={() => setShowPwd(!showPwd)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2
                             text-gray-400 hover:text-gray-600">
                                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700
                                        dark:text-gray-300">Role</label>
                                <Select
                                    value={addRole}
                                    onChange={v => {
                                        setAddRole(v || 'viewer');
                                        if (v === 'admin') setAddTeam('');
                                    }}
                                    options={ROLE_OPTIONS}
                                    placeholder=""
                                />
                            </div>
                            {/* Team — hidden for admin */}
                            {addRole !== 'admin' && (
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-gray-700
                                         dark:text-gray-300">Team (optional)</label>
                                    <Select
                                        value={addTeam}
                                        onChange={v => setAddTeam(v || '')}
                                        options={TEAM_OPTIONS}
                                        placeholder="No team"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Access hint */}
                        <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50
                            dark:bg-gray-700/50 rounded-lg px-3 py-2">
                            {addRole === 'admin' && '🔑 Full access — all tickets, import, users'}
                            {addRole === 'editor' && !addTeam && '✏️ Can edit all tickets, view reports'}
                            {addRole === 'editor' && addTeam === 'Support' && '✏️ Can edit all tickets, view all teams'}
                            {addRole === 'editor' && addTeam && addTeam !== 'Support' && `✏️ Can only see and edit ${addTeam} team tickets`}
                            {addRole === 'viewer' && !addTeam && '👁 Read only — all tickets and reports'}
                            {addRole === 'viewer' && addTeam === 'Support' && '👁 Read only — all tickets and reports'}
                            {addRole === 'viewer' && addTeam && addTeam !== 'Support' && `👁 Read only — ${addTeam} team tickets only`}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={handleAdd}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700
                           text-white text-sm font-medium rounded-lg">
                                Create User
                            </button>
                            <button onClick={() => { setShowAdd(false); setError(''); }}
                                className="flex-1 py-2 border border-gray-300 dark:border-gray-600
                           text-gray-600 dark:text-gray-300 text-sm font-medium
                           rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Edit User Modal */}
            {editing && (
                <Modal title="Edit User"
                    onClose={() => { setEditing(null); setError(''); }}>
                    <div className="space-y-4">
                        {error && (
                            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20
                            px-3 py-2 rounded-lg">{error}</p>
                        )}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700
                                 dark:text-gray-300">Full Name</label>
                            <input className={inputCls} value={editName}
                                onChange={e => setEditName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700
                                    dark:text-gray-300">Role</label>
                                <Select
                                    value={editRole}
                                    onChange={v => {
                                        setEditRole(v || 'viewer');
                                        if (v === 'admin') setEditTeam('');
                                    }}
                                    options={ROLE_OPTIONS}
                                    placeholder=""
                                />
                            </div>
                            {/* Team — hidden for admin */}
                            {editRole !== 'admin' && (
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-gray-700
                                         dark:text-gray-300">Team (optional)</label>
                                    <Select
                                        value={editTeam}
                                        onChange={v => setEditTeam(v || '')}
                                        options={TEAM_OPTIONS}
                                        placeholder="No team"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Access hint */}
                        <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50
                            dark:bg-gray-700/50 rounded-lg px-3 py-2">
                            {editRole === 'admin' && '🔑 Full access — all tickets, import, users'}
                            {editRole === 'editor' && !editTeam && '✏️ Can edit all tickets, view reports'}
                            {editRole === 'editor' && editTeam === 'Support' && '✏️ Can edit all tickets, view all teams'}
                            {editRole === 'editor' && editTeam && editTeam !== 'Support' && `✏️ Can only see and edit ${editTeam} team tickets`}
                            {editRole === 'viewer' && !editTeam && '👁 Read only — all tickets and reports'}
                            {editRole === 'viewer' && editTeam === 'Support' && '👁 Read only — all tickets and reports'}
                            {editRole === 'viewer' && editTeam && editTeam !== 'Support' && `👁 Read only — ${editTeam} team tickets only`}
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700
                                 dark:text-gray-300">Status</label>
                            <Select
                                value={editActive ? 'active' : 'inactive'}
                                onChange={v => setEditActive(v === 'active')}
                                options={[
                                    { value: 'active', label: 'Active' },
                                    { value: 'inactive', label: 'Inactive' },
                                ]}
                                placeholder=""
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleEdit}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700
                           text-white text-sm font-medium rounded-lg">
                                Save Changes
                            </button>
                            <button onClick={() => { setEditing(null); setError(''); }}
                                className="flex-1 py-2 border border-gray-300 dark:border-gray-600
                           text-gray-600 dark:text-gray-300 text-sm font-medium
                           rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Reset Password Modal */}
            {resetting && (
                <Modal title={`Reset Password — ${resetting.name}`}
                    onClose={() => { setResetting(null); setResetPwd(''); setError(''); }}>
                    <div className="space-y-4">
                        {error && (
                            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20
                            px-3 py-2 rounded-lg">{error}</p>
                        )}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700
                                 dark:text-gray-300">New Password</label>
                            <div className="relative">
                                <input className={inputCls + ' pr-10'}
                                    type={showResetPwd ? 'text' : 'password'}
                                    placeholder="Min 6 characters"
                                    value={resetPwd}
                                    onChange={e => setResetPwd(e.target.value)} />
                                <button type="button"
                                    onClick={() => setShowResetPwd(!showResetPwd)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2
                             text-gray-400 hover:text-gray-600">
                                    {showResetPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {resetPwd && (
                                <p className={`text-xs ${resetPwd.length >= 6
                                    ? 'text-green-500' : 'text-red-400'}`}>
                                    {resetPwd.length >= 6 ? '✓ Good length' : 'Too short — min 6 characters'}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleReset}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700
                           text-white text-sm font-medium rounded-lg">
                                Reset Password
                            </button>
                            <button onClick={() => { setResetting(null); setResetPwd(''); setError(''); }}
                                className="flex-1 py-2 border border-gray-300 dark:border-gray-600
                           text-gray-600 dark:text-gray-300 text-sm font-medium
                           rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Users
                    </h1>
                    <p className="text-sm text-gray-400">
                        Manage who can access Issue Tracker
                    </p>
                </div>
                <button onClick={() => { setShowAdd(true); setError(''); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600
                     hover:bg-blue-700 text-white text-sm font-medium
                     rounded-lg transition-colors">
                    <UserPlus size={16} /> Add User
                </button>
            </div>

            {/* Success */}
            {success && (
                <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border
                        border-green-200 dark:border-green-800 rounded-lg
                        text-green-700 dark:text-green-400 text-sm">
                    {success}
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm
                      border border-gray-100 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700 border-b
                           border-gray-200 dark:border-gray-600">
                            {['Name', 'Email', 'Role', 'Team', 'Status', 'Created', ''].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-500 dark:text-gray-400 uppercase
                                        tracking-wider">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {loading ? (
                            <tr><td colSpan={7} className="py-16 text-center">
                                <div className="w-8 h-8 border-4 border-blue-500
                                border-t-transparent rounded-full
                                animate-spin mx-auto" />
                            </td></tr>
                        ) : users.map(u => (
                            <tr key={u.id}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-600 flex
                                    items-center justify-center text-white
                                    text-xs font-bold shrink-0">
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {u.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                                    {u.email}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`flex items-center gap-1 w-fit px-2 py-0.5
                                    rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                                        {u.role === 'admin' && <Shield size={10} />}
                                        {u.role === 'editor' && <span>✏️</span>}
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {u.team ? (
                                        <span className={`px-2 py-0.5 rounded-full text-xs
                                            font-medium ${TEAM_COLORS[u.team] || 'bg-gray-100 text-gray-600'}`}>
                                            {u.team}
                                        </span>
                                    ) : (
                                        <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                                    ${u.is_active
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                        {u.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-gray-400 text-xs">
                                    {new Date(u.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(u)}
                                            className="px-3 py-1 text-xs text-blue-600 hover:text-blue-700
                                 border border-blue-200 hover:border-blue-400
                                 dark:border-blue-800 dark:hover:border-blue-600
                                 rounded-lg transition-colors">
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => { setResetting(u); setResetPwd(''); setError(''); }}
                                            className="p-1.5 text-gray-400 hover:text-amber-600
                                 hover:bg-amber-50 dark:hover:bg-amber-900/20
                                 rounded-lg transition-colors"
                                            title="Reset Password">
                                            <Lock size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
