import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, Ticket, Upload, FileBarChart,
    Users, LogOut, Menu, X, Sun, Moon, ChevronDown, KeyRound, UserPen
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import ChangeNameModal from './ChangeNameModal';


// ── Reports nested nav ────────────────────────────────────────────────────────
function ReportsNav({ onClose }) {
    const location = useLocation();
    const isActive = location.pathname.startsWith('/reports');
    const [open, setOpen] = useState(isActive);

    return (
        <div>
            <button
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between px-4 py-3
                    rounded-lg text-sm font-medium transition-all duration-150
                    ${isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
            >
                <div className="flex items-center gap-3">
                    <FileBarChart size={18} />
                    <span>Reports</span>
                </div>
                <ChevronDown
                    size={14}
                    className={`transition-transform duration-200
                      ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div className="ml-4 mt-1 space-y-0.5 border-l-2
                        border-gray-200 dark:border-gray-700 pl-3">
                    <NavLink
                        to="/reports/standard"
                        onClick={onClose}
                        className={({ isActive }) =>
                            `flex items-center px-3 py-2 rounded-lg text-xs font-medium
               transition-colors
               ${isActive
                                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`
                        }
                    >
                        Standard Reports
                    </NavLink>
                    <NavLink
                        to="/reports/daily"
                        onClick={onClose}
                        className={({ isActive }) =>
                            `flex items-center px-3 py-2 rounded-lg text-xs font-medium
               transition-colors
               ${isActive
                                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`
                        }
                    >
                        Daily Report
                    </NavLink>
                </div>
            )}
        </div>
    );
}

// ── Main Layout ───────────────────────────────────────────────────────────────
export default function Layout({ children }) {
    const { user, logout, isAdmin, setUser } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [dark, setDark] = useState(
        () => localStorage.getItem('theme') === 'dark'
    );
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [showChangePwd, setShowChangePwd] = useState(false);
    const [showChangeName, setShowChangeName] = useState(false);

    // ── Close dropdown on outside click ──────────────────────────────────────
    const userMenuRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        if (dark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [dark]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleNameChanged = (newName) => {
        // Update user in localStorage and context
        const updated = { ...user, name: newName };
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
    };

    const NavItem = ({ to, icon: Icon, label, onClick }) => (
        <NavLink
            to={to}
            onClick={onClick}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
         transition-all duration-150
         ${isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
            }
        >
            <Icon size={18} />
            <span>{label}</span>
        </NavLink>
    );

    const Sidebar = ({ onClose }) => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center
                          justify-center text-white font-bold text-sm">IT</div>
                    <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">
                            Issue Tracker
                        </p>
                        <p className="text-xs text-gray-400">RR Solutions</p>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard"
                    onClick={onClose} />
                <NavItem to="/tickets" icon={Ticket} label="Tickets"
                    onClick={onClose} />
                {isAdmin && (
                    <NavItem to="/import" icon={Upload} label="Import"
                        onClick={onClose} />
                )}
                <ReportsNav onClose={onClose} />
                {isAdmin && (
                    <NavItem to="/users" icon={Users} label="Users"
                        onClick={onClose} />
                )}
            </nav>

            {/* User info */}
            <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg
                        bg-gray-50 dark:bg-gray-700">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center
                          justify-center text-white text-xs font-bold">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {user?.name}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {showChangePwd && (
                <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
            )}
            {showChangeName && (
                <ChangeNameModal
                    currentName={user?.name}
                    onClose={() => setShowChangeName(false)}
                    onNameChanged={handleNameChanged}
                />
            )}

            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">

                {/* Desktop Sidebar */}
                <aside className="hidden lg:flex flex-col w-60 bg-white dark:bg-gray-800
                           border-r border-gray-200 dark:border-gray-700
                           fixed inset-y-0 left-0 z-30">
                    <Sidebar onClose={() => { }} />
                </aside>

                {/* Mobile Sidebar Overlay */}
                {sidebarOpen && (
                    <div className="lg:hidden fixed inset-0 z-40 flex">
                        <div className="fixed inset-0 bg-black/50"
                            onClick={() => setSidebarOpen(false)} />
                        <aside className="relative flex flex-col w-64 bg-white
                               dark:bg-gray-800 shadow-xl z-50">
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="absolute top-4 right-4 p-1 rounded-lg text-gray-400
                           hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <X size={20} />
                            </button>
                            <Sidebar onClose={() => setSidebarOpen(false)} />
                        </aside>
                    </div>
                )}

                {/* Main Content */}
                {/* <div className="flex-1 lg:ml-60 flex flex-col min-h-screen"> */}
                <div className="flex-1 lg:ml-60 flex flex-col h-screen overflow-hidden">

                    {/* Top bar */}
                    <header className="sticky top-0 z-20 bg-white dark:bg-gray-800
                              border-b border-gray-200 dark:border-gray-700
                              px-4 py-3 flex items-center justify-between
                              shadow-sm">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 rounded-lg text-gray-500
                         hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <Menu size={20} />
                        </button>

                        <div className="hidden lg:block" />

                        <div className="flex items-center gap-2">
                            {/* Dark mode toggle */}
                            <button
                                onClick={() => setDark(!dark)}
                                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100
                           dark:text-gray-400 dark:hover:bg-gray-700
                           transition-colors"
                                title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                {dark ? <Sun size={18} /> : <Moon size={18} />}
                            </button>

                            {/* User menu */}
                            <div className="relative" ref={userMenuRef}>
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg
                             text-gray-600 dark:text-gray-300 hover:bg-gray-100
                             dark:hover:bg-gray-700 transition-colors"
                                >
                                    <div className="w-7 h-7 rounded-full bg-blue-600 flex
                                  items-center justify-center text-white
                                  text-xs font-bold">
                                        {user?.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium hidden sm:block">
                                        {user?.name}
                                    </span>
                                    <ChevronDown
                                        size={14}
                                        className={`transition-transform duration-200
                                            ${userMenuOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {userMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white
                                  dark:bg-gray-800 rounded-xl shadow-lg
                                  border border-gray-200 dark:border-gray-700
                                  py-1 z-50">
                                        <div className="px-4 py-2 border-b border-gray-100
                                    dark:border-gray-700">
                                            <p className="text-sm font-medium text-gray-900
                                    dark:text-white">{user?.name}</p>
                                            <p className="text-xs text-gray-400">{user?.email}</p>
                                            {/* <p className="text-xs text-gray-400 capitalize mt-0.5">
                                                {user?.role}
                                                {user?.team && (
                                                    <span className="ml-1">· {user.team}</span>
                                                )}
                                            </p> */}
                                        </div>
                                        <button
                                            onClick={() => {
                                                setUserMenuOpen(false);
                                                setShowChangeName(true);
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-2
                                 text-sm text-gray-600 dark:text-gray-300
                                 hover:bg-gray-50 dark:hover:bg-gray-700
                                 transition-colors"
                                        >
                                            <UserPen size={14} />
                                            Change Name
                                        </button>
                                        <button
                                            onClick={() => {
                                                setUserMenuOpen(false);
                                                setShowChangePwd(true);
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-2
                                 text-sm text-gray-600 dark:text-gray-300
                                 hover:bg-gray-50 dark:hover:bg-gray-700
                                 transition-colors"
                                        >
                                            <KeyRound size={14} />
                                            Change Password
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-4 py-2
                                 text-sm text-red-600 hover:bg-red-50
                                 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <LogOut size={14} />
                                            Sign out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* Page content */}
                    <main className="flex-1 p-4 md:p-6 overflow-auto">
                        {children}
                    </main>
                </div>
            </div>
        </>
    );
}
