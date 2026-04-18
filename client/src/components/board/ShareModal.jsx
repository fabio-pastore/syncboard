import { useState } from "react";
import { Share2, Copy, Check, UserPlus, X, Users, Download, FileText } from "lucide-react";
import { apiFetch } from "../../api";

export default function ShareModal({ board, setBoard, boardId, lines, onClose, onExportPng, onExportPdf }) {
    const [shareUrl, setShareUrl] = useState("");
    const [copied, setCopied] = useState(false);
    const [shareUsername, setShareUsername] = useState('');
    const [shareUserRole, setShareUserRole] = useState('viewer');
    const [shareUserMsg, setShareUserMsg] = useState('');

    async function generateShareLink(linkRole) {
        try {
            const data = await apiFetch(`/boards/${boardId}/share`, {
                method: 'POST',
                body: JSON.stringify({ role: linkRole }),
            });
            setShareUrl(`${window.location.origin}/board/share/${data.shareToken}`);
        } catch (err) {
            console.error("Failed to generate share link:", err);
        }
    }

    async function shareWithUser(e) {
        e.preventDefault();
        if (!shareUsername.trim()) return;
        try {
            const data = await apiFetch(`/boards/${boardId}/share/user`, {
                method: 'POST',
                body: JSON.stringify({ username: shareUsername.trim(), role: shareUserRole }),
            });
            setShareUserMsg(`Shared with ${data.username} as ${data.role}`);
            setShareUsername('');
            setBoard(prev => {
                const existing = prev.sharedWith.find(s => (s.user._id || s.user) === data.userId);
                if (existing) {
                    return { ...prev, sharedWith: prev.sharedWith.map(s =>
                        (s.user._id || s.user) === data.userId ? { ...s, role: data.role } : s
                    )};
                }
                return { ...prev, sharedWith: [...prev.sharedWith, { user: { _id: data.userId, username: data.username }, role: data.role }] };
            });
        } catch (err) {
            setShareUserMsg(err.error || 'Failed to share');
        }
    }

    async function removeSharedUser(userId) {
        try {
            await apiFetch(`/boards/${boardId}/share/user/${userId}`, { method: 'DELETE' });
            setBoard(prev => ({ ...prev, sharedWith: prev.sharedWith.filter(s => (s.user._id || s.user) !== userId) }));
        } catch (err) {
            console.error(err.error || 'Failed to remove user');
        }
    }

    function copyLink() {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function handleClose() {
        setShareUrl('');
        setShareUserMsg('');
        onClose();
    }

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={handleClose}
        >
            <div
                className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-gray-900 font-semibold text-lg mb-1">Share board</h2>
                <p className="text-gray-500 text-sm mb-4">One-time link expires when the guest leaves. Permanent share stays until revoked.</p>

                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">One-time link</p>
                <div className="flex gap-2 mb-3">
                    <button
                        onClick={() => generateShareLink('viewer')}
                        className="flex-1 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition text-sm cursor-pointer"
                    >
                        Viewer link
                    </button>
                    <button
                        onClick={() => generateShareLink('editor')}
                        className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition text-sm cursor-pointer"
                    >
                        Editor link
                    </button>
                </div>
                {shareUrl && (
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            readOnly
                            value={shareUrl}
                            className="flex-1 px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-900 text-sm outline-none"
                        />
                        <button
                            onClick={copyLink}
                            className="px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900 transition cursor-pointer"
                        >
                            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                        </button>
                    </div>
                )}

                <div className="border-t border-gray-100 my-4" />

                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Permanently share with a user</p>
                <form onSubmit={shareWithUser} className="flex gap-2 mb-2">
                    <input
                        type="text"
                        placeholder="Username"
                        value={shareUsername}
                        onChange={(e) => { setShareUsername(e.target.value); setShareUserMsg(''); }}
                        className="flex-1 px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-900 text-sm outline-none focus:border-violet-400"
                    />
                    <select
                        value={shareUserRole}
                        onChange={(e) => setShareUserRole(e.target.value)}
                        className="px-2 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 text-sm outline-none cursor-pointer"
                    >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                    </select>
                    <button
                        type="submit"
                        className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm transition cursor-pointer"
                        title="Share"
                    >
                        <UserPlus size={16} />
                    </button>
                </form>
                {shareUserMsg && (
                    <p className={`text-xs mb-2 ${shareUserMsg.startsWith('Shared') ? 'text-green-600' : 'text-red-500'}`}>
                        {shareUserMsg}
                    </p>
                )}

                {board?.sharedWith?.length > 0 && (
                    <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Has access</p>
                        <ul className="space-y-1">
                            {board.sharedWith.map((s) => {
                                const username = s.user?.username || s.user;
                                const uid = s.user?._id || s.user;
                                return (
                                    <li key={uid} className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                                        <span className="text-sm text-gray-800">{username}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.role === 'editor' ? 'bg-violet-100 text-violet-700' : 'bg-gray-200 text-gray-500'}`}>
                                                {s.role}
                                            </span>
                                            <button onClick={() => removeSharedUser(uid)} className="text-gray-400 hover:text-red-500 transition cursor-pointer" title="Remove access">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                <div className="border-t border-gray-100 my-4" />
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Export</p>
                <div className="flex gap-2 mb-3">
                    <button onClick={onExportPng} disabled={!lines.length}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Download size={14} />
                        PNG
                    </button>
                    <button onClick={onExportPdf} disabled={!lines.length}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <FileText size={14} />
                        PDF
                    </button>
                </div>

                <button
                    onClick={handleClose}
                    className="mt-2 w-full py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-900 transition text-sm cursor-pointer"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
