import { createContext, useContext, useState, useEffect } from 'react';
import { login as loginApi, getMe } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // ── Restore session on page refresh ────────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('token');
        const saved = localStorage.getItem('user');
        if (token && saved) {
            try {
                setUser(JSON.parse(saved));
            } catch {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        setLoading(false);
    }, []);

    // ── Login ───────────────────────────────────────────────────────────────────
    const login = async (email, password) => {
        const res = await loginApi(email, password);
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        return user;
    };

    // ── Logout ──────────────────────────────────────────────────────────────────
    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    const isAdmin = user?.role === 'admin';
    const isEditor = user?.role === 'editor' || user?.role === 'admin';
    const canEditTicket = (ticketTeam) => {
        if (!isEditor) return false;
        if (user?.role === 'admin') return true;
        if (!user?.team || user?.team === 'Support') return true;
        return user?.team === ticketTeam;
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAdmin, loading, isEditor, canEditTicket, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}