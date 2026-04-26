import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { Stage, Layer, Line, Circle, Rect, Text, Group } from "react-konva";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Users, Share2, X, Send, User } from "lucide-react";
import { useAuth } from '../context/AuthContext';

import { UPDATE_INTERVAL, NUM_MAX_UNDO, MIN_POINT_DISTANCE, MIN_POINT_DISTANCE_PEN } from "../utils/boardConstants";
import { hexToRgba, smoothPoints, computeTrianglePoints, computeRectanglePoints, computeCircleData, lineIntersectsOrInsidePolygon, computeSelectionBBox, translatePoints} from "../utils/boardUtils";
import useSocket from "../hooks/useSocket";
import useExport from "../hooks/useExport";
import useTouchHandlers from "../hooks/useTouchHandlers";
import ShareModal from "../components/board/ShareModal";
import Toolbar from "../components/board/Toolbar";

export default function Board({ shared = false }) {
    const { id, token } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [scale, setScale] = useState(1);
    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [tool, setTool] = useState("pen");
    const [brushColor, setBrushColor] = useState("#000000");
    const [highlighterColor, setHighlighterColor] = useState("#eab308");
    const [shapeColor, setShapeColor] = useState("#3b82f6");
    const [shapeBorderColor, setShapeBorderColor] = useState("#000000");
    const [shapeFillOpacity, setShapeFillOpacity] = useState(1);
    const [shapeBorderOpacity, setShapeBorderOpacity] = useState(1);
    const [fillShape, setFillShape] = useState(false);
    const [selectedShapeMenu, setSelectedShapeMenu] = useState(false);
    const [shape, setShape] = useState('');
    const [editHistory, setEditHistory] = useState({ history: [], editIndex: -1 });
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [shapeWidth, setShapeWidth] = useState(5);
    const [eraserSize, setEraserSize] = useState(10);
    const [highlighterSize, setHighlighterSize] = useState(30);
    const [highlighterOpacity, setHighlighterOpacity] = useState(0.3);
    const [selectedHighlighterMenu, setSelectedHighlighterMenu] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(0);

    const LASSO_LINE_COLOR = "#959494"
    const SELECTION_BOX_COLOR = "#3b82f6"
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectionLasso, setSelectionLasso] = useState(null);
    const [selectionBBox, setSelectionBBox] = useState(null); // BB = bounding box
    const [selectionBBoxRotation, setSelectionBBoxRotation] = useState(0);
    const [isDraggingSelection, setIsDraggingSelection] = useState(false);

    const stageRef = useRef(null);
    const toolRef = useRef(tool);
    const shapeRef = useRef(shape);
    const eraserCursorRef = useRef(null);
    const linesRef = useRef([]);
    const isDrawingRef = useRef(false);
    const activeLineRef = useRef(null);
    const activeLineDataRef = useRef(null);
    const activeCircleFillRef = useRef(null);
    const activeCircleStrokeRef = useRef(null);

    const isPanningRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const stagePositionRef = useRef({ x: 0, y: 0 });
    const pointerTypeRef = useRef('mouse');
    const isPenActiveRef = useRef(false);

    const selectionLassoRef = useRef(null);
    const dragStartRef = useRef(null);

    const selectedIdsRef = useRef([]);
    const selectionLassoDataRef = useRef(null);
    const selectionBBoxRef = useRef(null);
    const isDraggingSelectionRef = useRef(false);
    const dragStartAngleRef = useRef(0);
    const lastAngleRef = useRef(0);
    const cumulativeDeltaRef = useRef(0);
    const initialBoxRotRef = useRef(0);
    const initialLinesRotRef = useRef({});
    useEffect(() => {selectedIdsRef.current = selectedIds}, [selectedIds]);
    useEffect(() => {selectionLassoDataRef.current = selectionLasso}, [selectionLasso]);
    useEffect(() => {selectionBBoxRef.current = selectionBBox}, [selectionBBox]);
    useEffect(() => {isDraggingSelectionRef.current = isDraggingSelection}, [isDraggingSelection]);

    const [chatOpen, setChatOpen] = useState(false);
    const [inputMessage, setInputMessage] = useState("");
    const inputMessageRef = useRef(null);
    const messagesEndRef = useRef(null);
    useEffect(() => {inputMessageRef.current = inputMessage}, [inputMessage]);

    const [showPeers, setShowPeers] = useState(false);

    const clearSelection = useCallback(() => {
        setSelectedIds([]);
        setSelectionLasso(null);
        setSelectionBBox(null);
        setSelectionBBoxRotation(0);
        setIsDraggingSelection(false);
        if (selectionLassoRef.current) {
            selectionLassoRef.current.hide();
            selectionLassoRef.current.getLayer().batchDraw();
        }
    }, []);

    const handleOtherClientEdit = useCallback((shapeId) => {
    if (selectedIdsRef.current.includes(shapeId)) {
        clearSelection();
    }
}, [clearSelection]);

    const { board, setBoard, lines, setLines, peers, peerEntries, setPeerEntries, 
            role, error, socketRef, chatMessages, setChatMessages } = useSocket({ id, token, shared, onShapeUpdate: handleOtherClientEdit });

    useEffect(() => { linesRef.current = lines }, [lines]);
    useEffect(() => { toolRef.current = tool }, [tool]);
    useEffect(() => { shapeRef.current = shape }, [shape]);
    useEffect(() => {
    const onKeyDown = (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
            selectedIds.forEach(id => {
                socketRef.current?.emit('board:draw:erase', id);
            });
            setLines(prev => prev.filter(l => !selectedIds.includes(l.id)));
            clearSelection();
        }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
}, [selectedIds]);

    const { touchCountRef } = useTouchHandlers({
        stageRef, setScale,
        isDrawingRef, activeLineRef, activeLineDataRef,
        activeCircleStrokeRef, activeCircleFillRef, isPenActiveRef,
    });

    const { exportToPng, exportToPDF, saveThumbnail } = useExport({
        stageRef, linesRef, lines, board, id, shared,
    });

    const canDraw = (role === 'editor');
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
                    if (line.getClassName() === 'Line') line.hitStrokeWidth(eraserSize);
                });
            }
        }
    }, [eraserSize, tool]);

    useEffect(() => {
        toolRef.current = tool;
        if (tool !== 'select') clearSelection();
    }, [tool]);

    const handlePointerDown = useCallback((e) => {
        if (isPanningRef.current) return;
        if (e.target !== e.target.getStage() && e.target.name() !== 'selection-box') return; // if we are using selectionBBox tools, ignore the event (except for the selection box itself)
        if (e.evt.pointerType === 'touch' && touchCountRef.current >= 1) return;
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
        if (!canDraw) return;
        if (e.evt.pointerType !== 'pen' && e.evt.button !== 0) return;
        e.evt.preventDefault();
        pointerTypeRef.current = e.evt.pointerType || 'mouse';
        if (e.evt.pointerType === 'pen') isPenActiveRef.current = true;
        isDrawingRef.current = true;

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
                id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
                        if (prev.history.some(item => item.op === 'erase' && item.line.id === lineId)) return prev;
                        let newHistory;
                        if (prev.history.length < NUM_MAX_UNDO) {
                            newHistory = [...prev.history.slice(0, prev.editIndex + 1), { line: lineData, op: "erase" }];
                        } else newHistory = [...prev.history.slice(1, prev.editIndex + 1), { line: lineData, op: "erase" }];
                        return { history: newHistory, editIndex: newHistory.length - 1 };
                    });
                    socketRef.current?.emit('board:draw:erase', lineId);
                }
            }
            return;
        }
        
        if (toolRef.current === 'select') {

            if (e.target.name() === 'selection-box') {
                if (selectionBBoxRef.current) {
                    const pos = {
                        x: (pointerPos.x - stage.x()) / pointerScale,
                        y: (pointerPos.y - stage.y()) / pointerScale,
                    }
                    if (pos.x >= selectionBBoxRef.current.x && pos.x <= selectionBBoxRef.current.x + selectionBBoxRef.current.width &&
                        pos.y >= selectionBBoxRef.current.y && pos.y <= selectionBBoxRef.current.y + selectionBBoxRef.current.height) {
                            setIsDraggingSelection(true);
                            isDraggingSelectionRef.current = true;
                            dragStartRef.current = { x: pos.x, y: pos.y };
                            return;
                        }
                }
            }

            clearSelection();
            isDrawingRef.current = true;
            const pos = { 
                x: (pointerPos.x - stage.x()) / pointerScale,
                y: (pointerPos.y - stage.y()) / pointerScale,
            }
            // setSelectionBBox([pos.x, pos.y]);
            setSelectionLasso([pos.x, pos.y]);
            if (selectionLassoRef.current) {
                selectionLassoRef.current.points([pos.x, pos.y]);
                selectionLassoRef.current.show();
                selectionLassoRef.current.getLayer().batchDraw();
            }
            return;
        }

        const pos = {
            x: (pointerPos.x - stage.x()) / pointerScale,
            y: (pointerPos.y - stage.y()) / pointerScale,
        };

        if (!newLine) {
            newLine = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
                type: 'line',
                points: [pos.x, pos.y, pos.x, pos.y],
                color: (toolRef.current == 'highlighter') ? highlighterColor : brushColor,
                strokeWidth: (toolRef.current === 'highlighter') ? highlighterSize : strokeWidth,
                opacity: (toolRef.current === 'highlighter') ? highlighterOpacity : 1,
                globalCompositeOperation: 'source-over',
                closed: false,
                tension: 0.3,
                fill: '',
                lineCap: 'round',
                lineJoin: 'round',
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

    const handlePointerMove = useCallback((e) => {
        if (isPanningRef.current) {
            const newPos = {
                x: e.evt.clientX - panStartRef.current.x,
                y: e.evt.clientY - panStartRef.current.y,
            };
            stageRef.current.position(newPos);
            stagePositionRef.current = newPos;
            return;
        }
        if (e.evt.pointerType === 'touch') return;
        if (!canDraw) return;

        if (eraserCursorRef.current) {
            eraserCursorRef.current.style.left = `${e.evt.clientX}px`;
            eraserCursorRef.current.style.top = `${e.evt.clientY}px`;
        }

        if (!isDrawingRef.current) return;

        const stage = stageRef.current;
        const pointerPos = stage.getPointerPosition();
        const pointerScale = stage.scaleX() || 1;

        if (toolRef.current === 'eraser') {
            const shape = stageRef.current.getIntersection(pointerPos);
            if (shape && (shape.getClassName() === 'Line' || shape.getClassName() == 'Circle')) {
                const lineId = shape.id();
                const lineData = linesRef.current?.find(l => l.id === lineId);
                if (lineData) {
                    setLines((prev) => prev.filter((l) => l.id !== lineId));
                    setEditHistory((prev) => {
                        if (prev.history.some(item => item.op === 'erase' && item.line.id === lineId)) return prev;
                        let newHistory;
                        if (prev.history.length < NUM_MAX_UNDO) {
                            newHistory = [...prev.history.slice(0, prev.editIndex + 1), { line: lineData, op: "erase" }];
                        } else newHistory = [...prev.history.slice(1, prev.editIndex + 1), { line: lineData, op: "erase" }];
                        return { history: newHistory, editIndex: newHistory.length - 1 };
                    });
                    socketRef.current?.emit('board:draw:erase', lineId);
                }
            }
            return;
        }

        if (toolRef.current === 'select') {
            if (isDraggingSelectionRef.current && dragStartRef.current) {
                const pos = {
                    x: (pointerPos.x - stage.x()) / pointerScale,
                    y: (pointerPos.y - stage.y()) / pointerScale,
                }
                const dx = pos.x - dragStartRef.current.x;
                const dy = pos.y - dragStartRef.current.y;
                dragStartRef.current = { x: pos.x, y: pos.y };

                setLines(prev => {
                    const updated = prev.map(l => {
                        if (!selectedIdsRef.current.includes(l.id)) return l;
                        return {...l, 
                                points: translatePoints(l.points, dx, dy),
                                x: l.x !== undefined ? l.x + dx : undefined,
                                y: l.y !== undefined ? l.y + dy : undefined,
                                offsetX: l.offsetX !== undefined ? l.offsetX + dx : undefined,
                                offsetY: l.offsetY !== undefined ? l.offsetY + dy : undefined
                            };
                    });
                    linesRef.current = updated;
                    return updated;
                });
                setSelectionBBox(prev => prev ? {...prev, x: prev.x + dx, y: prev.y + dy } : null);
                return;
            }
            if (!isDrawingRef.current) return;
            const pos = {
                x: (pointerPos.x - stage.x()) / pointerScale,
                y: (pointerPos.y - stage.y()) / pointerScale,
            };

            setSelectionLasso(prev => {
                const u = prev ? [...prev, pos.x, pos.y] : [pos.x, pos.y];
                if (selectionLassoRef.current) {
                    selectionLassoRef.current.points(u);
                    selectionLassoRef.current.getLayer().batchDraw();
                }
                return u;
            })
            return;
        }

        if (!activeLineDataRef.current) return;

        const pos = {
            x: (pointerPos.x - stage.x()) / pointerScale,
            y: (pointerPos.y - stage.y()) / pointerScale,
        };

        if (toolRef.current === 'shape') {
            const start_x = activeLineDataRef.current.points[0];
            const start_y = activeLineDataRef.current.points[1];
            if (shapeRef.current === 'line' || shapeRef.current == 'circle') activeLineDataRef.current.points = [start_x, start_y, pos.x, pos.y];
            else if (shapeRef.current === 'triangle') activeLineDataRef.current.points = computeTrianglePoints(start_x, start_y, pos.x, pos.y);
            else activeLineDataRef.current.points = computeRectanglePoints(start_x, start_y, pos.x, pos.y);
        } else {
            const coalescedEvents = e.evt.getCoalescedEvents ? e.evt.getCoalescedEvents() : [];
            const pts = activeLineDataRef.current.points;
            const isPen = pointerTypeRef.current === 'pen';
            const minDistSpace = ((isPen ? MIN_POINT_DISTANCE_PEN : MIN_POINT_DISTANCE) / pointerScale);
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
            const { x_center, y_center, radius } = computeCircleData(activeLineDataRef.current.points);
            const sw = activeLineDataRef.current.strokeWidth || 0;
            activeCircleStrokeRef.current.x(x_center);
            activeCircleStrokeRef.current.y(y_center);
            activeCircleStrokeRef.current.radius(radius);
            activeCircleFillRef.current.x(x_center);
            activeCircleFillRef.current.y(y_center);
            activeCircleFillRef.current.radius(Math.max(0, radius - sw / 2));
        } else if (!isCircle && activeLineRef.current) {
            activeLineRef.current.points([...activeLineDataRef.current.points]);
        }

        const layer = activeLineRef.current?.getLayer() || activeCircleStrokeRef.current?.getLayer();
        if (layer) layer.batchDraw();

        const now = Date.now();
        if (now - lastUpdate > UPDATE_INTERVAL) {
            socketRef.current?.emit('board:draw:tmpline', activeLineDataRef.current);
            setLastUpdate(now);
        }
    }, [canDraw]);

    const handlePointerUp = useCallback(() => {
        isPenActiveRef.current = false;
        if (isPanningRef.current) {
            isPanningRef.current = false;
            const stage = stageRef.current;
            stage.container().style.cursor = (toolRef.current === 'eraser' ? 'none' : (canDraw ? 'crosshair' : 'default'));
            if (eraserCursorRef.current && toolRef.current === 'eraser') eraserCursorRef.current.style.display = 'block';
            return;
        }
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        if (toolRef.current === 'eraser') return;

        if (toolRef.current === 'select') {
            if (isDraggingSelectionRef.current) {
                setIsDraggingSelection(false);
                isDraggingSelectionRef.current = false;
                dragStartRef.current = null;
                // socket
                selectedIdsRef.current.forEach(id => {
                  socketRef.current?.emit('board:draw:line', linesRef.current?.find(l => l.id === id));  
                });
                return;
            }

            isDrawingRef.current = false;
            if (!selectionLassoDataRef.current || selectionLassoDataRef.current.length < 6) { // why six?  SEEEVEEEEEEEEN 
                clearSelection();
                return;
            }
            
            const lasso = selectionLassoDataRef.current;
            const selected = linesRef.current.filter(l => lineIntersectsOrInsidePolygon(l, lasso));
            const selectedIds = selected.map(l => l.id);
            setSelectedIds(selectedIds);
            if (selectedIds.length > 0) setSelectionBBox(computeSelectionBBox(selected));
            if (selectionLassoRef.current) {
                selectionLassoRef.current.hide();
                selectionLassoRef.current.getLayer().batchDraw();
            }
            return;
        }

        const finishedLine = activeLineDataRef.current;
        if (!finishedLine) return;

        if (finishedLine.type === 'line' && !finishedLine.closed && finishedLine.points.length > 4) {
            const iterations = pointerTypeRef.current === 'pen' ? 1 : 2;
            finishedLine.points = smoothPoints(finishedLine.points, iterations);
        }

        if (toolRef.current === 'highlighter') finishedLine.globalCompositeOperation = 'multiply';
        if (finishedLine.useMultiply) {
            finishedLine.globalCompositeOperation = 'multiply';
            delete finishedLine.useMultiply;
        }
        
        setLines((prev) => [...prev, finishedLine]);
        linesRef.current = [...(linesRef.current || []), finishedLine];
       

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
            } else newHistory = [...prev.history.slice(1, prev.editIndex + 1), { line: finishedLine, op: "draw" }];
            return { history: newHistory, editIndex: newHistory.length - 1 };
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
            const scaleBy = 1.10;
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
            const newPos = { x: stage.x() - dx, y: stage.y() - dy };
            stage.position(newPos);
            stagePositionRef.current = newPos;
        }
    }, []);

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
                    if (prevLines.some(l => l.id === last_edit.line.id)) return prevLines;
                    return [...prevLines, last_edit.line];
                });
                socketRef.current?.emit('board:draw:undo', { lineId: last_edit.line.id, op: 'erase', line: last_edit.line });
            }
            return { history: prevHistory.history, editIndex: prevHistory.editIndex - 1 };
        });
    }, []);

    const handleRedo = useCallback(() => {
        setEditHistory((prevHistory) => {
            if (prevHistory.history.length === 0 || prevHistory.editIndex === prevHistory.history.length - 1) return prevHistory;
            const last_edit = prevHistory.history.at(prevHistory.editIndex + 1);
            if (last_edit.op === 'draw') {
                setLines((prevLines) => {
                    if (prevLines.some(l => l.id === last_edit.line.id)) return prevLines;
                    return [...prevLines, last_edit.line];
                });
                socketRef.current?.emit('board:draw:redo', { lineId: last_edit.line.id, op: 'draw', line: last_edit.line });
            } else {
                setLines((prevLines) => prevLines.filter(l => l.id !== last_edit.line.id));
                socketRef.current?.emit('board:draw:redo', { lineId: last_edit.line.id, op: 'erase' });
            }
            return { history: prevHistory.history, editIndex: prevHistory.editIndex + 1 };
        });
    }, []);

    const activeSize = (tool === 'eraser') ? eraserSize : (tool === 'highlighter') ? highlighterSize : (tool === 'shape') ? shapeWidth : strokeWidth;
    const setActiveSize = (fn) => {
        switch (toolRef.current) {
            case 'pen': setStrokeWidth(fn); break;
            case 'highlighter': setHighlighterSize(fn); break;
            case 'eraser': setEraserSize(fn); break;
            case 'shape': setShapeWidth(fn); break;
            default: console.error("[SyncBoard] Unknown tool selected!");
        }
    };
    const setColor = (fn) => (tool === 'highlighter') ? setHighlighterColor(fn) : setBrushColor(fn);

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    const sendMessage = () => {
        if (!inputMessageRef.current) return;
        const curr_time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const msg_payload = {id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, username: user ? user.username : 'guest', time: curr_time, body: inputMessageRef.current};
        socketRef.current?.emit('chat:send', msg_payload);
        setChatMessages((prev) => [...prev, {type: "own", id: msg_payload.id, username: user ? user.username : 'guest', time: curr_time, body: inputMessageRef.current}]);
        setInputMessage("");
    };

    // scroll to bottom of chat div each time a new message is received
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behaviour: "smooth" });
    };

    const handleRotationStart = (e) => {        
        const centerX = selectionBBox.x + selectionBBox.width / 2;
        const centerY = selectionBBox.y + selectionBBox.height / 2;
        const stage = e.target.getStage();
        const pointerPos = stage.getPointerPosition();
        
        lastAngleRef.current = Math.atan2(pointerPos.y - centerY, pointerPos.x - centerX) * (180 / Math.PI);
        
        cumulativeDeltaRef.current = 0; 

        initialBoxRotRef.current = selectionBBoxRotation || 0;
        
        const initialData = {};
        linesRef.current.forEach(l => {
            if (selectedIdsRef.current.includes(l.id)) {
                initialData[l.id] = {
                    rotation: l.rotation || 0,
                    x: l.x !== undefined ? l.x : centerX,
                    y: l.y !== undefined ? l.y : centerY,
                    offsetX: l.offsetX !== undefined ? l.offsetX : centerX,
                    offsetY: l.offsetY !== undefined ? l.offsetY : centerY,
                };
            }
        });
        initialLinesRotRef.current = initialData;
    }

    const handleRotationDrag = (e) => {                 
        const centerX = selectionBBox.x + selectionBBox.width / 2;
        const centerY = selectionBBox.y + selectionBBox.height / 2;
        const stage = e.target.getStage();
        const pointerPos = stage.getPointerPosition();
        
        const currentAngle = Math.atan2(pointerPos.y - centerY, pointerPos.x - centerX) * (180 / Math.PI);

        let frameDelta = currentAngle - lastAngleRef.current;

        if (frameDelta > 180) frameDelta -= 360;
        else if (frameDelta < -180) frameDelta += 360;

        cumulativeDeltaRef.current += frameDelta;

        lastAngleRef.current = currentAngle;

        const totalDelta = cumulativeDeltaRef.current;
        
        setSelectionBBoxRotation(initialBoxRotRef.current + totalDelta);
        
        const rad = totalDelta * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        setLines(prev => prev.map(l => {
            if (selectedIdsRef.current.includes(l.id)) {
                const init = initialLinesRotRef.current[l.id];

                const dx = init.x - centerX;
                const dy = init.y - centerY;

                const newX = centerX + (dx * cos - dy * sin);
                const newY = centerY + (dx * sin + dy * cos);

                return { 
                    ...l, 
                    rotation: init.rotation + totalDelta,
                    x: newX,
                    y: newY,
                    offsetX: init.offsetX,
                    offsetY: init.offsetY
                };
            }
            return l;
        }));
    }

    const handleRotationEnd = useCallback((e) => {
        if (!selectionBBoxRef.current) return;
    
        const currentBBox = selectionBBoxRef.current;
        const centerX = currentBBox.x + currentBBox.width / 2;
        const centerY = currentBBox.y + currentBBox.height / 2;

        const updatedLines = linesRef.current.map(l => {
            if (!selectedIdsRef.current.includes(l.id)) return l;
            if (!l.rotation) return l; 

            const angleRad = (l.rotation * Math.PI) / 180;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);

            const originX = l.offsetX !== undefined ? l.offsetX : centerX;
            const originY = l.offsetY !== undefined ? l.offsetY : centerY;
            const posX = l.x !== undefined ? l.x : centerX;
            const posY = l.y !== undefined ? l.y : centerY;

            const newPoints = [];
            for (let i = 0; i < l.points.length; i += 2) {
                const px = l.points[i];
                const py = l.points[i + 1];

                const dx = px - originX;
                const dy = py - originY;

                const rx = posX + (dx * cos - dy * sin);
                const ry = posY + (dx * sin + dy * cos);

                newPoints.push(rx, ry);
            }

            return { 
                ...l, 
                points: newPoints,
                rotation: 0,
                x: 0,
                y: 0,
                offsetX: 0,
                offsetY: 0
            };
        });

        setLines(updatedLines);
        linesRef.current = updatedLines;

        selectedIdsRef.current.forEach(id => {
                socketRef.current?.emit('board:draw:line', linesRef.current?.find(l => l.id === id));  
            });

    }, []);

    return (
        <div className="h-screen overflow-hidden relative bg-white" style={{ height: '100dvh' }} onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}>

            <div className="text-xl font-semibold fixed top-1 right-[50vw] translate-x-1/2 z-[1] pointer-events-none">
                <span className="text-violet-700/45">Sync</span>
                <span className="text-black/45">Board</span>
            </div>

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
                    cursor: (tool === 'eraser') ? 'none' : (tool === 'select') ? 'default' : (canDraw ?   'crosshair' : 'default'),
                    display: 'block',
                    touchAction: 'none'
                }}
            >
                <Layer name="draw-layer">
                    {lines.map((line) => {
                        if (line.type === 'circle') {
                            const { x_center, y_center, radius } = computeCircleData(line.points);
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
                        return (
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
                                dash={line.dash}
                                x={line.x}
                                y={line.y}
                                offsetX={line.offsetX}
                                offsetY={line.offsetY}
                                rotation={line.rotation}
                                listening={true}
                            />
                        );
                    })}

                    <Line
                        ref={activeLineRef}
                        tension={0.3}
                        lineCap="round"
                        lineJoin="round"
                        dash={activeLineRef.dash}
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

                    <Line
                        ref={selectionLassoRef}
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        dash={[8, 4]}
                        closed={true}
                        listening={false}
                        visible={false}
                        opacity={0.7}
                    />

                    {selectedIds.length > 0 && lines.filter(l => selectedIds.includes(l.id)).map(l=>{
                        if (l.type === 'circle') {
                            const { x_center, y_center, radius } = computeCircleData(l.points);
                            return (
                                <Circle
                                    key={`sel_${l.id}`}
                                    x={x_center}
                                    y={y_center}
                                    rotation={l.rotation || 0}
                                    radius={radius}
                                    stroke="#3b82f6"
                                    strokeWidth={(l.strokeWidth || 3) + 4}
                                    opacity={0.25}
                                    listening={false}
                                />
                            );
                        }
                        else return (
                            <Line
                                key={`sel_${l.id}`}
                                points={l.points}
                                stroke="#3b82f6"
                                strokeWidth={(l.strokeWidth || 3) + 4}
                                opacity={0.25}
                                tension={l.tension}
                                closed={l.closed}
                                lineCap={l.lineCap}
                                lineJoin={l.lineJoin}
                                x={l.x || 0}
                                y={l.y || 0}
                                offsetX={l.offsetX || 0}
                                offsetY={l.offsetY || 0}
                                rotation={l.rotation || 0}
                                listening={false}
                            />
                        )
                    })}

                    {selectionBBox && (
                        <Group
                            x={selectionBBox.x + selectionBBox.width / 2}
                            y={selectionBBox.y + selectionBBox.height / 2}
                            offsetX={selectionBBox.x + selectionBBox.width / 2}
                            offsetY={selectionBBox.y + selectionBBox.height / 2}
                            rotation={selectionBBoxRotation || 0}
                        >
                            <Rect
                                name="selection-box"
                                x={selectionBBox.x}
                                y={selectionBBox.y}
                                width={selectionBBox.width}
                                height={selectionBBox.height}
                                stroke={SELECTION_BOX_COLOR}
                                strokeWidth={1.5}
                                dash={[6, 3]}
                                listening={true}
                                fill="rgba(59, 130, 246, 0.05)"
                            />

                            <Rect x={selectionBBox.x - 4} y={selectionBBox.y - 4} width={8} height={8} fill={SELECTION_BOX_COLOR} stroke={SELECTION_BOX_COLOR} strokeWidth={1} /> 
                            <Rect x={selectionBBox.x + selectionBBox.width - 4} y={selectionBBox.y - 4} width={8} height={8} fill={SELECTION_BOX_COLOR} stroke={SELECTION_BOX_COLOR} strokeWidth={1} /> 
                            <Rect x={selectionBBox.x - 4} y={selectionBBox.y + selectionBBox.height - 4} width={8} height={8} fill={SELECTION_BOX_COLOR} stroke={SELECTION_BOX_COLOR} strokeWidth={1} /> 
                            <Rect x={selectionBBox.x + selectionBBox.width - 4} y={selectionBBox.y + selectionBBox.height - 4} width={8} height={8} fill={SELECTION_BOX_COLOR} stroke={SELECTION_BOX_COLOR} strokeWidth={1} /> 

                            <Rect x={selectionBBox.x + selectionBBox.width / 2 - 4} y={selectionBBox.y - 4} width={8} height={8} fill={SELECTION_BOX_COLOR} stroke={SELECTION_BOX_COLOR} strokeWidth={1} /> 
                            <Rect x={selectionBBox.x + selectionBBox.width / 2 - 4} y={selectionBBox.y + selectionBBox.height - 4} width={8} height={8} fill={SELECTION_BOX_COLOR} stroke={SELECTION_BOX_COLOR} strokeWidth={1} />
                            <Rect x={selectionBBox.x - 4} y={selectionBBox.y + selectionBBox.height / 2 - 4} width={8} height={8} fill={SELECTION_BOX_COLOR} stroke={SELECTION_BOX_COLOR} strokeWidth={1} /> 
                            <Rect x={selectionBBox.x + selectionBBox.width - 4} y={selectionBBox.y + selectionBBox.height / 2 - 4} width={8} height={8} fill={SELECTION_BOX_COLOR} stroke={SELECTION_BOX_COLOR} strokeWidth={1} /> 

                            <Line 
                                points={[
                                    selectionBBox.x + selectionBBox.width / 2, selectionBBox.y - 25, 
                                    selectionBBox.x + selectionBBox.width / 2, selectionBBox.y
                                ]} 
                                stroke={SELECTION_BOX_COLOR} 
                                strokeWidth={1} 
                                dash={[4, 2]} 
                                listening={false} 
                            />
                        
                            <Group
                                name="rotation-handler"
                                x={selectionBBox.x + selectionBBox.width / 2} 
                                y={selectionBBox.y - 25}
                                listening={true}
                                draggable={true}

                                dragBoundFunc={function(pos) {return this.absolutePosition();}} // this is done to maintain draggable object in-place during dragging

                                onMouseEnter={(e) => { e.target.getStage().container().style.cursor = 'grab'; }}
                                onMouseLeave={(e) => { e.target.getStage().container().style.cursor = 'default'; }}
                                onDragStart={(e) => {handleRotationStart(e)}}
                                onDragMove={(e) => {handleRotationDrag(e)}}
                                onDragEnd={handleRotationEnd}
                            >
                                <Circle 
                                    x={0} 
                                    y={0} 
                                    radius={12} 
                                    fill="white" 
                                    stroke={SELECTION_BOX_COLOR} 
                                    strokeWidth={1.25} 
                                />

                                <Text
                                    x={0} 
                                    y={0} 
                                    text="↻" 
                                    fontSize={18} 
                                    fill={SELECTION_BOX_COLOR} 
                                    offsetX={7} 
                                    offsetY={9.5} 
                                    fontStyle="normal" 
                                />
                            </Group>
                            
                        </Group>
                    )}

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

            <div className="fixed top-2 left-2 flex items-center gap-2 pointer-events-auto z-10">
                <button onClick={() => { navigate('/'); saveThumbnail(); }} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 shadow-sm transition cursor-pointer hover:bg-gray-50 hover:text-gray-900">
                    <ArrowLeft size={14} />
                </button>
                <div className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 font-medium shadown-sm max-w-xs truncate">
                    {board?.name || "Board name"}
                </div>
                {role === 'viewer' && (
                    <span className="px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-500 shadow-sm">
                        View Only
                    </span>
                )}
            </div>

            <div className="fixed top-2 right-2 flex items-center gap-2 pointer-events-auto z-10">
    
                <div className="relative flex flex-col items-end">
                    
                    <button 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 shadow-sm transition cursor-pointer focus:outline-none"
                        onClick={() => setShowPeers((prev) => !prev)}
                    >
                        <Users size={14} />
                        <span>{peers}</span> 
                    </button>

                    <div 
                        className={`
                            absolute top-full right-0 mt-2 p-2 min-w-[180px]
                            bg-white border border-gray-100 rounded-xl shadow-lg
                            flex flex-col gap-1 text-sm text-gray-700 max-h-64
                            transition-all duration-200 origin-top-right z-10 overflow-y-auto
                            overscroll-contain
                            ${showPeers 
                                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
                                : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                            }
                        `}
                    >
                        <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                            Connected users
                        </div>
                        
                            {peerEntries.map((peer) => (
                                <div 
                                    key={peer + `${Date.now()}_${Math.random().toString(36).slice(2)}`} 
                                    className="px-0 py-0.5 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <UserEntry username={(peer === user.username) ? peer + " (You)" : peer} />
                                </div>
                            ))}

                        </div>
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

            <div className="fixed bottom-7.5 right-4 flex items-center gap-2 pointer-events-auto z-10">
                <button
                    onClick={() => setChatOpen((prev) => !prev)} 
                    className="py-2 px-4 rounded-xl bg-white border border-gray-200 text-gray-600 shadow-sm transition cursor-pointer hover:bg-gray-50 hover:text-gray-900"
                >
                    <MessageCircle size={18} />
                </button>
            </div>

            <div 
                className={`
                    fixed bottom-6 right-2 z-20 flex flex-col w-80 md:w-96 h-[92vh]
                    bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden font-sans
                    transition-all duration-300 ease-in-out origin-bottom-right 
                    ${chatOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}                                                                                                                              
                `}
            >
                
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
                    <h3 className="text-base font-semibold text-gray-800">Board chat</h3>
                    <button className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none">
                    <X 
                        className="h-5 w-5" 
                        onClick={() => setChatOpen((prev) => !prev)}
                    />
                    </button>
                </div>

                <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4 min-w-0 break-words overflow-x-hidden">

                    < div className="mx-auto max-w-[90%] bg-gray-200 text-gray-600 font-semibold text-xs text-center px-4 py-2.5 rounded-xl mb-4">
                    Welcome to this board's chat room!<br />
                    <span className="text-xs text-[11px] font-normal">Please be kind to other users.</span>
                    </div>

                    {
                        chatMessages.map((msg) => {
                            if (msg.type === 'own') {
                                return (
                                    <div key={msg.id} className="animate-message flex flex-col w-fit max-w-[85%] min-w-0 break-words ml-auto space-y-1">
                                        <SentMessage
                                            username={"you"}
                                            time={msg.time}
                                            body={msg.body}
                                        />
                                    </div>
                                );
                            }
                            else return (
                                <div key={msg.id} className="animate-message flex flex-col w-fit max-w-[85%] min-w-0 break-words space-y-1">
                                    <ReceivedMessage
                                        username={msg.username}
                                        time={msg.time}
                                        body={msg.body}
                                    />
                                </div>
                            ); 
                        })
                    }

                    <div ref={messagesEndRef} />            

                </div>

                <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
                    <input 
                        type="text"
                        value={inputMessage} 
                        placeholder="Type a message..." 
                        className="flex-1 bg-gray-100 text-gray-800 placeholder-gray-400 text-sm px-4 py-2.5 rounded-full border border-transparent focus:bg-white focus:border-purple-300 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyUp={(e) => {if (!(e.key === 'Enter')) return; sendMessage();}}
                    />
                    
                    <button 
                        className="p-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-1 flex-shrink-0 flex items-center justify-center"
                        onClick={sendMessage}
                    >
                        <Send size={18} /> 
                    </button>
                </div>

            </div>

            <div>
                {canDraw && (
                    <Toolbar
                        tool={tool} setTool={setTool}
                        shape={shape} setShape={setShape}
                        brushColor={brushColor} highlighterColor={highlighterColor} setColor={setColor}
                        activeSize={activeSize} setActiveSize={setActiveSize}
                        strokeWidth={strokeWidth} highlighterSize={highlighterSize} eraserSize={eraserSize} shapeWidth={shapeWidth}
                        highlighterOpacity={highlighterOpacity} setHighlighterOpacity={setHighlighterOpacity}
                        selectedShapeMenu={selectedShapeMenu} setSelectedShapeMenu={setSelectedShapeMenu}
                        selectedHighlighterMenu={selectedHighlighterMenu} setSelectedHighlighterMenu={setSelectedHighlighterMenu}
                        shapeBorderColor={shapeBorderColor} setShapeBorderColor={setShapeBorderColor}
                        shapeColor={shapeColor} setShapeColor={setShapeColor}
                        shapeBorderOpacity={shapeBorderOpacity} setShapeBorderOpacity={setShapeBorderOpacity}
                        shapeFillOpacity={shapeFillOpacity} setShapeFillOpacity={setShapeFillOpacity}
                        fillShape={fillShape} setFillShape={setFillShape}
                        editHistory={editHistory} handleUndo={handleUndo} handleRedo={handleRedo}
                    />
                )}
            </div>

            {showShareModal && (
                <ShareModal
                    board={board}
                    setBoard={setBoard}
                    boardId={id}
                    lines={lines}
                    onClose={() => setShowShareModal(false)}
                    onExportPng={exportToPng}
                    onExportPdf={exportToPDF}
                />
            )}
        </div>
    );
}

function SentMessage({time, body}) {
    return (
    <div className="flex flex-col w-full min-w-0 space-y-1">
        <div className="flex items-baseline justify-between space-x-2 px-1 w-full">
            <span className="text-xs font-medium text-purple-600">You</span>
            <span className="text-xs text-gray-400">{time}</span>
        </div>

        <div className="bg-purple-100 border border-purple-200 p-3 rounded-2xl rounded-tr-sm text-sm text-purple-900 shadow-sm w-fit max-w-full break-words whitespace-pre-wrap">
            {body}
        </div>
    </div>
    )
}

function ReceivedMessage({username, time, body}) {
    return (
        <div className="flex flex-col w-full min-w-0 space-y-1">

            <div className="flex items-baseline justify-between px-1 w-full space-x-2">
                <span className="text-xs font-medium text-gray-600">{username}</span>
                <span className="text-xs text-gray-400">{time}</span>
            </div>

            <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-sm text-sm text-gray-700 shadow-sm w-fit max-w-full break-words whitespace-pre-wrap">
                {body}
            </div>
        </div>
    )
}

function UserEntry({username}) {
    return (
        <div className='px-2'>
            <User className='inline' size={16} /> {username}
        </div>
    )
}
