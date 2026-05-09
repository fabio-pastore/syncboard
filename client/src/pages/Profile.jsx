import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api';
import { X, CheckCircle, AlertCircle, User, AlertTriangle, Loader2 } from 'lucide-react';

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
    const { user, updateUser, logout } = useAuth();
    const fileInputRef = useRef(null);

    const [username, setUsername] = useState(user.username);
    const [email, setEmail] = useState(user.email);
    const [password, setPassword] = useState('');
    const [profileImage, setProfileImage] = useState(user.profileImage || null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (open) {
            setUsername(user.username);
            setEmail(user.email);
            setPassword('');
            setProfileImage(user.profileImage || null);
            setMessage('');
            setError('');
            setShowDeleteConfirm(false);
            setDeletePassword('');
            setDeleteError('');
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
            const errorDetail = (err.error || err.message || "").toLowerCase();
            setError(`Failed to update profile${errorDetail ? `: ${errorDetail}` : ""}`);
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteAccount(e) {
        e.preventDefault();
        if (!deletePassword.trim()) return;
        setDeleteError('');
        setDeleting(true);
        try {
            await apiFetch('/user/account', {
                method: 'DELETE',
                body: JSON.stringify({ password: deletePassword }),
            });
            logout();
        } catch (err) {
            const errorDetail = (err.error || err.message || "").toLowerCase();
            setDeleteError(`Failed to delete account${errorDetail ? `: ${errorDetail}` : ""}`);
        } finally {
            setDeleting(false);
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
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-6">
                    {message && (
                        <div className="mb-5 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2 animate-[slideUp_0.2s_ease]">
                            <CheckCircle className="w-4 h-4 shrink-0" />
                            {message}
                        </div>
                    )}
                    {error && (
                        <div className="mb-5 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2 animate-[slideUp_0.2s_ease]">
                            <AlertCircle className="w-4 h-4 shrink-0" />
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
                                    <User className="w-10 h-10 text-gray-300" />
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
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving…
                                </>
                            ) : 'Save Changes'}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => { setShowDeleteConfirm(true); setDeletePassword(''); setDeleteError(''); }}
                            className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-medium transition cursor-pointer text-sm"
                        >
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>

            {showDeleteConfirm && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] animate-[fadeIn_0.15s_ease]"
                    onClick={() => setShowDeleteConfirm(false)}
                >
                    <div
                        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-[slideUp_0.15s_ease]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
                        </div>

                        <p className="text-sm text-gray-500 mb-4">
                            This will permanently delete your account, all your boards, folders, and associated data. <span className="font-semibold text-gray-800">This action cannot be undone.</span>
                        </p>

                        {deleteError && (
                            <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {deleteError}
                            </div>
                        )}

                        <form onSubmit={handleDeleteAccount}>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Enter your password to confirm
                            </label>
                            <input
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                placeholder="Current password"
                                autoFocus
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-400 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition text-sm mb-4"
                            />
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition text-sm font-medium cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!deletePassword.trim() || deleting}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white transition text-sm font-medium cursor-pointer shadow-sm flex items-center justify-center gap-2"
                                >
                                    {deleting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Deleting…
                                        </>
                                    ) : 'Delete my account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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