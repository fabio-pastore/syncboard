import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Signup() {

    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const {signup} = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        try {
            await signup(email, username, password);
            navigate('/');
        } catch (err) {
            setError('Failed to sign up');
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
            <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4 bg-gray-900 border-gray-800 border text-white rounded-xl p-8"> 
                <h1 className='text-2xl font-semibold text-white text-center'> Create an account </h1>
                <input 
                    type="email" 
                    placeholder='Email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:border-violet-500 transition"
                />
                <input 
                    type = "text"
                    placeholder="Username"
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:border-violet-500 transition"

                />
                <input 
                    type="password"
                    placeholder='Password'
                    value={password} 
                    onChange={(e)=> setPassword(e.target.value)}
                    required
                    className="px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:border-violet-500 transition"
                />

                <button type="submit" className='py-2.5 bg-violet-600 hover:bg-violet-700 transition rounded-lg font-medium cursor-pointer'>Sign up</button>
                <p className="text-center text-gray-400 text-sm">Already have an account? <Link to="/login" className='text-violet-400 hover:underline'>Log in</Link></p>
            </form>
        </div>
    );
}


