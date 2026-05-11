import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api';
import { useNavigate } from 'react-router-dom';
import folderIcon from '../assets/icons/folder.png';
import { Folder, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import Profile from './Profile';
// we need the following imports to implement drag-n-drop support on mobile too since it natively is not
import { polyfill } from "mobile-drag-drop";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour"; 
import "mobile-drag-drop/default.css";

function timeAgo(dateStr) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

// me when the menu is kebab
// i <3 🌯 (this is a kebab in case emoji doesn't render)
function KebabMenu({ items, align = 'right' }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        function close(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
                className="p-1 rounded-lg bg-white/90 border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-white cursor-pointer shadow-sm leading-none transition"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
                </svg>
            </button>
            {open && (
                <div
                    className={`absolute top-full mt-1 ${align === 'right' ? 'right-0' : 'left-0'} bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-30 min-w-[140px] animate-[fadeIn_0.12s_ease]`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {items.map((item, i) =>
                        item.divider ? (
                            <div key={i} className="border-t border-gray-100 my-1" />
                        ) : (
                            <button
                                key={i}
                                onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition cursor-pointer ${
                                    item.danger
                                        ? 'text-red-600 hover:bg-red-50'
                                        : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                {item.icon && <span className="text-gray-400">{item.icon}</span>}
                                {item.label}
                            </button>
                        )
                    )}
                </div>
            )}
        </div>
    );
}

function CreatePopover({ currentFolder, onCreated }) {
    const [mode, setMode] = useState(null); // null | 'folder' | 'board'
    const [name, setName] = useState('');
    const [creating, setCreating] = useState(false);
    const inputRef = useRef(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (mode && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [mode]);

    useEffect(() => {
        if (!mode) return;
        function close(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setMode(null);
                setName('');
            }
        }
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [mode]);

    async function handleCreate(e) {
        e.preventDefault();
        if (!name.trim() || creating) return;
        setCreating(true);
        try {
            if (mode === 'folder') {
                await apiFetch('/folders', { method: 'POST', body: JSON.stringify({ name: name.trim(), parent: currentFolder }) });
            } else {
                await apiFetch('/boards/create', { method: 'POST', body: JSON.stringify({ name: name.trim(), folder: currentFolder }) });
            }
            setName('');
            setMode(null);
            onCreated();
        } catch (err) {
            // parent will handle error display
        } finally {
            setCreating(false);
        }
    }

    return (
        <div ref={wrapperRef} className="relative inline-flex">
            {!mode ? (
                <div className="flex gap-2">
                    <button
                        onClick={() => setMode('folder')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition text-sm font-medium cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400">
                            <path d="M3.75 3A1.75 1.75 0 002 4.75v3.235a3.252 3.252 0 011.298-.952l.26-.108A6.493 6.493 0 017.5 6.267V4.75A1.75 1.75 0 009.25 3h5.5c.966 0 1.75.784 1.75 1.75v1.5a.75.75 0 01-1.5 0v-1.5a.25.25 0 00-.25-.25h-5.5a.25.25 0 00-.25.25v1.518a4.964 4.964 0 00-2.5.815V4.75A.25.25 0 005.75 4.5H3.75z" />
                            <path fillRule="evenodd" d="M2 9.763v5.487c0 .69.56 1.25 1.25 1.25h13.5c.69 0 1.25-.56 1.25-1.25V7.75A1.75 1.75 0 0016.25 6H10.5a.75.75 0 010-1.5h5.75A3.25 3.25 0 0119.5 7.75v7.5A3.25 3.25 0 0116.25 18.5H3.25A3.25 3.25 0 010 15.25V9.763c0-.667.266-1.304.738-1.776A2.507 2.507 0 012 9.763z" clipRule="evenodd" />
                        </svg>
                        New Folder
                    </button>
                    <button
                        onClick={() => setMode('board')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition text-sm font-medium cursor-pointer shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                        </svg>
                        New Board
                    </button>
                </div>
            ) : (
                <form onSubmit={handleCreate} className="flex items-center gap-2 animate-[fadeIn_0.15s_ease]">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={mode === 'folder' ? 'Folder name…' : 'Board name…'}
                            className="w-56 px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition text-sm"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!name.trim() || creating}
                        className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white transition text-sm font-medium cursor-pointer"
                    >
                        {creating ? '…' : 'Create'}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode(null); setName(''); }}
                        className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition text-sm cursor-pointer"
                    >
                        Cancel
                    </button>
                </form>
            )}
        </div>
    );
}

function InlineRename({ defaultValue, onSave, onCancel }) {
    const [val, setVal] = useState(defaultValue);
    const ref = useRef(null);

    useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); if (val.trim()) onSave(val.trim()); }}
            className="flex flex-col gap-1 items-center w-full"
            onClick={(e) => e.stopPropagation()}
        >
            <input
                ref={ref}
                type="text"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
                className="w-full px-1.5 py-1 rounded-lg border border-gray-200 text-gray-800 text-xs text-center outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
            />
            <div className="flex gap-1 w-full justify-center">
                <button type="submit" className="flex-1 text-[10px] px-1.5 py-1 rounded-lg bg-violet-600 text-white hover:bg-violet-700 cursor-pointer font-medium">
                    Save
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onCancel(); }} className="flex-1 text-[10px] px-1.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 cursor-pointer">
                    Cancel
                </button>
            </div>
        </form>
    );
}

export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [folders, setFolders] = useState([]);
    const [boards, setBoards] = useState([]);
    const [sharedBoards, setSharedBoards] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [folderPath, setFolderPath] = useState([]);
    const [editingFolder, setEditingFolder] = useState(null);
    const [editingBoard, setEditingBoard] = useState(null);
    
    const [itemToDelete, setItemToDelete] = useState(null); 

    const [error, setError] = useState('');
    const [showProfile, setShowProfile] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null); // null = not searching
    const [searchLoading, setSearchLoading] = useState(false);
    const [loading, setLoading] = useState(true);

    const [draggedItem, setDraggedItem] = useState(null);
    const [draggedOverFolder, setDraggedOverFolder] = useState(null);
    const [sortBy, setSortBy] = useState('updatedAt'); // 'name' | 'updatedAt' | 'createdAt'
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

    useEffect(() => {
        polyfill({
            dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
            forceApplyEffectAllowed: true,
            holdToDrag: 500
        });
        const onTouchMove = () => {};
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        return () => window.removeEventListener('touchmove', onTouchMove);
    }, []);

    useEffect(() => { loadContents(); }, [currentFolder]);

    // query user search input
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }
        setSearchLoading(true);
        const timer = setTimeout(async () => {
            try {
                const data = await apiFetch(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                setSearchResults(data);
            } catch {
                setSearchResults({ folders: [], boards: [] });
            } finally {
                setSearchLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    async function loadContents() {
        setLoading(true);
        try {
            const [f, allBoards] = await Promise.all([
                currentFolder ? apiFetch(`/folders/${currentFolder}/children`) : apiFetch('/folders'),
                currentFolder ? apiFetch(`/boards/folder/${currentFolder}`) : apiFetch('/boards')
            ]);
            setFolders(f);
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
        } catch (err) {
            const errorDetail = (err.error || err.message || "").toLowerCase();
            setError(`Failed to load contents${errorDetail ? `: ${errorDetail}` : ""}`);
        } finally {
            setLoading(false);
        }
    }

    async function moveItem(tfid) {
        const targetId = tfid === 'home' ? null : tfid;
        if (!draggedItem) return;
        if (draggedItem.type === 'folder' && draggedItem.id === targetId) return;
        if (currentFolder === targetId) return; // prevent unnecessary API call if we're already in the folder
        try {
            const endpoint = draggedItem.type === 'board' ? `/boards/${draggedItem.id}` : `/folders/${draggedItem.id}`;
            const body = draggedItem.type === 'board' ? { folder: targetId } : { parent: targetId };
            await apiFetch(endpoint, { method: 'PUT', body: JSON.stringify(body) });
            loadContents();
        } catch (err) {
            const errorDetail = (err.error || err.message || "").toLowerCase();
            setError(`Failed to move item${errorDetail ? `: ${errorDetail}` : ""}`);
        } finally {
            setDraggedItem(null);
            setDraggedOverFolder(null);
        }
    }

    function openFolder(folder) {
        setFolderPath((prev) => [...prev, { id: folder._id, parentId: currentFolder, name: folder.name }]);
        setCurrentFolder(folder._id);
        setSearchQuery(''); // reset search if the folder was opened using search tool
    }

    function goBack() {
        const prev = [...folderPath];
        const current = prev.pop();
        setFolderPath(prev);
        setCurrentFolder(current?.parentId || null);
    }

    function goHome() {
        setFolderPath([]);
        setCurrentFolder(null);
    }

    async function renameFolder(id, newName) {
        try {
            await apiFetch(`/folders/${id}`, { method: 'PUT', body: JSON.stringify({ name: newName }) });
            setEditingFolder(null);
            loadContents();
        } catch (err) {
            const errorDetail = (err.error || err.message || "").toLowerCase();
            setError(`Failed to rename folder${errorDetail ? `: ${errorDetail}` : ""}`);
        }
    }

    async function renameBoard(id, newName) {
        try {
            await apiFetch(`/boards/${id}`, { method: 'PUT', body: JSON.stringify({ name: newName }) });
            setEditingBoard(null);
            loadContents();
        } catch (err) {
            const errorDetail = (err.error || err.message || "").toLowerCase();
            setError(`Failed to rename board${errorDetail ? `: ${errorDetail}` : ""}`);
        }
    }

    async function confirmDelete() {
        if (!itemToDelete) return;
        const { id, type } = itemToDelete;
        try {
            const endpoint = type === 'folder' ? `/folders/${id}` : `/boards/${id}`;
            await apiFetch(endpoint, { method: 'DELETE' });
            loadContents();
        } catch (err) {
            const errorDetail = (err.error || err.message || "").toLowerCase();
            setError(`Failed to delete ${type}${errorDetail ? `: ${errorDetail}` : ""}`);
        } finally {
            setItemToDelete(null);
        }
    }

    function sortItems(items) {
        const sorted = [...items];
        sorted.sort((a, b) => {
            let valA, valB;
            if (sortBy === 'name') {
                valA = (a.name || '').toLowerCase();
                valB = (b.name || '').toLowerCase();
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                valA = new Date(a[sortBy] || 0).getTime();
                valB = new Date(b[sortBy] || 0).getTime();
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }
        });
        return sorted;
    }

    const isSearching = searchQuery.trim().length > 0;
    const filteredFolders = sortItems(isSearching && searchResults
        ? searchResults.folders
        : folders);
    const filteredBoards = sortItems(isSearching && searchResults
        ? searchResults.boards.filter(b => {
            const ownerId = b.owner?._id || b.owner;
            return ownerId === user.id;
        })
        : boards);
    const filteredShared = sortItems(isSearching && searchResults
        ? searchResults.boards.filter(b => {
            const ownerId = b.owner?._id || b.owner;
            return ownerId !== user.id;
        })
        : sharedBoards);

    const isEmpty = !(loading || searchLoading) && filteredFolders.length === 0 && filteredBoards.length === 0 && filteredShared.length === 0;

    return (
        <div className="min-h-screen bg-gray-50/60 text-gray-700">

            <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

                    <h1 className="text-lg font-semibold shrink-0 select-none">
                        <span className="text-violet-600">Sync</span>
                        <span className="text-gray-900">Board</span>
                    </h1>

                    <div className="hidden sm:flex flex-1 max-w-md mx-4">
                        <div className="relative w-full">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none">
                                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                            </svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search boards & folders…"
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-100 border border-transparent focus:bg-white focus:border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-violet-100 transition"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setShowProfile(true)}
                            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-50 transition cursor-pointer group"
                            title="Profile Settings"
                        >
                            {user.profileImage ? (
                                <img src={user.profileImage} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200 group-hover:border-violet-300 transition" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition">
                                    <span className="text-sm font-semibold text-violet-600">{user.username?.[0]?.toUpperCase() || '?'}</span>
                                </div>
                            )}
                            <span className="text-sm text-gray-600 hidden md:block max-w-[120px] truncate">{user.username}</span>
                        </button>
                        <div className="w-px h-6 bg-gray-200 hidden sm:block" />
                        <button
                            onClick={logout}
                            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                            title="Logout"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                                <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="sm:hidden px-4 pb-3">
                    <div className="relative w-full">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none">
                            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search…"
                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-100 border border-transparent focus:bg-white focus:border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none transition"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                {error && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-between text-sm animate-[slideDown_0.2s_ease]">
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            <span>{error}</span>
                        </div>
                        <button onClick={() => setError('')} className="ml-4 text-red-400 hover:text-red-600 cursor-pointer p-0.5 rounded hover:bg-red-100 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                        </button>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <nav className="flex items-center gap-1 text-sm flex-wrap min-w-0">
                        <button
                            onClick={goHome}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition cursor-pointer font-medium ${
                                draggedOverFolder === 'home'
                                    ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-300'
                                    : !currentFolder ? 'text-violet-700 bg-violet-50' : 'text-gray-500 hover:text-violet-600 hover:bg-gray-100'
                            }`}
                            onDragEnter={(e) => e.preventDefault()}
                            onDragOver={(e) => { e.preventDefault(); setDraggedOverFolder('home'); }}
                            onDragLeave={() => setDraggedOverFolder(null)}
                            onDrop={(e) => { e.preventDefault(); moveItem('home'); }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
                            </svg>
                            Home
                        </button>
                        {folderPath.map((f, i) => (
                            <span key={i} className="flex items-center gap-1"
                                onDragEnter={(e) => e.preventDefault()}
                                onDragOver={(e) => { e.preventDefault(); setDraggedOverFolder(f.id); }}
                                onDragLeave={() => setDraggedOverFolder(null)}
                                onDrop={(e) => { e.preventDefault(); moveItem(f.id); }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300 shrink-0 pointer-events-none">
                                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                </svg>
                                <span className={`px-1.5 py-0.5 rounded-md transition-all truncate max-w-[140px] ${
                                    draggedOverFolder === f.id ? 'bg-violet-100 ring-2 ring-violet-300 text-violet-700' : 'text-gray-600'
                                }`}>
                                    {f.name}
                                </span>
                            </span>
                        ))}
                        {currentFolder && (
                            <button onClick={goBack} className="ml-2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer" title="Go back">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                                </svg>
                            </button>
                        )}
                    </nav>

                    <CreatePopover currentFolder={currentFolder} onCreated={loadContents} />
                </div>

                {loading && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                                <div className="w-full aspect-[4/3] bg-gray-100" />
                                <div className="p-3 space-y-2">
                                    <div className="h-3.5 bg-gray-100 rounded w-3/4" />
                                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && filteredFolders.length > 0 && (
                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Folders</h2>
                            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{filteredFolders.length}</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                            {filteredFolders.map((folder) => (
                                <div
                                    key={folder._id}
                                    onClick={() => { if (editingFolder !== folder._id) openFolder(folder); }}
                                    className={`
                                        group relative bg-white border rounded-2xl hover:shadow-md transition-all cursor-pointer overflow-hidden
                                        ${draggedOverFolder === folder._id && draggedItem?.id !== folder._id
                                            ? 'border-violet-400 bg-violet-50/50 shadow-md ring-2 ring-violet-200 scale-[1.02]'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }
                                    `}
                                    draggable
                                    onContextMenu={(e) => e.preventDefault()}
                                    onDragStart={() => setDraggedItem({ type: 'folder', id: folder._id })}
                                    onDragEnd={() => { setDraggedItem(null); setDraggedOverFolder(null); }}
                                    onDragEnter={(e) => e.preventDefault()}
                                    onDragOver={(e) => { e.preventDefault(); setDraggedOverFolder(folder._id); }}
                                    onDragLeave={() => setDraggedOverFolder(null)}
                                    onDrop={(e) => { e.preventDefault(); moveItem(folder._id); }}
                                >
                                    <div className="w-full aspect-square flex items-center justify-center p-2 border-b border-gray-100">
                                        <img 
                                            src={folderIcon} 
                                            alt="Folder" 
                                            draggable={false}
                                            className="w-[85%] h-[85%] object-contain drop-shadow-sm translate-x-0.5 pointer-events-none select-none" 
                                        />
                                    </div>

                                    <div className="px-1.5 py-2 flex items-center justify-center min-h-[36px]">
                                        {editingFolder === folder._id ? (
                                            <InlineRename
                                                defaultValue={folder.name}
                                                onSave={(val) => renameFolder(folder._id, val)}
                                                onCancel={() => setEditingFolder(null)}
                                            />
                                        ) : (
                                            <div className="w-full text-center px-1">
                                                <p className="text-xs font-medium text-gray-800 truncate">
                                                    {folder.name}
                                                </p>
                                                {folder.path && (
                                                    <p className="text-[10px] text-gray-400 truncate mt-0.5" title={folder.path}>
                                                        <Folder className="w-3 h-3 inline mr-0.5 -mt-px" /> {folder.path}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {editingFolder !== folder._id && (
                                        <div className="absolute top-1.5 right-1.5 block">
                                            <KebabMenu
                                                items={[
                                                    { label: 'Rename', icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => { setEditingFolder(folder._id); setEditingBoard(null); } },
                                                    { divider: true },
                                                    { label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5 text-red-500" />, danger: true, onClick: () => setItemToDelete({ type: 'folder', id: folder._id, name: folder.name }) },
                                                ]}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {!loading && filteredFolders.length > 0 && (filteredBoards.length > 0 || filteredShared.length > 0) && (
                    <div className="w-full h-px bg-gray-200/80 my-8"></div>
                )}

                {!loading && filteredBoards.length > 0 && (
                    <section className="mb-8">
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Boards</h2>
                                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{filteredBoards.length}</span>
                            </div>
                            <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg p-0.5 gap-0.5 shadow-sm">
                                {[
                                    { key: 'name', label: 'Name' },
                                    { key: 'updatedAt', label: 'Updated' },
                                    { key: 'createdAt', label: 'Created' },
                                ].map((opt) => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setSortBy(opt.key)}
                                        className={`
                                            px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer
                                            ${sortBy === opt.key
                                                ? 'bg-violet-50 text-violet-700 shadow-sm'
                                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                            }
                                        `}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                                <div className="w-px h-4 bg-gray-200 mx-0.5" />
                                <button
                                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                    className="p-1 rounded-md text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-all cursor-pointer"
                                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                                >
                                    {sortOrder === 'asc' ? (
                                        <ArrowUp className="w-3 h-3 text-violet-500" />
                                    ) : (
                                        <ArrowDown className="w-3 h-3 text-violet-500" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {filteredBoards.map((board) => (
                                <div
                                    key={board._id}
                                    className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-violet-300 hover:shadow-md transition-all cursor-pointer"
                                    onClick={() => navigate(`/board/${board._id}`)}
                                    draggable
                                    onContextMenu={(e) => e.preventDefault()}
                                    onDragStart={(e) => { e.stopPropagation(); setDraggedItem({ type: 'board', id: board._id }); }}
                                    onDragEnd={() => { setDraggedItem(null); setDraggedOverFolder(null); }}
                                >
                                    {editingBoard === board._id ? (
                                        <div className="p-4">
                                            <InlineRename
                                                defaultValue={board.name}
                                                onSave={(val) => renameBoard(board._id, val)}
                                                onCancel={() => setEditingBoard(null)}
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            {board.thumbnail ? (
                                                <img 
                                                    src={board.thumbnail} 
                                                    alt={board.name}
                                                    draggable={false} 
                                                    className="w-full aspect-[4/3] bg-gray-50 border-b border-gray-100 object-contain pointer-events-none select-none" 
                                                />
                                            ) : (
                                                <div className="w-full aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-100 flex items-center justify-center">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-300 pointer-events-none">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                                                    </svg>
                                                </div>
                                            )}

                                            <div className="p-3">
                                                <p className="text-sm font-medium text-gray-800 truncate">{board.name}</p>
                                                {board.path && (
                                                    <p className="text-[10px] text-gray-400 truncate mt-0.5" title={board.path}>
                                                        <Folder className="w-3 h-3 inline mr-0.5 -mt-px" /> {board.path}
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(board.updatedAt)}</p>
                                            </div>
                                        </>
                                    )}

                                    {editingBoard !== board._id && (
                                        <div className="absolute top-2 right-2 block">
                                            <KebabMenu
                                                items={[
                                                    { label: 'Rename', icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => { setEditingBoard(board._id); setEditingFolder(null); } },
                                                    { divider: true },
                                                    { label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5 text-red-500" />, danger: true, onClick: () => setItemToDelete({ type: 'board', id: board._id, name: board.name }) },
                                                ]}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {!loading && filteredShared.length > 0 && !currentFolder && (
                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Shared with me</h2>
                            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{filteredShared.length}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {filteredShared.map((board) => (
                                <div
                                    key={board._id}
                                    className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-violet-300 hover:shadow-md transition-all cursor-pointer"
                                    onClick={() => navigate(`/board/${board._id}`)}
                                >
                                    {board.thumbnail ? (
                                        <img src={board.thumbnail} alt={board.name} className="w-full aspect-[4/3] bg-gray-50 border-b border-gray-100 object-contain" />
                                    ) : (
                                        <div className="w-full aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-100 flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-300">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                                            </svg>
                                        </div>
                                    )}
                                    <div className="p-3">
                                        <p className="text-sm font-medium text-gray-800 truncate">{board.name}</p>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            {board.owner?.profileImage ? (
                                                <img src={board.owner.profileImage} alt="" className="w-4 h-4 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full bg-violet-100 flex items-center justify-center">
                                                    <span className="text-[8px] font-bold text-violet-600">{board.owner?.username?.[0]?.toUpperCase() || '?'}</span>
                                                </div>
                                            )}
                                            <span className="text-xs text-gray-400 truncate">{board.owner?.username || 'unknown'}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">{timeAgo(board.updatedAt)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {!loading && isEmpty && (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-50 mb-5">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-violet-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                            </svg>
                        </div>
                        {searchQuery ? (
                            <>
                                <p className="text-lg font-medium text-gray-600 mb-1">No results for "{searchQuery}"</p>
                                <p className="text-sm text-gray-400">Try a different search term</p>
                            </>
                        ) : (
                            <>
                                <p className="text-lg font-medium text-gray-600 mb-1">Nothing here yet</p>
                                <p className="text-sm text-gray-400 mb-6">Create a folder or board to get started</p>
                                <div className="flex justify-center">
                                    <CreatePopover currentFolder={currentFolder} onCreated={loadContents} />
                                </div>
                            </>
                        )}
                    </div>
                )}
            </main>

            <Profile open={showProfile} onClose={() => setShowProfile(false)} />

            {itemToDelete && (
                <div 
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-[fadeIn_0.15s_ease]" 
                    onClick={() => setItemToDelete(null)}
                >
                    <div 
                        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-[slideDown_0.15s_ease]" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            
                            <h3 className="text-lg font-semibold text-gray-900">
                                Confirm {itemToDelete.type} deletion
                            </h3>
                        </div>
                        
                        <p className="text-sm text-gray-500 mb-6">
                            Are you sure you want to delete <span className="font-semibold text-gray-800">"{itemToDelete.name}"</span>? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setItemToDelete(null)}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition text-sm font-medium cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition text-sm font-medium cursor-pointer shadow-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}