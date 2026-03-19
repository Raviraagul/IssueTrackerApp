import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [form, setForm] = useState({ email: '', password: '' });
    const [showPwd, setShowPwd] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        // setError('');
        setLoading(true);
        try {
            const user = await login(form.email, form.password);
            // navigate(user.role === 'admin' ? '/dashboard' : '/dashboard');
            if (user) {
                console.log(`user`, user);

                navigate('/dashboard');
            }
        } catch (err) {
            console.log(`err`, err);

            setError(err.response?.data?.error || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center 
                    bg-gradient-to-br from-blue-50 to-indigo-100
                    dark:from-gray-900 dark:to-gray-800 p-4">
            <div className="w-full max-w-md">

                {/* Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">

                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center
                            justify-center text-white font-bold text-2xl mx-auto mb-4
                            shadow-lg shadow-blue-200 dark:shadow-blue-900">
                            IT
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Issue Tracker
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Sign in to your account
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20
                            border border-red-200 dark:border-red-800
                            rounded-lg text-red-600 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={form.email}
                                onChange={(e) => {
                                    setForm({ ...form, email: e.target.value });
                                    setError('');
                                }}
                                placeholder="you@example.com"
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-300
                           dark:border-gray-600 bg-white dark:bg-gray-700
                           text-gray-900 dark:text-white placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-blue-500
                           focus:border-transparent transition-colors"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPwd ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={form.password}
                                    onChange={(e) => {
                                        setForm({ ...form, password: e.target.value });
                                        setError('');
                                    }}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-2.5 pr-11 rounded-lg border border-gray-300
                             dark:border-gray-600 bg-white dark:bg-gray-700
                             text-gray-900 dark:text-white placeholder-gray-400
                             focus:outline-none focus:ring-2 focus:ring-blue-500
                             focus:border-transparent transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPwd(!showPwd)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2
                             text-gray-400 hover:text-gray-600
                             dark:hover:text-gray-200"
                                >
                                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2
                         px-4 py-2.5 bg-blue-600 hover:bg-blue-700
                         disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-medium rounded-lg
                         transition-colors shadow-sm"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent
                                rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn size={18} />
                                    Sign in
                                </>
                            )}
                        </button>
                    </form>

                    {/* Default credentials hint */}
                    <p className="text-center text-xs text-gray-400 mt-6">
                        Default: admin@issuetracker.com / Admin@123
                    </p>
                </div>
            </div>
        </div>
    );
}