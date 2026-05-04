import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(identifier, password);
            navigate('/dashboard');
        } catch (err) {
            setError("Failed to login: ", err.error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-white px-4">

            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-100 rounded-full blur-3xl opacity-40" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-50 rounded-full blur-3xl opacity-50" />
            </div>

            <div className="w-full max-w-sm relative z-10">

                <div className="text-center mb-8">
                    <Link to="/" className="text-3xl font-semibold select-none">
                        <span className="text-violet-600">Sync</span>
                        <span className="text-gray-900">Board</span>
                    </Link>
                    <p className="text-gray-400 text-sm mt-2">The collaborative whiteboard</p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="w-full flex flex-col gap-5 bg-white border border-gray-200 rounded-2xl p-8 shadow-sm"
                >
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>
                        <p className="text-sm text-gray-400 mt-1">Sign in to your account to continue</p>
                    </div>

                    {error && (
                        <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700">Email or username</label>
                            <input
                                type="text"
                                placeholder="you@example.com"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                                className="px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition text-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-700">Password</label>
                            <input
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition text-sm"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 disabled:cursor-not-allowed transition rounded-xl font-medium text-white cursor-pointer text-sm shadow-sm"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Signing in...
                            </span>
                        ) : (
                            'Sign in'
                        )}
                    </button>

                    <p className="text-center text-gray-400 text-sm">
                        Don't have an account?{' '}
                        <Link to="/signup" className="text-violet-600 hover:text-violet-700 font-medium transition">
                            Sign up
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}