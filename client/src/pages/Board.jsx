import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { Stage, Layer, Line, Circle, Rect } from "react-konva";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Users, Share2 } from "lucide-react";

import { UPDATE_INTERVAL, NUM_MAX_UNDO, MIN_POINT_DISTANCE, MIN_POINT_DISTANCE_PEN } from "../utils/boardConstants";
import { hexToRgba, smoothPoints, computeTrianglePoints, computeRectanglePoints, computeCircleData, lineIntersectsOrInsidePolygon, computeSelectionBBox, translatePoints} from "../utils/boardUtils";
import useSocket from "../hooks/useSocket";
import useExport from "../hooks/useExport";
import useTouchHandlers from "../hooks/useTouchHandlers";
import ShareModal from "../components/board/ShareModal";
import Toolbar from "../components/board/Toolbar";

export default function Board({ shared = false }) {
    const { id, token } = useParams();
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
    useEffect(() => {selectedIdsRef.current = selectedIds}, [selectedIds]);
    useEffect(() => {selectionLassoDataRef.current = selectionLasso}, [selectionLasso]);
    useEffect(() => {selectionBBoxRef.current = selectionBBox}, [selectionBBox]);
    useEffect(() => {isDraggingSelectionRef.current = isDraggingSelection}, [isDraggingSelection]);

    const { board, setBoard, lines, setLines, peers, role, error, socketRef } = useSocket({ id, token, shared });

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
                    line.hitStrokeWidth(eraserSize);
                });
            }
        }
    }, [eraserSize, tool]);

    const clearSelection = useCallback(() => {
        setSelectedIds([]);
        setSelectionLasso(null);
        setSelectionBBox(null);
        setIsDraggingSelection(false);
        if (selectionLassoRef.current) {
            selectionLassoRef.current.hide();
            selectionLassoRef.current.getLayer().batchDraw();
        }
    }, []);

    useEffect(() => {
        toolRef.current = tool;
        if (tool !== 'select') clearSelection();
    }, [tool]);

    const handlePointerDown = useCallback((e) => {
        if (isPanningRef.current) return;
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
                        return {...l, points: translatePoints(l.points, dx, dy)};
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
                    {selectionBBox && (
                        <>
                            <Rect
                                x={selectionBBox.x}
                                y={selectionBBox.y}
                                width={selectionBBox.width}
                                height={selectionBBox.height}
                                stroke={SELECTION_BOX_COLOR}
                                strokeWidth={1.5}
                                dash={[6, 3]}
                                listening={false}
                                fill="rgba(59, 130, 246, 0.05)"
                            />
                        </>
                    )   
                    }

                    {selectedIds.length > 0 && lines.filter(l => selectedIds.includes(l.id)).map(l=>(
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
                            listening={false}
                        />
                    ))}
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

            <div className="fixed bottom-2 right-2 flex items-center gap-2 pointer-events-auto z-10">
                <button className="py-2 px-8 rounded-xl bg-white border border-gray-200 text-gray-600 shadow-sm transition cursor-pointer hover:bg-gray-50 hover:text-gray-900">
                    <MessageCircle size={18} />
                </button>
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
