import {useState, useEffect, useRef, useCallBack, useCallback } from "react";
import {Stage, Layer, Line } from "react-konva";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client"
import { Pencil, Eraser, Home, Menu, Minus, Share2, Plus, Undo2, Users, ArrowLeft } from "lucide-react";

const SOCKET_URL = "http://localhost:3001";
const socket = io(SOCKET_URL);

const NUM_MAX_UNDO = 32;
const PRESET_COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff'];

export default function Board({ shared = false}) {
    const {id, token} = useParams();

    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState("pen"); // pen, eraser, select
    const [color, setColor] = useState("#000000");
    const [board, setBoard] = useState(null);
    const [lines, setLines] = useState([]);
    const [lastModifiedLines, setLastModifiedLines] = useState([]);
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [eraserSize, setEraserSize] = useState(10);
    const [peers, setPeers] = useState(0);
    const [shareUrl, setShareUrl] = useState("");
    const [copied, setCopied] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [error, setError] = useState("");

    const navigate = useNavigate();

    const containerRef = useRef(null);
    const stageRef = useRef(null);
    const socketRef = useRef(null);
    const toolRef = useRef(tool);
    const eraserCursorRef = useRef(null);
    const linesRef = useRef(lines);
    const isDrawingRef = useRef(false);

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

    const [role, setRole] = useState('editor'); // editor or viewer

    const canDraw = (role === 'editor');

    const handlePointerDown = useCallback((e) => {
        if (!canDraw || e.evt.button !== 0) return;
        isDrawingRef.current = true;

        const pos = stageRef.current.getPointerPosition();
        if (toolRef.current === 'eraser') {
            const shape = stageRef.current.getIntersection(pos);
            if (shape && shape.getClassName() === 'Line'){
                const lineId = shape.id();
                const lineData = linesRef.current?.find(l => l.id === lineId);
                
                if (lineData) {
                    setLines((prev) => prev.filter((l) => l.id !== lineId));
                    
                    setLastModifiedLines((prev) => {

                        if (prev.some(item => item.op === 'erase' && item.line.id === lineId)) {
                            return prev;
                        }

                        if (prev.length < NUM_MAX_UNDO) {
                            return [...prev, { line: lineData, op: "erase" }];
                        }
                        return [...prev.slice(1), { line: lineData, op: "erase" }];
                    });
                    // socket to add
                }
            }
            return;
        }

        {/* wtf is this id? HAHAHAHHAHAHA */}
        const newLine = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, 
            points: [pos.x, pos.y, pos.x, pos.y],
            color,
            strokeWidth,
        };
        setLines((prev) => [...prev, newLine]);
    }, [canDraw, color, strokeWidth]);


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
            if (shape && shape.getClassName() === 'Line'){
                const lineId = shape.id();
                const lineData = linesRef.current?.find(l => l.id === lineId);
                
                if (lineData) {
                    setLines((prev) => prev.filter((l) => l.id !== lineId));
                    
                    setLastModifiedLines((prev) => {

                        if (prev.some(item => item.op === 'erase' && item.line.id === lineId)) {
                            return prev;
                        }

                        if (prev.length < NUM_MAX_UNDO) {
                            return [...prev, { line: lineData, op: "erase" }];
                        }
                        return [...prev.slice(1), { line: lineData, op: "erase" }];
                    });
                    // socket to add
                }
            }
            return;
        }

        setLines((prev) => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1]};
            last.points = [ ...last.points, pos.x, pos.y ];
            updated[updated.length - 1] = last;
            return updated;
            });
    }, [canDraw]);

    const handlePointerUp = useCallback(() => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;

        if (toolRef.current !== 'eraser') {
            const lastLine = linesRef.current[linesRef.current.length - 1];
            if (lastLine) {
                setLastModifiedLines((prev) => {

                    if (prev.length < NUM_MAX_UNDO) {
                        return [...prev, { line: lastLine, op: "draw" }];
                    }
                    return [...prev.slice(1), { line: lastLine, op: "draw" }];
                });
                socketRef.current?.emit('draw:line', lastLine);
            }
        }
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

    {/* lastModifiedLines contains an array of objects {line, op} where op is either "draw" or "erase" */}
    const handleUndo = useCallback(() => {
        setLastModifiedLines((prevHistory) => {
            if (prevHistory.length === 0) return prevHistory;

            const newHistory = [...prevHistory];
            const last_edit = newHistory.pop(); 

            if (last_edit.op === 'draw') {
                setLines((prevLines) => prevLines.filter(l => l.id !== last_edit.line.id));

            } else {
                setLines((prevLines) => {
                    if (prevLines.some(l => l.id === last_edit.line.id)) {
                        return prevLines;
                    }
                    return [...prevLines, last_edit.line]
                });
            
            }
            return newHistory;
        });
    });

    const activeSize = (tool === 'eraser') ? eraserSize : strokeWidth;
    const setActiveSize = (tool === 'eraser') ? (fn) => setEraserSize(fn) : (fn) => setStrokeWidth(fn);                                    

    return (
        <div className="h-screen overflow-hidden relative bg-white">
            <div className="bg-gray-100 flex items-center w-full px-2 py-2 shadow-xl backdrop-blur-md border border-gray-200">
                <Home className="cursor-pointer"size={18}/>
                <div className="w-px h-6 bg-gray-300 mx-2"></div>
                <div className="font-light">myboard</div>
                <Menu className="cursor-pointer absolute top-2.5 right-2" size={18} />
            </div>

            <div className="text-2xl font-semibold absolute top-1 right-[50vw] translate-x-1/2">
                <span className="text-violet-700">Sync</span>
                <span className="text-black">Board</span>
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
                            hitStrokeWidth={line.hitStrokeWidth}
                            tension={0.3}
                            lineCap="round"
                            lineJoin="round"
                            listening={true}
                        />
                    ))}
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

            <div className="absolute top-13 left-2 flex items-center gap-2 pointer-events-auto">
                {!shared && (
                    <button onClick={() => navigate('/')} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 shadow-sm transition cursor-pointer hover:bg-gray-50 hover:text-gray-900">
                        <ArrowLeft size={14} />
                    </button>
                )}
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

            <div className="absolute top-13 right-2 flex items-center gap-2 pointer-events-auto">
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
                            active={tool === "eraser"}
                            onClick={() => setTool("eraser")}
                            title="Eraser"
                        >
                            <Eraser size={18} />
                        </ToolButton>

                        <div className="w-px h-6 bg-gray-300 mx-1"></div>

                        {
                            PRESET_COLORS.map((c) => {
                                <button 
                                    key={c}
                                    onClick={() => {setColor(c); setTool('pen'); }}
                                    title={c}
                                    className="w-6 h-6 rounded-full border-2 transition cursor-pointer hover:scale-110"
                                    style={{
                                        background: c,
                                        borderColor: color === c && tool === 'pen' ? '#7c3aed' : "transparent",
                                        outline: c === '#ffffff' ? "1px solid #d1d5db" : "none",
                                    }}
                                />
                            })
                        }

                        <label className="relative w-6 h-6 cursor-pointer" title="Color">
                            <div className="w-6 h-6 rounded-full border-2 transition hover:scale-110"
                                style={{
                                    background: color,
                                    borderColor: `color-mix(in srgb, ${color}, black 30%)`
                                }}
                            >
                            </div>
                            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setTool('pen'); }} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                        </label>

                        <div className="w-px h-6 bg-gray-300 mx-1"></div>

                        <button
                            onClick={() => setActiveSize((s) => Math.max(1, s - (tool === 'eraser' ? 5 : 1)))}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg cursor-pointer transition"
                        >
                            <Minus size={14} />
                        </button>

                        <div className="flex items-center justify-center w-7">
                            <div className="rounded-full bg-gray-800" style={{
                                    width: Math.min(activeSize * (tool === 'eraser' ? 0.7 : 2.5), 22),
                                    height: Math.min(activeSize * (tool === 'eraser' ? 0.7 : 2.5), 22),
                                }}>
                                
                            </div>
                        </div>

                        <button
                            onClick={() => setActiveSize((s) => Math.min(tool === 'eraser' ? 80 : 30, s + (tool === 'eraser' ? 5 : 1)))}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg cursor-pointer transition"
                        >
                            <Plus size={14} />
                        </button>

                        <div className="w-px h-6 bg-gray-300 mx-1"></div>

                        <ToolButton title="Undo" disabled = {lastModifiedLines.length === 0}>
                            <Undo2 size={18} onClick={handleUndo}/>
                        </ToolButton>
                    </div>
                )}
            </div>

            {showShareModal && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
                    onClick={() => { setShowShareModal(false); setShareUrl(''); }}
                >
                    <div
                        className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-gray-900 font-semibold text-lg mb-1">Share board</h2>
                        <p className="text-gray-500 text-sm mb-4">Viewers watch in real-time. Editors can draw.</p>
                        <div className="flex gap-2 mb-4">
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
                            <div className="flex gap-2">
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
                        <button
                            onClick={() => { setShowShareModal(false); setShareUrl(''); }}
                            className="mt-4 w-full py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-900 transition text-sm cursor-pointer"
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