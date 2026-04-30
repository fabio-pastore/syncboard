import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api';

const MAX_DIMENSION = 256;

function resizeImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                if (width > height) {
                    if (width > MAX_DIMENSION) {
                        height = Math.round((height * MAX_DIMENSION) / width);
                        width = MAX_DIMENSION;
                    }
                } else {
                    if (height > MAX_DIMENSION) {
                        width = Math.round((width * MAX_DIMENSION) / height);
                        height = MAX_DIMENSION;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function Profile({ open, onClose }) {
    const { user, updateUser } = useAuth();
    const fileInputRef = useRef(null);

    const [username, setUsername] = useState(user.username);
    const [email, setEmail] = useState(user.email);
    const [password, setPassword] = useState('');
    const [profileImage, setProfileImage] = useState(user.profileImage || null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setUsername(user.username);
            setEmail(user.email);
            setPassword('');
            setProfileImage(user.profileImage || null);
            setMessage('');
            setError('');
        }
    }, [open, user]);

    // from pc key esc to close this
    useEffect(() => {
        if (!open) return;
        function handleKey(e) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    // do not scroll behind if this is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    async function handleImageChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }
        try {
            const base64 = await resizeImage(file);
            setProfileImage(base64);
        } catch {
            setError('Failed to process image');
        }
    }

    function removeImage() {
        setProfileImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setMessage('');

        const body = {};
        if (username !== user.username) body.username = username;
        if (email !== user.email) body.email = email;
        if (password) body.password = password;
        if (profileImage !== (user.profileImage || null)) body.profileImage = profileImage;

        if (Object.keys(body).length === 0) {
            setError('No changes to update');
            return;
        }

        setSaving(true);
        try {
            const updatedUser = await apiFetch('/user/profile', {
                method: 'PUT',
                body: JSON.stringify(body),
            });

            updateUser(updatedUser);
            setPassword('');
            setMessage('Profile updated successfully');
            setTimeout(() => {
                setMessage('');
            }, 2500);
        } catch (err) {
            setError(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
                onClick={onClose}
            />

            <div className="
                relative z-10 bg-white shadow-2xl overflow-y-auto
                w-full h-full
                sm:w-[440px] sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-gray-200
                animate-[slideUp_0.25s_ease]
            ">
                <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                    <h2 className="text-lg font-semibold text-gray-900">Profile Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>

                <div className="px-6 py-6">
                    {message && (
                        <div className="mb-5 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2 animate-[slideUp_0.2s_ease]">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                            </svg>
                            {message}
                        </div>
                    )}
                    {error && (
                        <div className="mb-5 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2 animate-[slideUp_0.2s_ease]">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="flex flex-col items-center gap-3">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="relative w-24 h-24 rounded-full border-2 border-dashed border-gray-300 hover:border-violet-400 cursor-pointer overflow-hidden group transition flex items-center justify-center bg-gray-50"
                            >
                                {profileImage ? (
                                    <img
                                        src={profileImage}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-gray-300">
                                        <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-full">
                                    <span className="text-white text-xs font-medium">Change</span>
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="hidden"
                            />
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs text-violet-600 hover:text-violet-700 font-medium cursor-pointer"
                                >
                                    Upload photo
                                </button>
                                {profileImage && (
                                    <>
                                        <span className="text-gray-300">·</span>
                                        <button
                                            type="button"
                                            onClick={removeImage}
                                            className="text-xs text-red-500 hover:text-red-600 font-medium cursor-pointer"
                                        >
                                            Remove
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 6 characters"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition text-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-medium transition cursor-pointer text-sm flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Saving…
                                </>
                            ) : 'Save Changes'}
                        </button>
                    </form>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(16px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}