import {useState, useEffect, useRef, useCallback, Fragment } from "react";
import {Stage, Layer, Line, Circle } from "react-konva";
import { useParams, useNavigate, data } from "react-router-dom";
import { io } from "socket.io-client"
import { Pencil, Eraser, Minus, Share2, Plus, Undo2, Redo2, Users, ArrowLeft, MessageCircle, Highlighter, Copy, Check, UserPlus, X, Shapes, Triangle, Square, Circle as CircleIcon, PaintBucket, Download, FileText, LassoSelect } from "lucide-react";
import { apiFetch } from "../api";
import { jsPDF } from "jspdf";
import Konva from 'konva';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

const UPDATE_INTERVAL = 16
const NUM_MAX_UNDO = 32;
const MIN_POINT_DISTANCE = 3;
const PRESET_COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff'];

const hexToRgba = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

function smoothPoints(pts, iterations = 2) {
    if (pts.length < 6) return pts;
    let smoothed = [...pts];
    for (let iter = 0; iter < iterations; iter++) {
        const next = [smoothed[0], smoothed[1]];
        for (let i = 2; i < smoothed.length - 2; i += 2) {
            next.push(
                0.25 * smoothed[i - 2] + 0.5 * smoothed[i] + 0.25 * smoothed[i + 2],
                0.25 * smoothed[i - 1] + 0.5 * smoothed[i + 1] + 0.25 * smoothed[i + 3]
            );
        }
        next.push(smoothed[smoothed.length - 2], smoothed[smoothed.length - 1]);
        smoothed = next;
    }
    return smoothed;
}

export default function Board({ shared = false }) {
    const {id, token} = useParams();

    const [scale, setScale] = useState(1);
    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [tool, setTool] = useState("pen"); // pen, eraser, select and highlighter - we need to implement select
    const [brushColor, setBrushColor] = useState("#000000");
    const [highlighterColor, setHighlighterColor] = useState("#eab308")
    const [shapeColor, setShapeColor] = useState("#3b82f6");
    const [shapeBorderColor, setShapeBorderColor] = useState("#000000");
    const [shapeFillOpacity, setShapeFillOpacity] = useState(1);
    const [shapeBorderOpacity, setShapeBorderOpacity] = useState(1);
    const [fillShape, setFillShape] = useState(false);
    const [selectedShapeMenu, setSelectedShapeMenu] = useState(false);
    const [board, setBoard] = useState(null);
    const [lines, setLines] = useState([]);
    const [shape, setShape] = useState('');
    const [editHistory, setEditHistory] = useState({ history: [], editIndex: -1});
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [shapeWidth, setShapeWidth] = useState(5);
    const [eraserSize, setEraserSize] = useState(10);
    const [highlighterSize, setHighlighterSize] = useState(30);
    const [highlighterOpacity, setHighlighterOpacity] = useState(0.3);
    const [selectedHighlighterMenu, setSelectedHighlighterMenu] = useState(false);
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
    const shapeRef = useRef(shape);
    const eraserCursorRef = useRef(null);
    const linesRef = useRef(lines);
    const isDrawingRef = useRef(false);
    const activeLineRef = useRef(null);
    const activeLineDataRef = useRef(null);
    const activeCircleFillRef = useRef(null);
    const activeCircleStrokeRef = useRef(null);

    const touchCountRef = useRef(0);
    const lastTouchCenterRef = useRef(null);
    const lastPinchDistRef = useRef(null);

    const isPanningRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const stagePositionRef = useRef({ x: 0, y: 0 });

    useEffect(() => {linesRef.current = lines}, [lines]);
    useEffect(() => {toolRef.current = tool}, [tool]);
    useEffect(() => {shapeRef.current = shape}, [shape]);

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

    useEffect(() => {
        const container = stageRef.current?.container();
        if (!container) return;

        const handleTouchStart = (e) => {
            touchCountRef.current = e.touches.length;
            if (e.touches.length >= 2) {
                isDrawingRef.current = false;
                activeLineDataRef.current = null;
                if (activeLineRef.current) activeLineRef.current.hide();

                isPanningRef.current = true;
                const t1 = e.touches[0], t2 = e.touches[1];
                lastTouchCenterRef.current = {
                    x: (t1.clientX + t2.clientX) / 2,
                    y: (t1.clientY + t2.clientY) / 2,
                };

                lastPinchDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            }
        };

        const handleTouchMove = (e) => {
            if (e.touches.length >= 2) {
                e.preventDefault();
                const t1 = e.touches[0], t2 = e.touches[1];
                const center = {
                    x: (t1.clientX + t2.clientX) / 2,
                    y: (t1.clientY + t2.clientY) / 2,
                };
                const stage = stageRef.current;
                const oldScale = stage.scaleX();

                // const dx = center.x - lastTouchCenterRef.current.x;
                // const dy = center.y - lastTouchCenterRef.current.y;
                // const newPos = {x : stage.x() + dx, y: stage.y() + dy};
                // stage.position(newPos);
                // stagePositionRef.current = newPos;

                const pointTo = {
                    x: (lastTouchCenterRef.current.x - stage.x()) / oldScale,
                    y: (lastTouchCenterRef.current.y - stage.y()) / oldScale,
                };

                const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

                const newScale = lastPinchDistRef.current ? Math.max(0.1, Math.min(10, oldScale * (dist / lastPinchDistRef.current))) : oldScale;
                stage.scale({ x: newScale, y: newScale });
                setScale(newScale);

                const newPos = {
                    x: center.x - pointTo.x * newScale,
                    y: center.y - pointTo.y * newScale,
                };

                stage.position(newPos);
                stagePositionRef.current = newPos;
                lastTouchCenterRef.current = center;
                lastPinchDistRef.current = dist;

                // if (lastPinchDistRef.current) {
                //     const scaleBy = dist / lastPinchDistRef.current;
                //     const oldScale = stage.scaleX();
                //     const newScale = Math.max(0.1, Math.min(10, oldScale * scaleBy));
                //     const mousePointTo = {
                //         x: (center.x - stage.x()) / oldScale,
                //         y: (center.y - stage.y()) / oldScale,
                //     };
                //     stage.scale({ x: newScale, y: newScale });
                //     setScale(newScale);
                //     const zoomPos = {
                //         x: center.x - mousePointTo.x * newScale,
                //         y: center.y - mousePointTo.y * newScale,
                //     };
                //     stage.position(zoomPos);
                //     stagePositionRef.current = zoomPos;
                // }
            }
        };

        const handleTouchEnd = (e) => {
            touchCountRef.current = e.touches.length;
            if (e.touches.length < 2) {
                isPanningRef.current = false;
                lastPinchDistRef.current = null;
                lastTouchCenterRef.current = null;
            }
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: false });
        container.addEventListener('touchcancel', handleTouchEnd);
        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, []);

    const [role, setRole] = useState('editor'); // editor or viewer

    const canDraw = (role === 'editor');

    const handlePointerDown = useCallback((e) => {
        if (touchCountRef.current >= 2 || isPanningRef.current) return;
        if (e.evt.button === 1) {
            e.evt.preventDefault();
            isPanningRef.current = true;
            const stage = stageRef.current;
            panStartRef.current = {
                x: e.evt.clientX - stage.x(),
                y: e.evt.clientY - stage.y(),
            };
            stage.container().style.cursor = 'grabbing';
            if (eraserCursorRef.current) eraserCursorRef.current.style.display = 'none';
            return;
        }
        if (e.evt.pointerType === 'touch') return;

        if (!canDraw || e.evt.button !== 0) return;
        e.evt.preventDefault();
        isDrawingRef.current = true;

        // const pos = stageRef.current.getPointerPosition();
        const stage = stageRef.current;
        const pointerPos = stage.getPointerPosition();
        let newLine = null;
        const pointerScale = stage.scaleX() || 1;

        if (toolRef.current === 'shape') {
            
            const pos = {
            x: (pointerPos.x - stage.x()) / pointerScale,
            y: (pointerPos.y - stage.y()) / pointerScale,
            };
            
            newLine = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, // ID cursed by Tutankhamon in 1320 B.C.
                type: (shapeRef.current === 'circle') ? 'circle' : 'line',
                points: [pos.x, pos.y, pos.x, pos.y],
                color: hexToRgba(shapeBorderColor, shapeBorderOpacity),
                fill: (fillShape && shapeRef.current !== 'line') ? hexToRgba(shapeColor, shapeFillOpacity) : '',
                strokeWidth: shapeWidth,
                globalCompositeOperation: 'source-over',
                closed: shapeRef.current !== 'line',
                useMultiply: (fillShape && shapeFillOpacity < 1 && shapeRef.current !== 'line'),
                tension: 0,
                lineCap: 'miter',
                lineJoin: 'miter'
            };
    
        }

        if (toolRef.current === 'eraser') {

            const shape = stageRef.current.getIntersection(pointerPos);
            if (shape && (shape.getClassName() === 'Line' || shape.getClassName() === 'Circle')) {
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

        const pos = {
            x: (pointerPos.x - stage.x()) / pointerScale,
            y: (pointerPos.y - stage.y()) / pointerScale,
        };

        if (!newLine) {
            newLine = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, // ID cursed by Tutankhamon in 1320 B.C.
                type: 'line', 
                points: [pos.x, pos.y, pos.x, pos.y],
                color: (toolRef.current == 'highlighter') ? highlighterColor :  brushColor,
                strokeWidth: (toolRef.current === 'highlighter') ? highlighterSize : strokeWidth,
                opacity: (toolRef.current === 'highlighter') ? highlighterOpacity : 1,
                globalCompositeOperation: 'source-over',
                closed: false,
                tension: 0.3,
                fill: '',
                lineCap: 'round',
                lineJoin: 'round'
            };
        }
        
        activeLineDataRef.current = newLine;

        const isCircle = toolRef.current === 'shape' && shapeRef.current === 'circle';

        if (isCircle) {

            if (activeCircleStrokeRef.current && activeCircleFillRef.current) {
                const sw = newLine.strokeWidth || 0;

                activeCircleStrokeRef.current.x(newLine.points[0]); 
                activeCircleStrokeRef.current.y(newLine.points[1]);
                activeCircleStrokeRef.current.radius(0); 
                activeCircleStrokeRef.current.stroke(newLine.color);
                activeCircleStrokeRef.current.strokeWidth(sw);
                activeCircleStrokeRef.current.opacity(newLine.opacity);
                activeCircleStrokeRef.current.globalCompositeOperation(newLine.globalCompositeOperation);
                activeCircleStrokeRef.current.show();
                
                if (newLine.fill) {
                    activeCircleFillRef.current.x(newLine.points[0]); 
                    activeCircleFillRef.current.y(newLine.points[1]);
                    activeCircleFillRef.current.radius(0); 
                    activeCircleFillRef.current.fill(newLine.fill);
                    activeCircleFillRef.current.opacity(newLine.opacity);
                    activeCircleFillRef.current.globalCompositeOperation(newLine.globalCompositeOperation);
                    activeCircleFillRef.current.show();
                    
                } else {
                    activeCircleFillRef.current.hide();
                }

                if (activeLineRef.current) activeLineRef.current.hide();
                
                activeCircleStrokeRef.current.getLayer().batchDraw();
            }

        } else {

            if (activeLineRef.current) {

                activeLineRef.current.points(newLine.points);
                
                activeLineRef.current.stroke(newLine.color);
                activeLineRef.current.fill(newLine.fill);
                activeLineRef.current.strokeWidth(newLine.strokeWidth);
                activeLineRef.current.opacity(newLine.opacity);
                activeLineRef.current.globalCompositeOperation(newLine.globalCompositeOperation);
                activeLineRef.current.closed(newLine.closed);
                activeLineRef.current.tension(newLine.tension);
                activeLineRef.current.lineCap(newLine.lineCap);
                activeLineRef.current.lineJoin(newLine.lineJoin);
                
                activeLineRef.current.show();
                if (activeCircleStrokeRef.current) activeCircleStrokeRef.current.hide();
                if (activeCircleFillRef.current) activeCircleFillRef.current.hide();
                
                activeLineRef.current.getLayer().batchDraw();
            }
        }

    }, [canDraw, brushColor, highlighterColor, highlighterOpacity, strokeWidth, highlighterSize, shapeWidth, shapeColor, shapeBorderColor, fillShape, shapeFillOpacity, shapeBorderOpacity]);

    const computeTrianglePoints = (xPeak, yPeak, xBase, yBase) => {
                    const dx = xBase - xPeak;
                    const dy = yBase - yPeak;

                    const h = Math.sqrt(dx * dx + dy * dy);
                    
                    if (h === 0) return [xPeak, yPeak, xPeak, yPeak, xPeak, yPeak];

                    const b = h / Math.sqrt(3);

                    const ux = -dy / h;
                    const uy = dx / h;

                    const xLeft = xBase + ux * b;
                    const yLeft = yBase + uy * b;

                    const xRight = xBase - ux * b;
                    const yRight = yBase - uy * b;

                    return [xPeak, yPeak, xLeft, yLeft, xRight, yRight];
                };

    const computeRectanglePoints = (x1, y1, x2, y2) => {
                    
                    return [
                        x1, y1, 
                        x2, y1, 
                        x2, y2, 
                        x1, y2
                    ];
                };

    const computeCircleData = (points) => {
        if (points.length < 4) // we want an array containing x1, y1, x2, y2, we calculate midpoint for centre and half distance for radius
            return {x: 0, y: 0, radius: 0};

        const [x1, y1, x2, y2] = points;
        const dx = x2 - x1;
        const dy = y2 - y1;
        
        const radius = Math.sqrt(dx * dx + dy * dy);
        
        return {
            x_center: x1, 
            y_center: y1,
            radius: radius
        };
    };

    function getSmallestRectangle(lines) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; // this is JS, therefore: Math.max = -∞, and Math.min = ∞

        for (const line of lines) {
            if (line.type === 'circle') {
                const {x_center, y_center, radius} = computeCircleData(line.points);
                const sw = line.strokeWidth || 0;
                minX = Math.min(minX, x_center - radius - sw);
                minY = Math.min(minY, y_center - radius - sw);
                maxX = Math.max(maxX, x_center + radius + sw);
                maxY = Math.max(maxY, y_center + radius + sw);
            } else {
                const sw = line.strokeWidth || 0;
                for (let i = 0; i < line.points.length; i += 2) {
                    minX = Math.min(minX, line.points[i] - sw);
                    minY = Math.min(minY, line.points[i + 1] - sw);
                    maxX = Math.max(maxX, line.points[i] + sw);
                    maxY = Math.max(maxY, line.points[i + 1] + sw);
                }
            }
        }

        const padding = 100;
        console.log(minX, minY, maxX, maxY)
        return {
            x: minX - padding,
            y: minY - padding,
            width: maxX - minX + 2 * padding,
            height: maxY - minY + 2 * padding
        };
    }
    function addTempBG(layer, box) {
        const bg = new Konva.Rect({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            fill: '#ffffff',
        });
        layer.add(bg);
        bg.moveToBottom();
        return bg;
    }
    function exportToPng() {
        if (!lines.length) return;
        const box = getSmallestRectangle(lines);
        const layer = stageRef.current.findOne('.draw-layer');
        const bg = addTempBG(layer,box);
        stageRef.current.position({ x: 0, y: 0 });
        stageRef.current.scale({ x: 1, y: 1 });
        const dataUrl = layer.toDataURL({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            pixelRatio: 2,
            mimeType: 'image/jpeg',  // or 'image/jpeg'
        });
        bg.destroy();

        const link = document.createElement('a');
        link.download = `${board?.name || 'board'}.png`;
        link.href = dataUrl;
        link.click();
    }

    function exportToPDF() {
        if (!lines.length) return;
        const box = getSmallestRectangle(lines);
        const layer = stageRef.current.findOne('.draw-layer');
        const bg = addTempBG(layer,box);
        stageRef.current.position({ x: 0, y: 0 });
        stageRef.current.scale({ x: 1, y: 1 });
        const dataUrl = layer.toDataURL({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            pixelRatio: 2,
            mimeType: 'image/jpeg',  // or 'image/jpeg'
        });
        bg.destroy();

        const orientation = box.width > box.height ? 'landscape' : 'portrait';
        const pdf = new jsPDF(orientation, 'px', [box.width, box.height]);
        pdf.addImage(dataUrl, 'PNG', 0, 0, box.width, box.height);
        pdf.save(`${board?.name || 'board'}.pdf`);
    }

    function generateThumbnail(mw = 400) {
        const stage = stageRef.current;
        if (!stage || !linesRef?.current.length) return null;

        stage.position({ x: 0, y: 0 });
        stage.scale({ x: 1, y: 1 });

        const viewW = stage.width();
        const viewH = stage.height();

        const captureW = Math.min(viewW, viewH * (4 / 3));
        const captureH = captureW * (3 / 4);

        const cropX = (viewW - captureW) / 2;
        const cropY = (viewH - captureH) / 2;

        const pixelRatio = mw / captureW;

        return stage.toDataURL({
            x: cropX,
            y: cropY,
            width: captureW,
            height: captureH,
            pixelRatio: pixelRatio,
            mimeType: 'image/png', 
        });
    }

    async function saveThumbnail() {
        if (!lines.length || !stageRef.current || shared) return;
        const dataUrl = generateThumbnail(400);
        if (!dataUrl) return;

        try {
            await apiFetch(`/boards/${id}/thumbnail`, {
                method: 'PUT',
                body: JSON.stringify({ thumbnail: dataUrl }),
            });
        } catch (err) {
            console.error("Failed to save thumbnail:", err);
        }
    }

    const handlePointerMove = useCallback((e) => {

        if (isPanningRef.current) {
            const newPos = {
                x: e.evt.clientX - panStartRef.current.x,
                y: e.evt.clientY - panStartRef.current.y,
            };
            stageRef.current.position(newPos);
            stagePositionRef.current = newPos;
            return;     // otherwise it starts drawing
        }
        if (e.evt.pointerType === 'touch') return;
        if (!canDraw) return;

        if (eraserCursorRef.current) {
            eraserCursorRef.current.style.left = `${e.evt.clientX}px`;
            eraserCursorRef.current.style.top = `${e.evt.clientY}px`;
        }

        if (!isDrawingRef.current) return;

        //const pos = stageRef.current.getPointerPosition();
        const stage = stageRef.current;
        const pointerPos = stage.getPointerPosition();
        const pointerScale = stage.scaleX() || 1;

        if (toolRef.current === 'eraser') {
            // const shape = stageRef.current.getIntersection(pos);
            const shape = stageRef.current.getIntersection(pointerPos);
            if (shape && (shape.getClassName() === 'Line' || shape.getClassName() == 'Circle')) {
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

        const pos = {
            // pointer scale has to be taka into account otherwise it explodes
            x: (pointerPos.x - stage.x()) / pointerScale,
            y: (pointerPos.y - stage.y()) / pointerScale,
        };

        if (toolRef.current === 'shape') {

            const start_x = activeLineDataRef.current.points[0];
            const start_y = activeLineDataRef.current.points[1];

            if (shapeRef.current === 'line' || shapeRef.current == 'circle') activeLineDataRef.current.points = [start_x, start_y, pos.x, pos.y];

            else if (shapeRef.current === 'triangle') activeLineDataRef.current.points = computeTrianglePoints(start_x, start_y, pos.x, pos.y);
            
            else activeLineDataRef.current.points = computeRectanglePoints(start_x, start_y, pos.x, pos.y); // rectangle
            
        }

        else {
            const coalescedEvents = e.evt.getCoalescedEvents ? e.evt.getCoalescedEvents() : [];
            const pts = activeLineDataRef.current.points;
            const minDistSpace = (MIN_POINT_DISTANCE / pointerScale);
            const minSpaceSq = minDistSpace * minDistSpace;
            if (coalescedEvents.length > 1) {
                const rect = stage.container().getBoundingClientRect();
                for (const ce of coalescedEvents) {
                    const pos_x = (ce.clientX - rect.left - stage.x()) / pointerScale;
                    const pos_y = (ce.clientY - rect.top - stage.y()) / pointerScale;
                    
                    const lastX = pts[pts.length - 2];
                    const lastY = pts[pts.length - 1];
                    const dx = pos_x - lastX;
                    const dy = pos_y - lastY;
                    if (dx * dx + dy * dy >= minSpaceSq) {
                        pts.push(pos_x, pos_y);
                    }
                }
            } else {
                const lastX = pts[pts.length - 2];
                const lastY = pts[pts.length - 1];
                const dx = pos.x - lastX;
                const dy = pos.y - lastY;
                if (dx * dx + dy * dy >= minSpaceSq) {
                    pts.push(pos.x, pos.y);
                }
            }
        }

        const isCircle = toolRef.current === 'shape' && shapeRef.current === 'circle';

        if (isCircle && activeCircleStrokeRef.current && activeCircleFillRef.current) {
            const {x_center, y_center, radius} = computeCircleData(activeLineDataRef.current.points);
            const sw = activeLineDataRef.current.strokeWidth || 0;
            
            activeCircleStrokeRef.current.x(x_center);
            activeCircleStrokeRef.current.y(y_center);
            activeCircleStrokeRef.current.radius(radius);

            activeCircleFillRef.current.x(x_center);
            activeCircleFillRef.current.y(y_center);
            activeCircleFillRef.current.radius(Math.max(0, radius - sw / 2));
        }

        else if (!isCircle && activeLineRef.current) {
            activeLineRef.current.points([...activeLineDataRef.current.points]);
        }

        if (e.evt.pointerType === 'pen' && e.evt.pressure && toolRef.current !== 'shape') {
            const baseWidth = activeLineDataRef.current.strokeWidth;
            const dynamicWidth = baseWidth * (0.3 + e.evt.pressure * 0.7);
            activeLineRef.current?.strokeWidth(dynamicWidth);
        }
        
        const layer = activeLineRef.current?.getLayer() || activeCircleStrokeRef.current?.getLayer();
        if (layer) layer.batchDraw();

        const now = Date.now();
        if (now - lastUpdate > UPDATE_INTERVAL) {
            socketRef.current?.emit('board:draw:tmpline', activeLineDataRef.current); // update line in real time!
            setLastUpdate(now);
        }

    }, [canDraw]);

    const handlePointerUp = useCallback(() => {
        if (isPanningRef.current) {
            isPanningRef.current = false;
            const stage = stageRef.current;
            stage.container().style.cursor = (toolRef.current === 'eraser' ? 'none' : (canDraw ? 'crosshair' : 'default'));
            if (eraserCursorRef.current && toolRef.current === 'eraser') eraserCursorRef.current.style.display = 'block';
            return; // of course it has to create a mess without the return 
        }
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;

        if (toolRef.current === 'eraser') return;

        const finishedLine = activeLineDataRef.current;
        if (!finishedLine) return;

        if (finishedLine.type === 'line' && !finishedLine.closed && finishedLine.points.length > 4) {
            finishedLine.points = smoothPoints(finishedLine.points);
        }

        if (toolRef.current === 'highlighter') finishedLine.globalCompositeOperation = 'multiply';
        if (finishedLine.useMultiply) {
            finishedLine.globalCompositeOperation = 'multiply';
            delete finishedLine.useMultiply;
        }

        setLines((prev) => [...prev, finishedLine]);
        linesRef.current = [...(linesRef.current || []), finishedLine];
        // console.log(getSmallestRectangle(linesRef.current));

        if (activeLineRef.current) {
            activeLineRef.current.hide();
            activeLineRef.current.getLayer().batchDraw();
        }

        if (activeCircleStrokeRef.current) {
            activeCircleStrokeRef.current.hide();
            if (activeCircleFillRef.current) activeCircleFillRef.current.hide();
            activeCircleStrokeRef.current.getLayer().batchDraw();
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

    const handleWheel = useCallback((e) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        
        if (e.evt.ctrlKey || e.evt.metaKey) {
            const scaleBy = 1.05;
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();

            const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
            };

            const direction = e.evt.deltaY > 0 ? -1 : 1;
            const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
            
            const clampedScale = Math.max(0.1, Math.min(newScale, 10));

            stage.scale({ x: clampedScale, y: clampedScale });
            setScale(clampedScale);

            const newPos = {
                x: pointer.x - mousePointTo.x * clampedScale,
                y: pointer.y - mousePointTo.y * clampedScale,
            };
            stage.position(newPos);
            stagePositionRef.current = newPos;
        } else {
            const dx = e.evt.deltaX;
            const dy = e.evt.deltaY;
            const newPos = {
                x: stage.x() - dx,
                y: stage.y() - dy,
            };

            stage.position(newPos);
            stagePositionRef.current = newPos;
        }
    }, [])

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

    const activeSize = (tool === 'eraser') ? eraserSize : (tool === 'highlighter') ? highlighterSize : (tool === 'shape') ? shapeWidth : strokeWidth;
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
            case 'shape':
                setShapeWidth(fn);
                break;
            default:
                console.error("[SyncBoard] Unknown tool selected!");
        }
    }

    const setColor = (fn) => (tool === 'highlighter') ? setHighlighterColor(fn) : setBrushColor(fn);

    const getContrastColor = (hexColor) => {
        if (!hexColor) return 'white';
        
        const hex = hexColor.replace('#', '');
        
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        
        return brightness > 128 ? 'black' : 'white';

    };

    return (
        <div className="h-screen overflow-hidden relative bg-white" onMouseDown={(e) => {if (e.button === 1) e.preventDefault();}}>
            
            <div className="top-2 text-xl font-semibold absolute top-1 right-[50vw] translate-x-1/2 z-[1] pointer-events-none">
                <span className="text-violet-700/45">Sync</span>
                <span className="text-black/45">Board</span>
            </div>

                {/* onMouseEnter has to be a mouse event because react decided so (why do PointerDown, Move, Up and Leave work though but not pointer enter, is my question?) */}
            <Stage 
                    ref={stageRef}
                    width={stageSize.width}
                    height={stageSize.height}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onMouseEnter={handlePointerEnter} 
                    onMouseLeave={handlePointerLeave}
                    onWheel={handleWheel}
                    style={{
                        cursor: tool === 'eraser' ? 'none' : (canDraw ? 'crosshair' : 'default'),
                        display:'block',
                        touchAction: 'none'
                    }}
            >
                <Layer name="draw-layer">
                    {lines.map((line) => {

                        if (line.type === 'circle') {
                            const {x_center, y_center, radius} = computeCircleData(line.points);
                            const sw = line.strokeWidth || 0;
                            return (
                                <Fragment key={line.id}>
                                    {line.fill && (
                                        <Circle
                                            key={line.id + '_fill'}
                                            id={line.id}
                                            x={x_center}
                                            y={y_center}
                                            radius={Math.max(0, radius - sw / 2)}
                                            fill={line.fill}
                                            globalCompositeOperation={line.globalCompositeOperation}
                                            listening={true}
                                        />
                                    )}
                                    <Circle
                                        key={line.id}
                                        id={line.id}
                                        x={x_center}
                                        y={y_center}
                                        radius={radius}
                                        stroke={line.color}
                                        strokeWidth={sw}
                                        globalCompositeOperation={line.globalCompositeOperation}
                                        listening={true}
                                    />
                                </Fragment>
                            );
                        }

                        else return (
                            <Line
                                key={line.id}
                                id={line.id}
                                points={line.points}
                                stroke={line.color}
                                fill={line.fill}
                                strokeWidth={line.strokeWidth}
                                opacity={line.opacity}
                                hitStrokeWidth={line.hitStrokeWidth}
                                tension={line.tension}
                                globalCompositeOperation={line.globalCompositeOperation}
                                closed={line.closed}
                                lineCap={line.lineCap}
                                lineJoin={line.lineJoin}
                                listening={true}
                            />
                        );
                    })}

            
                    <Line
                        ref={activeLineRef}
                        tension={0.3}
                        lineCap="round"
                        lineJoin="round"
                        listening={false}
                        visible={false}
                    />
                

                    <Circle 
                        ref={activeCircleFillRef}
                        visible={false}  
                        listening={false}
                    />

                    <Circle 
                        ref={activeCircleStrokeRef}
                        visible={false}  
                        listening={false}
                    />

                </Layer>
            </Stage>
            
            <div
                ref={eraserCursorRef}
                className="fixed pointer-events-none rounded-full border-2 border-gray-400 bg-white"
                style={{
                    width: eraserSize * scale,
                    height: eraserSize * scale,
                    display: tool === 'eraser' ? 'block' : 'none',
                    transform: 'translate(-50%, -50%)',
                }}
            />

            <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-auto">
                <button onClick={() => {navigate('/'); saveThumbnail();}} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 shadow-sm transition cursor-pointer hover:bg-gray-50 hover:text-gray-900">
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
                    <div className="absolute bottom-6 left-1/2 bg-white flex items-center gap-1 px-3 py-2 
                        -translate-x-1/2 border border-gray-200 rounded-2xl backdrop-blur-md shadow-2xl
                        max-w-[95vw] overflow-x-clip overflow-y-visible"
                    >
                        <ToolButton
                            active={tool === "pen"}
                            onClick={() => {
                                setTool("pen");
                                setSelectedShapeMenu(false);
                                setSelectedHighlighterMenu(false);
                            }}
                            title="Pen"
                        >
                            <Pencil size={18} /> 
                        </ToolButton>

                        <ToolButton
                            active={tool === "highlighter"}
                            onClick={() => {
                                setTool("highlighter");
                                setSelectedShapeMenu(false);
                                setSelectedHighlighterMenu(prev => !prev);
                            }}
                            title="Highlighter"
                        >
                            <Highlighter size={18} />
                        </ToolButton>

                        <div 
                            id='highlighter_op_selector' 
                            className="absolute bottom-14 left-6 bg-white flex items-center gap-1 px-2 py-4 border border-gray-200 rounded-2xl"
                            style = {{display: (tool === 'highlighter' && selectedHighlighterMenu) ? 'flex' : 'none'}}
                        >

                            <div className="flex flex-col gap-1 mx-1" title="Highlighter opacity">
                                <span className="text-[9px] text-gray-400 leading-none pb-1">Opacity</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={highlighterOpacity}
                                    onChange={(e) => setHighlighterOpacity(parseFloat(e.target.value))}
                                    className="w-16 h-1 accent-gray-900 cursor-pointer"
                                />
                            </div>                            

                        </div>

                        <ToolButton
                            active={tool === "eraser"}
                            onClick={() => {
                                setTool("eraser");
                                setSelectedShapeMenu(false);
                                setSelectedHighlighterMenu(false);
                            }}
                            title="Eraser"
                        >
                            <Eraser size={18} />
                        </ToolButton>

                        <ToolButton
                            active={tool === "select"}
                            onClick={() => {
                                setTool("select");
                                setSelectedShapeMenu(false);
                                setSelectedHighlighterMenu(false);
                            }}
                            title="Select"
                        >
                            <LassoSelect size={18} />
                        </ToolButton>

                        <ToolButton
                            active={tool === "shape"}
                            onClick={() => {    
                                setTool('shape');
                                setSelectedShapeMenu(prev => !prev);
                                setSelectedHighlighterMenu(false);
                            }}
                            title="Shape"
                        >
                            <Shapes size={18} />
                        </ToolButton>

                        <div 
                            id='shape_selector' 
                            className="absolute bottom-14 left-16 bg-white flex items-center gap-1 px-2 py-2 border border-gray-200 rounded-2xl"
                            style = {{display: (tool === 'shape' && selectedShapeMenu) ? 'flex' : 'none'}}
                        >
                            
                            <ToolButton
                                active={shape === "line"}
                                onClick={() => setShape("line")}
                                title="Line"
                            >
                                <Minus size={18} />
                            </ToolButton>

                            <ToolButton
                                active={shape === "triangle"}
                                onClick={() => setShape("triangle")}
                                title="Triangle"
                            >
                                <Triangle size={18} />
                            </ToolButton>

                            <ToolButton
                                active={shape === "rectangle"}
                                onClick={() => setShape("rectangle")}
                                title="Rectangle"
                            >
                                <Square size={18} />
                            </ToolButton>

                            <ToolButton
                                active={shape === "circle"}
                                onClick={() => setShape("circle")}
                                title="Circle"
                            >
                                <CircleIcon size={18} />
                            </ToolButton>

                            <div className="w-px h-6 bg-gray-300 mx-1"></div>

                            <label className="relative w-6 h-6 cursor-pointer" title="Shape border color">
                                <div className="w-6 h-6 rounded-full border-2 transition hover:scale-110"
                                    style={{
                                        background: shapeBorderColor,
                                        borderColor: `color-mix(in srgb, ${shapeBorderColor}, black 30%)`
                                    }}
                                >
                                </div>
                                <input type="color" value={shapeBorderColor} onChange={(e) => { setShapeBorderColor(e.target.value); }} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                            </label>

                            <label className="relative w-6 h-6 cursor-pointer" title="Shape color">
                                <div className="w-6 h-6 rounded-full border-2 transition hover:scale-110"
                                    style={{
                                        background: shapeColor,
                                        borderColor: `color-mix(in srgb, ${shapeColor}, black 30%)`
                                    }}
                                >
                                </div>
                                <input type="color" value={shapeColor} onChange={(e) => { setShapeColor(e.target.value); }} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                            </label>

                            <div className="w-px h-6 bg-gray-300 mx-1"></div>

                            <div className="flex flex-col gap-1 mx-1" title="Border opacity">
                                <span className="text-[9px] text-gray-400 leading-none pb-1">Border</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={shapeBorderOpacity}
                                    onChange={(e) => setShapeBorderOpacity(parseFloat(e.target.value))}
                                    className="w-16 h-1 accent-gray-900 cursor-pointer"
                                />
                            </div>

                            <div className="flex flex-col gap-1 mx-1" title="Fill opacity">
                                <span className="text-[9px] text-gray-400 leading-none pb-1">Fill</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={shapeFillOpacity}
                                    onChange={(e) => setShapeFillOpacity(parseFloat(e.target.value))}
                                    className="w-16 h-1 accent-gray-900 cursor-pointer"
                                />
                            </div>

                            <div className="w-px h-6 bg-gray-300 mx-1"></div>

                            <PaintBucket size={18} />
                            {/* all this just to have a checkbox with no internal border */}
                            <div className="relative mx-2 w-5 h-5">
                            
                                <div 
                                    className={`absolute inset-0 border-2 border-gray-600 transition-colors duration-200 
                                        ${fillShape ? 'bg-current' : 'bg-white'}`}
                                    style={{ 
                                        borderRadius: '25%', 
                                        color: fillShape ? shapeColor : 'transparent' 
                                    }}
                                >
                                    {fillShape && (
                                        <svg className="w-full h-full text-white p-0" fill="none" viewBox="0 0 24 24" stroke={getContrastColor(shapeColor)} strokeWidth="4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <input 
                                    type='checkbox' 
                                    checked={fillShape}
                                    onChange={(e) => setFillShape(e.target.checked)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                </div>

                            </div>    

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
                                    width: Math.min(activeSize * ((tool === 'eraser' || tool === 'highlighter') ? 0.7 : (tool === 'shape') ? 1.25 :  2.5), 22),
                                    height: Math.min(activeSize * ((tool === 'eraser' || tool === 'highlighter') ? 0.7 : (tool === 'shape') ? 1.25 : 2.5), 22),
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

                        <div className="border-t border-gray-100 my-4" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Export</p>
                        <div className="flex gap-2 mb-3">
                            <button onClick={exportToPng} disabled={!lines.length}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Download size={14} />
                                PNG
                            </button>
                            <button onClick={exportToPDF} disabled={!lines.length}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <FileText size={14} />
                                PDF
                            </button>
                        </div>

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