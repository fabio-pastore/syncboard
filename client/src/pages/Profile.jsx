import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
    const {user, updateUser} = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState(user.username);
    const [email, setEmail] = useState(user.email);
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setMessage('');

        const body = {};
        if (username !== user.username) body.username = username;
        if (email !== user.email) body.email = email;
        if (password) body.password = password;

        if (Object.keys(body).length === 0) {
            setError('No changes to update');
            return;
        }

        try {
            const updatedUser = await apiFetch('/user/profile', {
                method: 'PUT',
                body: JSON.stringify(body),
            });

            updateUser(updatedUser);
            setPassword('');
            setMessage('Profile updated successfully');
        } catch (err) {
            setError(err.message || 'Failed to update profile');
        }
    }

    return (
        <div className="min-h-screen bg-white text-gray-700">
            <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h1 className="text-xl font-semibold">
                    <span className="text-violet-600">Sync</span>
                    <span className="text-gray-900">Board</span>
                </h1>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition cursor-pointer"
                >
                    &larr; Back to Dashboard
                </button>
            </header>

            <main className="max-w-lg mx-auto px-6 py-12">
                <h2 className="text-2xl font-semibold text-gray-900 mb-8">Profile Settings</h2>

                {message && (
                    <div className="mb-4 px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-green-600 text-sm">
                        {message}
                    </div>
                )}
                {error && (
                    <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-800 outline-none focus:border-violet-400 transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-800 outline-none focus:border-violet-400 transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                            New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-800 placeholder-gray-400 outline-none focus:border-violet-400 transition"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition cursor-pointer"
                    >
                        Save Changes
                    </button>
                </form>
            </main>
        </div>
    );
}