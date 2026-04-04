import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api';

export default function Dashboard() {

    const { user, logout } = useAuth();
    const [folders, setFolders] = useState([]);
    const [boards, setBoards] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [folderPath, setFolderPath] = useState([]); // this is an array of folder ids that represents the path to the current folder, so we can easily navigate back up the folder tree
    const [newFolderName, setFolderName] = useState('');
    const [newBoardName, setBoardName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => { loadContents();} )

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
            await apiFetch('/boards', {method: 'POST', body: JSON.stringify({ name: newBoardName.trim(), folder: currentFolder})});
            setBoardName(''); 
            loadContents();
        } catch (err) {setError(err.error || "Failed to create board")}
    }

    async function renameFolder(e) {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        try {
            await apiFetch('/folders', {method: 'PUT', body: JSON.stringify({ name: newFolderName.trim(), parent: currentFolder})})
            setFolderName('');
            loadContents();
        } catch (err) {setError(err.error || "Failed to rename folder")}
    }

    async function renameBoard(e) {
        e.preventDefault();
        if (!newBoardName.trim()) return;
        try {
            await apiFetch('/boards', {method: 'PUT', body: JSON.stringify({ name: newBoardName.trim(), folder: currentFolder })});
            setBoardName(''); 
            loadContents();
        } catch (err) {setError(err.error || "Failed to rename board")}
    }

    async function deleteFolder(id) {
        try { await apiFetch(`/folders/${id}`, { method: 'DELETE'}); loadContents();}
        catch (err) {setError(err.error || "Failed to delete folder")}
    }

    async function deleteBoard(id) {
        try { await apiFetch(`/boards/${id}`, { method: 'DELETE'}); loadContents();}
        catch (err) {setError(err.error || "Failed to delete board")}
    }
    
    return (
        <div className="min-h-screen bg-gray-950 text-gray-300">
            <header className='flex items-center justify-between px-6 py-4 border-b border-gray-800'>
                <h1 className='text-xl font-semibold text-white'>SyncBoard</h1>
                <div className='flex items-center gap-3'>
                    <span>Welcome back, <b>{user.username}!</b></span>
                    <button onClick={logout} className='px-3 py-1.5 text-sm rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition cursor-pointer'>Logout</button>
                </div>
            </header>
            <main>
                <nav>
                    <button onClick={goHome}>Home</button>
                    {
                        folderPath.map((folder, i) => (
                            <span key={i}><span>/</span>{folder.name}</span>
                        ))
                    }
                </nav>

                {
                    currentFolder && (
                        <button onClick={goBack}>← Back </button>
                    )
                }

                <div>
                    <form onSubmit={createFolder}>
                        <input 
                            type="text" 
                            placeholder='New folder name' 
                            value={newFolderName} 
                            onChange={(e) => setFolderName(e.target.value)}
                        />
                        <button type="submit">+ Folder</button>
                    </form>
                </div>


                <div className='flex'>
                    {
                        folders.map((folder) => (
                            <div className='text-center' key={folder._id} onClick={() => openFolder(folder)}>
                                <span>📁</span><br></br>
                                <span>{folder.name}</span>
                            </div>
                        ))
                    }
                </div>
            </main>
        </div>
    );
}