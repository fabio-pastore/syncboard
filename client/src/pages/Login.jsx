import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


export default function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        try {
            await login(identifier, password);
            navigate('/');
        } catch (err) {
            setError('Failed to log in');
        }
    }

    // i hate css me too
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
            <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4 bg-gray-900 border-gray-800 border text-white rounded-xl p-8">
                <h1 className='text-2xl font-semibold text-white text-center'>Welcome back</h1>

                <input 
                    type="text" 
                    placeholder='Email or username'
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:border-violet-500 transition"
                />
                <input
                    type="password" 
                    placeholder='Password'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:border-violet-500 transition"
                 />
                <button type="submit" className='py-2.5 bg-violet-600 hover:bg-violet-700 transition rounded-lg font-medium cursor-pointer'>Log in</button>
                <p className="text-center text-gray-400 text-sm">Don't have an account? <Link to="/signup" className='text-violet-400 hover:underline'>Sign up</Link></p>
            </form>
        </div>
    )
}