import {useState, useEffect, useRef, useCallback } from "react";
import {Stage, Layer, Line } from "react-konva";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client"
import { Pencil, Eraser, Minus, Share2, Plus, Undo2, Redo2, Users, ArrowLeft, MessageCircle, Highlighter, Copy, Check, UserPlus, X } from "lucide-react";
import { apiFetch } from "../api";

const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

const UPDATE_INTERVAL = 16 // in ms (~60fps)
const NUM_MAX_UNDO = 32;
const PRESET_COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff'];

export default function Board({ shared = false }) {
    const {id, token} = useParams();

    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [tool, setTool] = useState("pen"); // pen, eraser, select and highlighter - we need to implement select
    const [brushColor, setBrushColor] = useState("#000000");
    const [highlighterColor, setHighlighterColor] = useState("#FBF719")
    const [board, setBoard] = useState(null);
    const [lines, setLines] = useState([]);
    const [editHistory, setEditHistory] = useState({ history: [], editIndex: -1});
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [eraserSize, setEraserSize] = useState(10);
    const [highlighterSize, setHighlighterSize] = useState(30);
    const [peers, setPeers] = useState(0);
    const [shareUrl, setShareUrl] = useState("");
    const [copied, setCopied] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareUsername, setShareUsername] = useState('');
    const [shareUserRole, setShareUserRole] = useState('viewer');
    const [shareUserMsg, setShareUserMsg] = useState('');
    const [lastUpdate, setLastUpdate] = useState(0);
    const [error, setError] = useState("");

    const navigate = useNavigate();

    const containerRef = useRef(null);
    const stageRef = useRef(null);
    const socketRef = useRef(null);
    const toolRef = useRef(tool);
    const eraserCursorRef = useRef(null);
    const linesRef = useRef(lines);
    const isDrawingRef = useRef(false);
    const activeLineRef = useRef(null);
    const activeLineDataRef = useRef(null);

    useEffect(() => {linesRef.current = lines}, [lines]);
    useEffect(() => {toolRef.current = tool}, [tool]);

    useEffect(() => {
        function onResize() {
            setStageSize({ width: window.innerWidth, height: window.innerHeight });
        }
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        if (tool === 'eraser') {
            const layer = stageRef.current?.findOne('.draw-layer');
            if (layer) {
                layer.getChildren().forEach(line => {
                    line.hitStrokeWidth(eraserSize);
                });
            }
        }
    }, [eraserSize, tool]); 

    {/* socket.io initialization*/}
    useEffect(() => {
        async function init() {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            let boardData;
            try {
                if (shared) {
                    boardData = await apiFetch(`/boards/share/${token}`);
                    setRole(boardData.role || 'viewer');
                    setBoard(boardData.board);
                    setLines(boardData.board?.content || []);
                } else {
                    boardData = await apiFetch(`/boards/${id}`);
                    setBoard(boardData);
                    setLines(boardData.content || []);
                }
            } catch (error) {
                console.error("Failed to fetch board data:", error);
                navigate('/');
                return;
            }
            
            const sock = io(SOCKET_URL, {
                auth: {
                    token: localStorage.getItem("token"),
                    shareToken: shared ? token : null
                },
            });
            socketRef.current = sock;

            sock.on('connect', () => {
                sock.emit('board:join', { boardId: shared ? token : id});
            });

            sock.on('board:load', ({lines: l, peers: p, role: r}) => {
                setLines(l);
                setPeers(p);
                if (r) setRole(r);
            });

            sock.on('board:peers', (count) => setPeers(count));

            sock.on('board:draw:line', (line) => {
                setLines((prev) => {
                    const oldLine = prev.find(l => l.id === line.id);
                    if (oldLine) {
                        const updated = [...prev];
                        const index = updated.indexOf(oldLine);
                        updated[index] = line;
                        return updated;
                    }
                    else return [...prev, line];
                });
            })

            sock.on('board:draw:erase', (lineId) => {
                setLines((prev) => prev.filter((l) => l.id !== lineId));
                
            });

            sock.on('board:draw:undo', (data_payload) => {
                if (!data_payload) return;
                const {lineId, op, line} = data_payload;
                if (op === 'draw') setLines((prev) => prev.filter((l) => l.id !== lineId));
                else setLines((prev) => prev.some(l => l.id === line.id) ? prev : [...prev, line]);
            });

            sock.on('board:draw:redo', (data_payload) => {
                if (!data_payload) return;
                const {lineId, op, line} = data_payload;
                if (op === 'draw') setLines((prev) => prev.some(l => l.id === line.id) ? prev : [...prev, line]);
                else setLines((prev) => prev.filter((l) => l.id !== lineId));
            });

            sock.on('error', (message) => {
                console.error("Socket error:", message);
                setError(message);
            });

            sock.on('board:kicked', () => {
                sock.disconnect();
                navigate('/');
            });

        }

        init();
        return () => { socketRef.current?.disconnect(); }
    }, [id, token, shared]);

    const [role, setRole] = useState('editor'); // editor or viewer

    const canDraw = (role === 'editor');

    const handlePointerDown = useCallback((e) => {
        if (!canDraw || e.evt.button !== 0) return;
        isDrawingRef.current = true;

        const pos = stageRef.current.getPointerPosition();
        if (toolRef.current === 'eraser') {
            const shape = stageRef.current.getIntersection(pos);
            if (shape && shape.getClassName() === 'Line') {
                const lineId = shape.id();
                const lineData = linesRef.current?.find(l => l.id === lineId);
                
                if (lineData) {
                    setLines((prev) => prev.filter((l) => l.id !== lineId));
                    
                    setEditHistory((prev) => {

                        if (prev.history.some(item => item.op === 'erase' && item.line.id === lineId)) {
                            return prev;
                        }

                        let newHistory;

                        if (prev.history.length < NUM_MAX_UNDO) {
                            newHistory = [...prev.history.slice(0, prev.editIndex + 1), { line: lineData, op: "erase" }];
                        }
                        else newHistory = [...prev.history.slice(1, prev.editIndex + 1), { line: lineData, op: "erase" }];

                        return {history: newHistory, editIndex: newHistory.length - 1};
                    });
                    socketRef.current?.emit('board:draw:erase', lineId);
                }
            }
            return;
        }

        {/* wtf is this id? HAHAHAHHAHAHA */}
        const newLine = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, 
            points: [pos.x, pos.y, pos.x, pos.y],
            color: (toolRef.current == 'highlighter') ? highlighterColor : brushColor,
            strokeWidth: (toolRef.current === 'highlighter') ? highlighterSize : strokeWidth,
            opacity: (toolRef.current === 'highlighter') ? 0.3 : 1,
            globalCompositeOperation: 'source-over',
        };
        
        activeLineDataRef.current = newLine;

        if (activeLineRef.current) {
            activeLineRef.current.points(newLine.points);
            activeLineRef.current.stroke(newLine.color);
            activeLineRef.current.strokeWidth(newLine.strokeWidth);
            activeLineRef.current.opacity(newLine.opacity)
            activeLineRef.current.globalCompositeOperation(newLine.globalCompositeOperation);
            activeLineRef.current.show();
            activeLineRef.current.getLayer().batchDraw();
        }

    }, [canDraw, brushColor, highlighterColor, strokeWidth, highlighterSize]);


    const handlePointerMove = useCallback((e) => {
        if (!canDraw) return;

        if (eraserCursorRef.current) {
            eraserCursorRef.current.style.left = `${e.evt.clientX}px`;
            eraserCursorRef.current.style.top = `${e.evt.clientY}px`;
        }

        if (!isDrawingRef.current) return;

        const pos = stageRef.current.getPointerPosition();

        if (toolRef.current === 'eraser') {
            const shape = stageRef.current.getIntersection(pos);
            if (shape && shape.getClassName() === 'Line') {
                const lineId = shape.id();
                const lineData = linesRef.current?.find(l => l.id === lineId);
                
                if (lineData) {
                    setLines((prev) => prev.filter((l) => l.id !== lineId));
                    
                    setEditHistory((prev) => {

                        if (prev.history.some(item => item.op === 'erase' && item.line.id === lineId)) {
                            return prev;
                        }

                        let newHistory;

                        if (prev.history.length < NUM_MAX_UNDO) {
                            newHistory = [...prev.history.slice(0, prev.editIndex + 1), { line: lineData, op: "erase" }];
                        }
                        else newHistory = [...prev.history.slice(1, prev.editIndex + 1), { line: lineData, op: "erase" }];

                        return {history: newHistory, editIndex: newHistory.length - 1};
                    });
                    socketRef.current?.emit('board:draw:erase', lineId);
                }
            }
            return;
        }

        if (!activeLineDataRef.current) return;

        activeLineDataRef.current.points.push(pos.x, pos.y);

        if (activeLineRef.current) {
            activeLineRef.current.points(activeLineDataRef.current.points);
            activeLineRef.current.getLayer().batchDraw();
        }

        const now = Date.now();
        if (now - lastUpdate > UPDATE_INTERVAL) {
            socketRef.current?.emit('board:draw:tmpline', activeLineDataRef.current); // update line in real time!
            setLastUpdate(now);
        }

    }, [canDraw]);

    const handlePointerUp = useCallback(() => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;

        if (toolRef.current === 'eraser') return;

        const finishedLine = activeLineDataRef.current;
        if (!finishedLine) return;

        if (toolRef.current === 'highlighter') finishedLine.globalCompositeOperation = 'multiply';

        setLines((prev) => [...prev, finishedLine]);
        linesRef.current = [...(linesRef.current || []), finishedLine];

        if (activeLineRef.current) {
            activeLineRef.current.hide();
            activeLineRef.current.getLayer().batchDraw();
        }

        activeLineDataRef.current = null;
           
        setEditHistory((prev) => {

            let newHistory;

            if (prev.history.length < NUM_MAX_UNDO) {
                newHistory = [...prev.history.slice(0, prev.editIndex + 1), { line: finishedLine, op: "draw" }];
            }
            else newHistory = [...prev.history.slice(1, prev.editIndex + 1), { line: finishedLine, op: "draw" }]; 
            
            return {history: newHistory, editIndex: newHistory.length - 1};
        });

        socketRef.current?.emit('board:draw:line', finishedLine);
                 
    }, []);

    const handlePointerEnter = useCallback(() => {
        if (eraserCursorRef.current && toolRef.current === 'eraser') {
            eraserCursorRef.current.style.display = 'block';
        }
    }, []);

    const handlePointerLeave = useCallback(() => {
        if (eraserCursorRef.current) eraserCursorRef.current.style.display = 'none';
        handlePointerUp();
    }, [handlePointerUp]);

    {/* editHistory.history contains an array of objects {line, op} where op is either "draw" or "erase" */}
    const handleUndo = useCallback(() => {

            setEditHistory((prevHistory) => {

                if (prevHistory.history.length === 0 || prevHistory.editIndex === -1) return prevHistory;

                const curr_edit_indx = prevHistory.editIndex;
                const last_edit = prevHistory.history.at(curr_edit_indx); 

                if (last_edit.op === 'draw') {
                    setLines((prevLines) => prevLines.filter(l => l.id !== last_edit.line.id));
                    socketRef.current?.emit('board:draw:undo', { lineId: last_edit.line.id, op: 'draw' });
                } else {
                    setLines((prevLines) => {
                        if (prevLines.some(l => l.id === last_edit.line.id)) {
                            return prevLines;
                        }
                        return [...prevLines, last_edit.line]
                    });
                    socketRef.current?.emit('board:draw:undo', { lineId: last_edit.line.id, op: 'erase', line: last_edit.line });
                }
                const updatedHistory = {history: prevHistory.history, editIndex: prevHistory.editIndex - 1};

                return updatedHistory;
            });

        }, []);

    const handleRedo = useCallback(() => {

        setEditHistory((prevHistory) => {
        
            if (prevHistory.history.length === 0 || prevHistory.editIndex === prevHistory.history.length - 1) return prevHistory;
            const last_edit = prevHistory.history.at(prevHistory.editIndex + 1);
            if (last_edit.op === 'draw') {
                setLines((prevLines) => {
                    if (prevLines.some(l => l.id === last_edit.line.id))
                        return prevLines;
                    return [...prevLines, last_edit.line]  
                });  
                socketRef.current?.emit('board:draw:redo', { lineId: last_edit.line.id, op: 'draw', line: last_edit.line});
            }
            else {
                setLines((prevLines) => prevLines.filter(l => l.id !== last_edit.line.id));
                socketRef.current?.emit('board:draw:redo', { lineId: last_edit.line.id, op: 'erase'});
            }
            const updatedHistory = {history: prevHistory.history, editIndex: prevHistory.editIndex + 1};
            return updatedHistory;
        });
    }, []);

    async function generateShareLink(linkRole) {
        try {
            const data = await apiFetch(`/boards/${id}/share`, {
                method: 'POST',
                body: JSON.stringify({ role: linkRole }),
            });
            setShareUrl(`${window.location.origin}/board/share/${data.shareToken}`);
        } catch (err) {
            console.error("Failed to generate share link:", err);
            setError("Failed to generate share link");
            return;
        }
    }

    async function shareWithUser(e) {
        e.preventDefault();
        if (!shareUsername.trim()) return;
        try {
            const data = await apiFetch(`/boards/${id}/share/user`, {
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
            await apiFetch(`/boards/${id}/share/user/${userId}`, { method: 'DELETE' });
            setBoard(prev => ({ ...prev, sharedWith: prev.sharedWith.filter(s => (s.user._id || s.user) !== userId) }));
        } catch (err) {
            setError(err.error || 'Failed to remove user');
        }
    }

    function copyLink() {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    const activeSize = tool === 'eraser' ? eraserSize : tool === 'highlighter' ? highlighterSize : strokeWidth;
    const setActiveSize = (fn) => {
        switch (toolRef.current) {
            case 'pen':
                setStrokeWidth(fn);
                break;
            case 'highlighter':
                setHighlighterSize(fn);
                break;
            case 'eraser':
                setEraserSize(fn);
                break;
            default:
                console.error("[SyncBoard] Unknown tool selected!");
        }
    }
    const setColor = (fn) => (tool === 'highlighter') ? setHighlighterColor(fn) : setBrushColor(fn);               

    return (
        <div className="h-screen overflow-hidden relative bg-white">
            
            <div className="top-2 text-xl font-semibold absolute top-1 right-[50vw] translate-x-1/2 z-[1] pointer-events-none">
                <span className="text-violet-700/30">Sync</span>
                <span className="text-black/30">Board</span>
            </div>

                {/* onMouseEnter has to be a mouse event because react decided so (why do PointerDown, Move, Up and Leave work though but not pointer enter, is my question?) */}
            <Stage 
                    ref={stageRef}
                    width={stageSize.width}
                    height={stageSize.height}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onMouseEnter={handlePointerEnter} 
                    onMouseLeave={handlePointerLeave}
                    style={{
                        cursor: tool === 'eraser' ? 'none' : (canDraw ? 'crosshair' : 'default'),
                        display:'block'
                    }}
            >
                <Layer name="draw-layer">
                    {lines.map((line) => (
                        <Line
                            key={line.id}
                            id={line.id}
                            points={line.points}
                            stroke={line.color}
                            strokeWidth={line.strokeWidth}
                            opacity={line.opacity}
                            hitStrokeWidth={line.hitStrokeWidth}
                            tension={0.3}
                            globalCompositeOperation={line.globalCompositeOperation}
                            lineCap="round"
                            lineJoin="round"
                            listening={true}
                        />
                    ))}
                        <Line
                            ref={activeLineRef}
                            tension={0.3}
                            lineCap="round"
                            lineJoin="round"
                            listening={false}
                            visible={false}
                        />
                </Layer>
            </Stage>
            
            <div
                ref={eraserCursorRef}
                className="fixed pointer-events-none rounded-full border-2 border-gray-400 bg-white"
                style={{
                    width: eraserSize,
                    height: eraserSize,
                    display: tool === 'eraser' ? 'block' : 'none',
                    transform: 'translate(-50%, -50%)',
                }}
            />

            <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-auto">
                <button onClick={() => navigate('/')} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 shadow-sm transition cursor-pointer hover:bg-gray-50 hover:text-gray-900">
                    <ArrowLeft size={14} />
                </button>

                <div className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 font-medium shadown-sm max-w-xs truncate">
                    {board?.name || "Board name"}
                </div>
                {
                    role === 'viewer' && (
                        <span className="px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-500 shadow-sm">
                            View Only
                        </span>
                    )
                }
            </div>

            <div className="absolute top-2 right-2 flex items-center gap-2 pointer-events-auto">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-500 shadow-sm">
                    <Users size={14} />
                    <span>{peers}</span>
                </div>
                {!shared && (
                    <button onClick={() => setShowShareModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 shadow-sm transition cursor-pointer"
                    >
                        <Share2 size={14} />
                        Share
                    </button>
                )}
            </div>

            <div className="absolute bottom-2 right-2 flex items-center gap-2 pointer-events-auto">
                <button className="py-2 px-8 rounded-xl bg-white border border-gray-200 text-gray-600 shadow-sm transition cursor-pointer hover:bg-gray-50 hover:text-gray-900">
                    <MessageCircle size={18} />
                </button>
            </div>

            <div>
                {canDraw && (
                    <div className="absolute bottom-6 left-1/2 bg-white flex items-center gap-1 px-3 py-2 -translate-x-1/2 border border-gray-200 rounded-2xl backdrop-blur-md shadow-2xl">
                        <ToolButton
                            active={tool === "pen"}
                            onClick={() => setTool("pen")}
                            title="Pen"
                        >
                            <Pencil size={18} /> 
                        </ToolButton>

                        <ToolButton
                            active={tool === "highlighter"}
                            onClick={() => setTool("highlighter")}
                            title="highlighter"
                        >
                            <Highlighter size={18} />
                        </ToolButton>

                        <ToolButton
                            active={tool === "eraser"}
                            onClick={() => setTool("eraser")}
                            title="Eraser"
                        >
                            <Eraser size={18} />
                        </ToolButton>

                        <div className="w-px h-6 bg-gray-300 mx-1"></div>

                        {
                            PRESET_COLORS.map((c) => (
                                <button 
                                    key={c}
                                    onClick={() => {setColor(c);}}
                                    title={c}
                                    className="w-6 h-6 rounded-full border-2 transition cursor-pointer hover:scale-110"
                                    style={{
                                        background: c,
                                        borderColor: `color-mix(in srgb, ${c}, black 30%)`,
                                        outline: c === '#ffffff' ? "1px solid #d1d5db" : "none",
                                    }}
                                />
                            ))
                        }

                        <label className="relative w-7 h-7 cursor-pointer" title="Color">
                            <div className="w-7 h-7 rounded-full border-2 transition hover:scale-110"
                                style={{
                                    background: tool === 'highlighter' ? highlighterColor : brushColor,
                                    borderColor: `color-mix(in srgb, ${tool === 'highlighter' ? highlighterColor : brushColor}, black 30%)`
                                }}
                            >
                            </div>
                            <input type="color" value={tool === 'highlighter' ? highlighterColor : brushColor} onChange={(e) => { setColor(e.target.value); }} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                        </label>

                        <div className="w-px h-6 bg-gray-300 mx-1"></div>

                        <button
                            onClick={() => setActiveSize((s) => Math.max(1, s - ((tool === 'eraser' || tool === 'highlighter') ? 5 : 1)))}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg cursor-pointer transition"
                        >
                            <Minus size={14} />
                        </button>

                        <div className="flex items-center justify-center w-7">
                            <div className="rounded-full bg-gray-800" style={{
                                    width: Math.min(activeSize * ((tool === 'eraser' || tool === 'highlighter') ? 0.7 : 2.5), 22),
                                    height: Math.min(activeSize * ((tool === 'eraser' || tool === 'highlighter') ? 0.7 : 2.5), 22),
                                }}>
                                
                            </div>
                        </div>

                        <button
                            onClick={() => setActiveSize((s) => Math.min((tool === 'eraser' || tool === 'highlighter') ? 80 : 30, s + ((tool === 'eraser' || tool === 'highlighter') ? 5 : 1)))}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg cursor-pointer transition"
                        >
                            <Plus size={14} />
                        </button>

                        <div className="w-px h-6 bg-gray-300 mx-1"></div>

                        <ToolButton title="Undo" disabled = {editHistory.history.length === 0 || editHistory.editIndex === -1} onClick={handleUndo}>
                            <Undo2 size={18} />
                        </ToolButton>

                        <ToolButton title="Redo" disabled = {editHistory.history.length === 0 || editHistory.editIndex === editHistory.history.length - 1} onClick={handleRedo}>
                            <Redo2 size={18} />
                        </ToolButton>
                    </div>
                )}
            </div>

            {showShareModal && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
                    onClick={() => { setShowShareModal(false); setShareUrl(''); setShareUserMsg(''); }}
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

                        <button
                            onClick={() => { setShowShareModal(false); setShareUrl(''); setShareUserMsg(''); }}
                            className="mt-2 w-full py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-900 transition text-sm cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ToolButton({children, active, onClick, title, disabled}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`p-2 rounded-xl transition cursor-pointer 
                ${active ? "bg-violet-100 text-violet-700 cursor-pointer" : ""}
                ${disabled ? "opacity-30 cursor-not-allowed" : ""}
            `}
        >
            {children}
        </button>
    )
}