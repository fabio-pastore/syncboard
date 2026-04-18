import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api';
import { useNavigate } from 'react-router-dom';
import folderIcon from '../assets/icons/folder.png';

export default function Dashboard() {

    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [folders, setFolders] = useState([]);
    const [boards, setBoards] = useState([]);
    const [sharedBoards, setSharedBoards] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [folderPath, setFolderPath] = useState([]);
    const [newFolderName, setFolderName] = useState('');
    const [newBoardName, setBoardName] = useState('');
    const [editingFolder, setEditingFolder] = useState(null);
    const [editingBoard, setEditingBoard] = useState(null);
    const [editName, setEditName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => { loadContents();}, [currentFolder]);

    async function loadContents() {
        try {
            const [folders, allBoards] = await Promise.all([
                currentFolder ? apiFetch(`/folders/${currentFolder}/children`) : apiFetch('/folders'),
                currentFolder ? apiFetch(`/boards/folder/${currentFolder}`) : apiFetch('/boards')
            ]);
            setFolders(folders);
            if (currentFolder) {
                setBoards(allBoards);
                setSharedBoards([]);
            } else {
                const mine = allBoards.filter(b => {
                    const ownerId = b.owner?._id || b.owner;
                    return ownerId === user.id;
                });
                const shared = allBoards.filter(b => {
                    const ownerId = b.owner?._id || b.owner;
                    return ownerId !== user.id;
                });
                setBoards(mine.filter(b => !b.folder));

                setSharedBoards(shared);
            }
        } catch (error) {
            setError("Failed to load contents");
        }
    }

    function openFolder(folder) {
        setFolderPath((prev) => [...prev, { id: currentFolder, name: folder.name }]);
        setCurrentFolder(folder._id);
    }

    function goBack() {
        const prev = [...folderPath]
        const parent = prev.pop();
        setFolderPath(prev);
        setCurrentFolder(parent?.id || null)
    }

    function goHome() {
        setFolderPath([]);
        setCurrentFolder(null);
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
        <div className="min-h-screen bg-white text-gray-700">
            <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h1 className="text-xl font-semibold">
                    <span className="text-violet-600">Sync</span>
                    <span className="text-gray-900">Board</span>
                </h1>
                <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500">
                        Welcome back, <b className="text-gray-800">{user.username}</b>
                    </span>
                    <button
                        onClick={logout}
                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition cursor-pointer"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {error && (
                    <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center justify-between text-sm">
                        <span>{error}</span>
                        <button
                            onClick={() => setError('')}
                            className="ml-4 text-red-400 hover:text-red-600 cursor-pointer text-lg leading-none"
                        >
                            &times;
                        </button>
                    </div>
                )}

                <nav className="flex items-center gap-1 text-sm mb-6 flex-wrap">
                    <button
                        onClick={goHome}
                        className="text-violet-600 hover:text-violet-700 hover:underline cursor-pointer font-medium"
                    >
                        Home
                    </button>
                    {folderPath.map((f, i) => (
                        <span key={i} className="flex items-center gap-1">
                            <span className="text-gray-300">/</span>
                            <span className="text-gray-500">{f.name}</span>
                        </span>
                    ))}
                    {currentFolder && (
                        <button
                            onClick={goBack}
                            className="ml-4 text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                            &larr; Back
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
                            className="px-3 py-2 rounded-lg border border-gray-200 text-gray-800 placeholder-gray-400 outline-none focus:border-violet-400 transition text-sm w-48"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition text-sm cursor-pointer"
                        >
                            + Folder
                        </button>
                    </form>

                    <form onSubmit={createBoard} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="New board name"
                            value={newBoardName}
                            onChange={(e) => setBoardName(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-gray-800 placeholder-gray-400 outline-none focus:border-violet-400 transition text-sm w-48"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition text-sm cursor-pointer"
                        >
                            + Board
                        </button>
                    </form>
                </div>

                {folders.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                            Folders
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {folders.map((folder) => (
                                <div
                                    key={folder._id}
                                    className="group relative bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition cursor-pointer"
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
                                                className="px-2 py-1 rounded border border-gray-200 text-gray-800 text-sm outline-none focus:border-violet-400"
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
                                                    className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div onClick={() => openFolder(folder)}>
                                            <img src={folderIcon} alt="Folder" className="w-8 h-8 mb-2" />
                                            <p className="text-sm text-gray-800 truncate">
                                                {folder.name}
                                            </p>
                                        </div>
                                    )}

                                    {editingFolder !== folder._id && (
                                        <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingFolder(folder._id);
                                                    setEditingBoard(null);
                                                    setEditName(folder.name);
                                                }}
                                                className="p-1 rounded border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 text-xs cursor-pointer"
                                                title="Rename"
                                            >
                                                &#9998;
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteFolder(folder._id);
                                                }}
                                                className="p-1 rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 text-xs cursor-pointer"
                                                title="Delete"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {boards.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                            Boards
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {boards.map((board) => (
                                <div
                                    key={board._id}
                                    className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-violet-400 hover:shadow-sm transition cursor-pointer"
                                    onClick={() => navigate(`/board/${board._id}`)}
                                >
                                    {editingBoard === board._id ? (
                                        <div className="p-4">
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
                                                    className="px-2 py-1 rounded border border-gray-200 text-gray-800 text-sm outline-none focus:border-violet-400"
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
                                                        className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 cursor-pointer"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="w-full aspect-[4/3] bg-white border-b border-gray-100" />
                                            <div className="p-3">
                                                <p className="text-sm text-gray-800 truncate">
                                                    {board.name}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {new Date(
                                                        board.updatedAt
                                                    ).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {editingBoard !== board._id && (
                                        <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingBoard(board._id);
                                                    setEditingFolder(null);
                                                    setEditName(board.name);
                                                }}
                                                className="p-1 rounded bg-white/80 border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-white text-xs cursor-pointer"
                                                title="Rename"
                                            >
                                                &#9998;
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteBoard(board._id);
                                                }}
                                                className="p-1 rounded bg-white/80 border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 text-xs cursor-pointer"
                                                title="Delete"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {sharedBoards.length > 0 && !currentFolder && (
                    <section className="mb-8">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                            Shared with me
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {sharedBoards.map((board) => (
                                <div
                                    key={board._id}
                                    className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-violet-400 hover:shadow-sm transition cursor-pointer"
                                    onClick={() => navigate(`/board/${board._id}`)}
                                >
                                    <div className="w-full aspect-[4/3] bg-white border-b border-gray-100" />
                                    <div className="p-3">
                                        <p className="text-sm text-gray-800 truncate">{board.name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            by {board.owner?.username || 'unknown'}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(board.updatedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {folders.length === 0 && boards.length === 0 && sharedBoards.length === 0 && (
                    <div className="text-center py-20 text-gray-400">
                        <p className="text-lg">
                            Nothing here yet. Create a folder or board to get started.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}