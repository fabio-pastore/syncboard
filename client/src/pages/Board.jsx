import { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer } from "react-konva";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import useSocket from "../hooks/useSocket";
import useExport from "../hooks/useExport";
import useTouchHandlers from "../hooks/useTouchHandlers";
import useShapeDrag from "../hooks/useShapeDrag";
import useShapeRotate from "../hooks/useShapeRotate";
import useShapeResize from "../hooks/useShapeResize";
import useBackground from "../hooks/useBackground";
import useEditHistory from "../hooks/useEditHistory";
import ShareModal from "../components/board/ShareModal";
import Toolbar from "../components/board/Toolbar";
import HeaderBar from "../components/board/HeaderBar";
import ChatPanel from "../components/board/ChatPanel";
import ZoomIndicator from "../components/board/ZoomIndicator";
import SelectionBox from "../components/board/SelectionBox";
import DrawingLines from "../components/board/DrawingLines";
import CursorOverlay from "../components/board/CursorOverlay";
import SelectionContextMenu from "../components/board/SelectionContextMenu";
import StageContextMenu from "../components/board/StageContextMenu";

import { UPDATE_INTERVAL, NUM_MAX_UNDO, MIN_POINT_DISTANCE, MIN_POINT_DISTANCE_PEN, WAIT_BEFORE_EXIT,
         ZOOM_DISPLAY_TIME, CURSOR_EMIT_INTERVAL } from "../utils/boardConstants";

import { hexToRgba, smoothPoints, computeTrianglePoints, computeRectanglePoints, computeCircleData,
         lineIntersectsOrInsidePolygon, computeSelectionBBox } from "../utils/boardUtils";

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

    const [isManipulating, setIsManipulating] = useState(false);
    const [isOpenContextMenu, setIsOpenContextMenu] = useState(false);
    const [hasZoomed, setHasZoomed] = useState(false);

    const [selectedIds, setSelectedIds] = useState([]);
    const [selectionLasso, setSelectionLasso] = useState(null);
    const [selectionBBox, setSelectionBBox] = useState(null);
    const [selectionBBoxRotation, setSelectionBBoxRotation] = useState(0);
    const [isDraggingSelection, setIsDraggingSelection] = useState(false);

    const stageRef = useRef(null);
    const scaleRef = useRef(1.0);
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
    const [touchDrawMode, setTouchDrawMode] = useState(false);
    const touchDrawModeRef = useRef(false);

    const selectedIdsRef = useRef([]);
    const selectionLassoDataRef = useRef(null);
    const selectionBBoxRef = useRef(null);

    const rightClickPosRef = useRef({ x: 0, y: 0 });
    const rightClickScreenPosRef = useRef({ x: 0, y: 0 });
    const lastCursorEmitRef = useRef(0);
    const lastEmittedPointCountRef = useRef(0);

    const containerRef = useRef(null);

    useEffect(() => {scaleRef.current = scale}, [scale]);
    useEffect(() => { selectedIdsRef.current = selectedIds }, [selectedIds]);
    useEffect(() => { selectionLassoDataRef.current = selectionLasso }, [selectionLasso]);
    useEffect(() => { selectionBBoxRef.current = selectionBBox }, [selectionBBox]);
    useEffect(() => { touchDrawModeRef.current = touchDrawMode }, [touchDrawMode]);

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
        if (selectedIdsRef.current.includes(shapeId)) clearSelection();
    }, [clearSelection]);

    const sortLinesByTime = (linesArray) => {
        return [...linesArray].sort((x, y) => {
            const timeX = parseInt(x.id.split('_')[0], 10);
            const timeY = parseInt(y.id.split('_')[0], 10);
            return timeX - timeY;
        });
    };

    const reorderLines = useCallback((lines) => sortLinesByTime(lines), []);

    const { board, setBoard, lines, setLines, peers, peerEntries, setPeerEntries,
            role, error, setError, socketRef, chatOpenRef, chatOpen, setChatOpen, chatMessages,
            setChatMessages, unreadMessages, setUnreadMessages, cursors, bgColor, setBgColor,
            bgPattern, setBgPattern } = useSocket({ id, token, shared, onShapeUpdate: handleOtherClientEdit, reorderLines });

    useEffect(() => { linesRef.current = lines }, [lines]);
    useEffect(() => { toolRef.current = tool }, [tool]);
    useEffect(() => { shapeRef.current = shape }, [shape]);

    const { updateBackgroundStyle, handleBgPatternEdit, handleBgColorEdit } = useBackground({
        containerRef, socketRef, stagePositionRef, scale, bgPattern, setBgPattern, bgColor, setBgColor
    });

    const { handleUndo, handleRedo, handleCopy, handlePaste, handleModifySelection, handleDeleteSelection, copiedLinesRef } = useEditHistory({
        setEditHistory, setLines, socketRef, linesRef, selectedIdsRef, selectedIds,
        clearSelection, stageRef, setIsOpenContextMenu, sortLinesByTime
    });

    const { isDraggingSelectionRef, handleDragStart, handleDragMove, handleDragEnd } = useShapeDrag({
        stageRef, linesRef, setLines, selectionBBoxRef, setSelectionBBox, selectedIdsRef, setEditHistory, socketRef, setIsDraggingSelection, setIsManipulating
    });

    const { isRotatingRef, handleRotationStart, handleRotationDrag, handleRotationEnd } = useShapeRotate({
        stageRef, linesRef, setLines, selectionBBoxRef, selectionBBoxRotation, setSelectionBBoxRotation, selectedIdsRef, setEditHistory, socketRef, setIsManipulating
    });

    const { isResizingRef, handleResizeStart, handleResizeDrag, handleResizeEnd } = useShapeResize({
        stageRef, linesRef, setLines, selectionBBoxRef, selectionBBoxRotation, setSelectionBBox, selectedIdsRef, setEditHistory, socketRef, setIsManipulating
    });

    const { touchCountRef } = useTouchHandlers({
        stageRef, setScale, scaleRef, isDrawingRef, activeLineRef, activeLineDataRef, isRotatingRef,
        activeCircleStrokeRef, activeCircleFillRef, isPenActiveRef, isResizingRef,
        touchDrawModeRef, stagePositionRef, updateBackgroundStyle
    });

    const { exportToPng, exportToPDF, saveThumbnail } = useExport({ stageRef, linesRef, lines, board, id, shared, bgColor, bgPattern });

    const canDraw = (role === 'editor');

    useEffect(() => {
        function onResize() { setStageSize({ width: window.innerWidth, height: window.innerHeight }); }
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
        setIsOpenContextMenu(false);
    }, [tool, clearSelection]);

    const displayZoomMeter = () => {
        setHasZoomed(true);
        setTimeout(() => {
            setHasZoomed(false);
        }, ZOOM_DISPLAY_TIME);
    }

    const handlePointerDown = useCallback((e) => {
        setIsOpenContextMenu(false);
        if (isPanningRef.current) return;
        if (e.target !== e.target.getStage() && e.target.name() !== 'selection-box' && !e.target.id()) return;

        
        if (e.evt.pointerType === 'touch') {
            if (!touchDrawModeRef.current) return; // stylus mode: block all touch drawing
            if (touchCountRef.current >= 2) return; // 2+ fingers: let useTouchHandlers do pan/zoom
        }

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

        if (!canDraw) return;
        if (e.evt.pointerType !== 'pen' && e.evt.pointerType !== 'touch' && e.evt.button !== 0) return;
        e.evt.preventDefault();
        pointerTypeRef.current = e.evt.pointerType || 'mouse';
        if (e.evt.pointerType === 'pen') isPenActiveRef.current = true;
        isDrawingRef.current = true;

        const stage = stageRef.current;
        const pointerPos = stage.getPointerPosition();
        let newLine = null;
        const pointerScale = stage.scaleX() || 1;

        if (toolRef.current === 'shape') {
            const pos = { x: (pointerPos.x - stage.x()) / pointerScale, y: (pointerPos.y - stage.y()) / pointerScale };
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
                        if (prev.history.slice(0, prev.editIndex + 1).some(item => item.op === 'erase' && item.line.id === lineId)) return prev;
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
            if (e.target.name() === 'selection-box' && selectionBBoxRef.current) {
                const pos = { x: (pointerPos.x - stage.x()) / pointerScale, y: (pointerPos.y - stage.y()) / pointerScale };
                handleDragStart(pos);
                return;
            }
            clearSelection();
            isDrawingRef.current = true;
            const pos = { x: (pointerPos.x - stage.x()) / pointerScale, y: (pointerPos.y - stage.y()) / pointerScale };
            setSelectionLasso([pos.x, pos.y]);
            if (selectionLassoRef.current) {
                selectionLassoRef.current.points([pos.x, pos.y]);
                selectionLassoRef.current.show();
                selectionLassoRef.current.getLayer().batchDraw();
            }
            return;
        }

        const pos = { x: (pointerPos.x - stage.x()) / pointerScale, y: (pointerPos.y - stage.y()) / pointerScale };
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
        lastEmittedPointCountRef.current = 0;
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
                } else activeCircleFillRef.current.hide();

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
    }, [canDraw, brushColor, highlighterColor, highlighterOpacity, strokeWidth, highlighterSize, shapeWidth, shapeColor, shapeBorderColor, fillShape, shapeFillOpacity, shapeBorderOpacity, clearSelection, handleDragStart]);

    const handlePointerMove = useCallback((e) => {
        const stage = stageRef.current;
        const pointerPos = stage.getPointerPosition();
        const pointerScale = stage.scaleX() || 1;

        const cursorNow = Date.now();
        if (cursorNow - lastCursorEmitRef.current > CURSOR_EMIT_INTERVAL) {
            const cursorPos = {
                x: (pointerPos.x - stage.x()) / pointerScale,
                y: (pointerPos.y - stage.y()) / pointerScale,
                viewport: {
                    x1: -stage.x() / pointerScale,
                    y1: -stage.y() / pointerScale,
                    x2: (window.innerWidth - stage.x()) / pointerScale,
                    y2: (window.innerHeight - stage.y()) / pointerScale,
                },
            };
            socketRef.current?.emit('board:cursor:move', cursorPos);
            lastCursorEmitRef.current = cursorNow;
        }

        if (isResizingRef.current) {
            handleResizeDrag(pointerPos, pointerScale);
            return;
        }

        if (isRotatingRef.current) {
            if (e.evt.preventDefault) e.evt.preventDefault();
            handleRotationDrag(pointerPos, pointerScale);
            return;
        }

        if (isPanningRef.current) {
            const newPos = {
                x: e.evt.clientX - panStartRef.current.x,
                y: e.evt.clientY - panStartRef.current.y,
            };
            stageRef.current.position(newPos);
            stagePositionRef.current = newPos;
            updateBackgroundStyle(newPos, scaleRef.current);
            return;
        }

        // in stylus mode block touch from drawing and in finger-draw mode, allow touch
        if (e.evt.pointerType === 'touch' && !touchDrawModeRef.current) return;
        if (!canDraw) return;

        if (eraserCursorRef.current) {
            eraserCursorRef.current.style.left = `${e.evt.clientX}px`;
            eraserCursorRef.current.style.top = `${e.evt.clientY}px`;
        }

        if (!isDrawingRef.current) return;

        if (toolRef.current === 'eraser') {
            const shape = stageRef.current.getIntersection(pointerPos);
            if (shape && (shape.getClassName() === 'Line' || shape.getClassName() == 'Circle')) {
                const lineId = shape.id();
                const lineData = linesRef.current?.find(l => l.id === lineId);
                if (lineData) {
                    setLines((prev) => prev.filter((l) => l.id !== lineId));
                    setEditHistory((prev) => {
                        if (prev.history.slice(1, prev.editIndex + 1).some(item => item.op === 'erase' && item.line.id === lineId)) return prev;
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
            if (isDraggingSelectionRef.current) {
                handleDragMove(pointerPos, pointerScale);
                return;
            }
            if (!isDrawingRef.current) return;
            const pos = { x: (pointerPos.x - stage.x()) / pointerScale, y: (pointerPos.y - stage.y()) / pointerScale };
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

        const pos = { x: (pointerPos.x - stage.x()) / pointerScale, y: (pointerPos.y - stage.y()) / pointerScale };

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
                    if (dx * dx + dy * dy >= minSpaceSq) pts.push(pos_x, pos_y);
                }
            } else {
                const lastX = pts[pts.length - 2];
                const lastY = pts[pts.length - 1];
                const dx = pos.x - lastX;
                const dy = pos.y - lastY;
                if (dx * dx + dy * dy >= minSpaceSq) pts.push(pos.x, pos.y);
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
            const line = activeLineDataRef.current;
            const isFreehand = line.type === 'line' && line.tension > 0;

            if (isFreehand && lastEmittedPointCountRef.current > 0) {
                const newPoints = line.points.slice(lastEmittedPointCountRef.current);
                if (newPoints.length > 0) {
                    socketRef.current?.emit('board:draw:tmpline', {
                        id: line.id,
                        newPoints,
                        isDelta: true,
                    });
                }
            } else {
                socketRef.current?.emit('board:draw:tmpline', line);
            }
            lastEmittedPointCountRef.current = line.points.length;
            setLastUpdate(now);
        }
    }, [canDraw, handleResizeDrag, handleRotationDrag, handleDragMove, isResizingRef, isRotatingRef, isDraggingSelectionRef]);

    const handlePointerUp = useCallback((e) => {
        if (isResizingRef.current) {
            handleResizeEnd();
            setIsManipulating(false);
            return;
        }

        if (isRotatingRef.current) {
            handleRotationEnd();
            setIsManipulating(false);
            return;
        }

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
                handleDragEnd();
                return;
            }

            if (!selectionLassoDataRef.current || selectionLassoDataRef.current.length < 6) {
                clearSelection();
                return;
            }

            const lasso = selectionLassoDataRef.current;
            const selected = linesRef.current.filter(l => lineIntersectsOrInsidePolygon(l, lasso));
            const selectedIds = selected.map(l => l.id);
            setSelectedIds(selectedIds);

            if (selectedIds.length > 0) {
                const rawBBox = computeSelectionBBox(selected);
                setSelectionBBox({
                    ...rawBBox,
                    globalCenterX: rawBBox.x + rawBBox.width / 2,
                    globalCenterY: rawBBox.y + rawBBox.height / 2
                });
                setSelectionBBoxRotation(0);
            }

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
        lastEmittedPointCountRef.current = 0;

        setEditHistory((prev) => {
            let newHistory;
            if (prev.history.length < NUM_MAX_UNDO) newHistory = [...prev.history.slice(0, prev.editIndex + 1), { line: finishedLine, op: "draw" }];
            else newHistory = [...prev.history.slice(1, prev.editIndex + 1), { line: finishedLine, op: "draw" }];
            return { history: newHistory, editIndex: newHistory.length - 1 };
        });

        socketRef.current?.emit('board:draw:line', finishedLine);
    }, [clearSelection, handleRotationEnd, handleResizeEnd, handleDragEnd, isResizingRef, isRotatingRef, isDraggingSelectionRef]);


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
            scaleRef.current = clampedScale;
            displayZoomMeter();
            const newPos = {
                x: pointer.x - mousePointTo.x * clampedScale,
                y: pointer.y - mousePointTo.y * clampedScale,
            };
            stage.position(newPos);
            stagePositionRef.current = newPos;
            updateBackgroundStyle(newPos, clampedScale);
        } else {
            const dx = e.evt.deltaX;
            const dy = e.evt.deltaY;
            const newPos = { x: stage.x() - dx, y: stage.y() - dy };
            stage.position(newPos);
            stagePositionRef.current = newPos;
            updateBackgroundStyle(newPos, scaleRef.current);
        }
    }, []);

    const activeSize = (tool === 'eraser') ? eraserSize : (tool === 'highlighter') ? highlighterSize : (tool === 'shape') ? shapeWidth : strokeWidth;
    const setActiveSize = (fn) => {
        setIsOpenContextMenu(false);
        switch (toolRef.current) {
            case 'pen': setStrokeWidth(fn); break;
            case 'highlighter': setHighlighterSize(fn); break;
            case 'eraser': setEraserSize(fn); break;
            case 'shape': setShapeWidth(fn); break;
            default: console.error("[SyncBoard] Unknown tool selected!");
        }
    };
    const setColor = (fn) => {
        if (tool === 'highlighter') setHighlighterColor(fn)
        else setBrushColor(fn)
        setIsOpenContextMenu(false);
    };

    const handleExitAndSaveThumbnail = () => {
        clearSelection();
        setTimeout(() => {
            saveThumbnail();
            navigate('/dashboard');
        }, WAIT_BEFORE_EXIT);
    };

    const selectionMenuVisible = selectedIds.length > 0 && selectionBBox && !isManipulating;
    const selectionMenuPosition = (() => {
        if (!selectionBBox) return { x: 0, y: 0 };
        const stage = stageRef.current;
        if (!stage) return { x: 0, y: 0 };
        const s = stage.scaleX() || 1;

        const cx = selectionBBox.globalCenterX ?? (selectionBBox.x + selectionBBox.width / 2);
        const cy = selectionBBox.globalCenterY ?? (selectionBBox.y + selectionBBox.height / 2);
        const hw = selectionBBox.width / 2;
        const hh = selectionBBox.height / 2;

        const angle = (selectionBBoxRotation || 0) * Math.PI / 180;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const handleLocalPositions = [[-hw, -hh], [0, -hh], [hw, -hh], [hw, 0], [hw, hh], [0, hh], [-hw, hh], [-hw, 0], [0, -hh - 25]];
        let my = Infinity;
        for (const [lx, ly] of handleLocalPositions) {
            const ry = lx * sinA + ly * cosA;
            if (ry < my) my = ry;
        }

        let x = cx * s + stage.x();
        let y = (cy + my) * s + stage.y() - 25;

        const menuWidth = 90, menuHeight = 44, padding = 8;
        x = Math.max(menuWidth / 2 + padding, Math.min(x, window.innerWidth - menuWidth / 2 - padding));
        y = Math.max(menuHeight + padding, Math.min(y, window.innerHeight - padding));

        return { x, y };
    })();

    const handleContextMenuOpen = (e) => {
        e.evt.preventDefault();
        if (isManipulating || selectionBBox) return;

        const stage = stageRef.current;
        const pointerPos = stage.getPointerPosition();
        const pointerScale = stage.scaleX() || 1;

        rightClickPosRef.current = {
            x: (pointerPos.x - stage.x()) / pointerScale,
            y: (pointerPos.y - stage.y()) / pointerScale
        };

        rightClickScreenPosRef.current = {
            x: e.evt.clientX,
            y: e.evt.clientY,
        };

        setIsOpenContextMenu(true);
    }

    return (
        <div
            ref={containerRef}
            className="h-screen overflow-hidden relative"
            style={{ height: '100dvh', backgroundColor: bgColor }}
            onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
        >

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
                onContextMenu={(e) => handleContextMenuOpen(e)}
                style={{
                    cursor: (tool === 'eraser') ? 'none' : (tool === 'select') ? 'default' : (canDraw ? 'crosshair' : 'default'),
                    display: 'block',
                    touchAction: 'none'
                }}
            >
                <Layer name="draw-layer">
                    <DrawingLines
                        lines={lines}
                        selectedIds={selectedIds}
                        activeLineRef={activeLineRef}
                        activeCircleFillRef={activeCircleFillRef}
                        activeCircleStrokeRef={activeCircleStrokeRef}
                        selectionLassoRef={selectionLassoRef}
                    />

                    <SelectionBox
                        selectionBBox={selectionBBox}
                        selectionBBoxRotation={selectionBBoxRotation}
                        handleResizeStart={handleResizeStart}
                        handleRotationStart={handleRotationStart}
                        setIsManipulating={setIsManipulating}
                        stageRef={stageRef}
                    />
                </Layer>

                <Layer name="cursors-layer" listening={false}>
                    <CursorOverlay cursors={cursors} />
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

            <HeaderBar
                board={board}
                role={role}
                shared={shared}
                peers={peers}
                peerEntries={peerEntries}
                user={user}
                showPeers={showPeers}
                setShowPeers={setShowPeers}
                onExit={handleExitAndSaveThumbnail}
                onShare={() => setShowShareModal(true)}
                setIsOpenContextMenu={setIsOpenContextMenu}
            />

            <ZoomIndicator scale={scale} hasZoomed={hasZoomed} />

            <ChatPanel
                chatOpen={chatOpen}
                setChatOpen={setChatOpen}
                chatMessages={chatMessages}
                setChatMessages={setChatMessages}
                unreadMessages={unreadMessages}
                setUnreadMessages={setUnreadMessages}
                socketRef={socketRef}
                user={user}
                setIsOpenContextMenu={setIsOpenContextMenu}
            />

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
                        touchDrawMode={touchDrawMode} setTouchDrawMode={setTouchDrawMode}
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

            <SelectionContextMenu
                visible={selectionMenuVisible}
                selectedLines={lines.filter(l => selectedIds.includes(l.id))}
                onCopy={handleCopy}
                onModify={handleModifySelection}
                onDelete={handleDeleteSelection}
                position={selectionMenuPosition}
            />

            <StageContextMenu
                visible={isOpenContextMenu}
                disabled={copiedLinesRef.current.length === 0}
                onPaste={() => {
                    handlePaste(rightClickPosRef.current, true);
                    setIsOpenContextMenu(false);
                }}
                position={rightClickScreenPosRef.current}
                onClose={() => setIsOpenContextMenu(false)}
                currentBackground={bgPattern}
                onBackgroundChange={handleBgPatternEdit}
                canModifyBackground={role === 'editor'}
                currentBgColor={bgColor}
                onBgColorChange={handleBgColorEdit}
            />
            
        </div>
    );
}