import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api';
import { Home, ChevronRight, ArrowLeft, Plus, FolderOpen, Paintbrush, Pencil, Trash2, Inbox } from 'lucide-react';

export default function Dashboard() {

    const { user, logout } = useAuth();
    const [folders, setFolders] = useState([]);
    const [boards, setBoards] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [folderPath, setFolderPath] = useState([]); // this is an array of folder ids that represents the path to the current folder, so we can easily navigate back up the folder tree
    const [newFolderName, setFolderName] = useState('');
    const [newBoardName, setBoardName] = useState('');
    const [editingFolder, setEditingFolder] = useState(null);
    const [editingBoard, setEditingBoard] = useState(null);
    const [editName, setEditName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => { loadContents();}, [currentFolder]);

    async function loadContents() {
        try {
            const [folders, boards] = await Promise.all([
                currentFolder ? apiFetch(`/folders/${currentFolder}/children`) : apiFetch('/folders'),
                currentFolder ? apiFetch(`/boards/folder/${currentFolder}`) : apiFetch('/boards')
            ]);
            setFolders(folders);
            setBoards(currentFolder ? boards : boards.filter((board) => !board.folder)) // if current folder is not null display boards in curr folder else display only boards that are not in a folder (i.e. in homepage)
        } catch (error) {
            setError("Failed to load contents");
        }
    }

    function openFolder(folder) {
        // currentFolder = null - folderPath = []
        setFolderPath((prev) => [...prev, { id: currentFolder, name: folder.name }]);
        setCurrentFolder(folder._id);
        loadContents();
    }

    function goBack() {
        const prev = [...folderPath]
        const parent = prev.pop();
        setFolderPath(prev);
        setCurrentFolder(parent?.id || null)
        loadContents();
    }

    function goHome() {
        setFolderPath([]);
        setCurrentFolder(null);
        loadContents();
    }

    async function createFolder(e) {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        try {
            await apiFetch('/folders', {method: 'POST', body: JSON.stringify({ name: newFolderName.trim(), parent: currentFolder})});
            setFolderName(''); 
            loadContents();
        } catch (err) {setError(err.error || "Failed to create folder")}
    }

    async function createBoard(e) {
        e.preventDefault();
        if (!newBoardName.trim()) return;
        try {
            await apiFetch('/boards/create', {method: 'POST', body: JSON.stringify({ name: newBoardName.trim(), folder: currentFolder})});
            setBoardName(''); 
            loadContents();
        } catch (err) {setError(err.error || "Failed to create board")}
    }

    async function renameFolder(e) {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        try {
            await apiFetch('/folders', {method: 'PUT', body: JSON.stringify({ name: newFolderName.trim(), parent: currentFolder})})
            setEditingFolder(null);
            setFolderName('');
            loadContents();
        } catch (err) {setError(err.error || "Failed to rename folder")}
    }

    async function renameBoard(e) {
        e.preventDefault();
        if (!newBoardName.trim()) return;
        try {
            await apiFetch('/boards', {method: 'PUT', body: JSON.stringify({ name: newBoardName.trim(), folder: currentFolder })});
            setEditingBoard(null);
            setBoardName(''); 
            loadContents();
        } catch (err) {setError(err.error || "Failed to rename board")}
    }

    async function deleteFolder(id) {
        if (!confirm("Delete this folder and all its contents?")) return;
        
        try { await apiFetch(`/folders/${id}`, { method: 'DELETE'}); loadContents();}
        catch (err) {setError(err.error || "Failed to delete folder")}
    }

    async function deleteBoard(id) {
        if (!confirm("Delete this board?")) return;
        try { await apiFetch(`/boards/${id}`, { method: 'DELETE'}); loadContents();}
        catch (err) {setError(err.error || "Failed to delete board")}
    }
    
    return (
        <div className="min-h-screen bg-gray-950 text-gray-300">
            <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <h1 className="text-xl font-semibold text-white">SyncBoard</h1>
                <div className="flex items-center gap-3">
                    <span>
                        Welcome back, <b>{user.username}!</b>
                    </span>
                    <button
                        onClick={logout}
                        className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition cursor-pointer"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-6">
                {error && (
                    <div className="mb-4 px-4 py-2 rounded-lg bg-red-900/40 border border-red-700 text-red-300 flex items-center justify-between">
                        <span>{error}</span>
                        <button
                            onClick={() => setError('')}
                            className="ml-4 text-red-400 hover:text-red-200 cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                <nav className="flex items-center gap-1 text-sm mb-6 flex-wrap">
                    <button
                        onClick={goHome}
                        className="text-violet-400 hover:text-violet-300 hover:underline cursor-pointer font-medium"
                    >
                        <Home size={14} />Home
                    </button>
                    {folderPath.map((f, i) => (
                        <span key={i} className="flex items-center gap-1">
                            <ChevronRight size={14} className="text-gray-600" />
                            <span className="text-gray-400">{f.name}</span>
                        </span>
                    ))}
                    {currentFolder && (
                        <button
                            onClick={goBack}
                            className="ml-4 text-sm text-gray-500 hover:text-gray-300 cursor-pointer"
                        >
                            <ArrowLeft size={14} /> Back
                        </button>
                    )}
                </nav>

                <div className="flex flex-wrap gap-3 mb-8">
                    <form onSubmit={createFolder} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="New folder name"
                            value={newFolderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:border-violet-500 transition text-sm w-48"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition text-sm cursor-pointer"
                        >
                            <Plus size={14} /> Folder
                        </button>
                    </form>

                    <form onSubmit={createBoard} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="New board name"
                            value={newBoardName}
                            onChange={(e) => setBoardName(e.target.value)}
                            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:border-violet-500 transition text-sm w-48"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition text-sm cursor-pointer"
                        >
                            <Plus size={14} /> Board
                        </button>
                    </form>
                </div>

                {folders.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                            Folders
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {folders.map((folder) => (
                                <div
                                    key={folder._id}
                                    className="group relative bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition cursor-pointer"
                                >
                                    {editingFolder === folder._id ? (
                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                renameFolder(folder._id);
                                            }}
                                            className="flex flex-col gap-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) =>
                                                    setEditName(e.target.value)
                                                }
                                                autoFocus
                                                className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-white text-sm outline-none focus:border-violet-500"
                                            />
                                            <div className="flex gap-1">
                                                <button
                                                    type="submit"
                                                    className="text-xs px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 cursor-pointer"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingFolder(null);
                                                        setEditName('');
                                                    }}
                                                    className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div onClick={() => openFolder(folder)}>
                                            <FolderOpen size={28} className="text-yellow-500 mb-2" />
                                            <p className="text-sm text-white truncate">
                                                {folder.name}
                                            </p>
                                        </div>
                                    )}

                                    {/* Actions (visible on hover) */}
                                    {editingFolder !== folder._id && (
                                        <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingFolder(folder._id);
                                                    setEditingBoard(null);
                                                    setEditName(folder.name);
                                                }}
                                                className="p-1 rounded bg-gray-800 text-gray-400 hover:text-white text-xs cursor-pointer"
                                                title="Rename"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteFolder(folder._id);
                                                }}
                                                className="p-1 rounded bg-gray-800 text-gray-400 hover:text-red-400 text-xs cursor-pointer"
                                                title="Delete"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Boards */}
                {boards.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                            Boards
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {boards.map((board) => (
                                <div
                                    key={board._id}
                                    className="group relative bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-violet-600 transition cursor-pointer"
                                >
                                    {editingBoard === board._id ? (
                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                renameBoard(board._id);
                                            }}
                                            className="flex flex-col gap-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) =>
                                                    setEditName(e.target.value)
                                                }
                                                autoFocus
                                                className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-white text-sm outline-none focus:border-violet-500"
                                            />
                                            <div className="flex gap-1">
                                                <button
                                                    type="submit"
                                                    className="text-xs px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 cursor-pointer"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingBoard(null);
                                                        setEditName('');
                                                    }}
                                                    className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div>
                                            <Paintbrush size={28} className="text-violet-400 mb-2" />
                                            <p className="text-sm text-white truncate">
                                                {board.name}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {new Date(
                                                    board.updatedAt
                                                ).toLocaleDateString()}
                                            </p>
                                        </div>
                                    )}

                                    {/* Actions (visible on hover) */}
                                    {editingBoard !== board._id && (
                                        <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingBoard(board._id);
                                                    setEditingFolder(null);
                                                    setEditName(board.name);
                                                }}
                                                className="p-1 rounded bg-gray-800 text-gray-400 hover:text-white text-xs cursor-pointer"
                                                title="Rename"
                                            >
                                            <Pencil size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteBoard(board._id);
                                                }}
                                                className="p-1 rounded bg-gray-800 text-gray-400 hover:text-red-400 text-xs cursor-pointer"
                                                title="Delete"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Empty state */}
                {folders.length === 0 && boards.length === 0 && (
                    <div className="text-center py-20 text-gray-500">
                        <Inbox size={48} className="mx-auto mb-4 text-gray-600" />
                        <p className="text-lg">
                            Nothing here yet. Create a folder or board to get
                            started.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}