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
import useToolbarState from "../hooks/useToolbarState";
import useBoardPointerEvents from "../hooks/useBoardPointerEvents";
import useSelectionMenu from "../hooks/useSelectionMenu";
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
import LoadingScreen from "../components/LoadingScreen";

import { WAIT_BEFORE_EXIT, ZOOM_DISPLAY_TIME } from "../utils/boardConstants";

/**
 * The main collaborative board page component.
 *
 * Orchestrates all board interactions by composing hooks for socket communication,
 * toolbar state, pointer events, shape manipulation (drag, resize, rotate),
 * selection, export, background, and undo/redo history. Renders the Konva Stage
 * with drawing layers, cursor overlay, and all UI overlays (header, toolbar,
 * chat panel, modals, context menus).
 *
 * Handles both regular board access (by ID) and shared board access (by token).
 * Displays a loading screen while the board data and socket connection are
 * being initialized.
 *
 * @param {object} props - Component props.
 * @param {boolean} [props.shared=false] - Whether the board is accessed via a share link.
 * @returns {JSX.Element} The board page or a loading screen.
 */

export default function Board({ shared = false }) {
    const { id, token } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [scale, setScale] = useState(1);
    const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [editHistory, setEditHistory] = useState({ history: [], editIndex: -1 });
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

    const toolbarState = useToolbarState();
    const {
        tool, setTool, brushColor, setBrushColor, highlighterColor, setHighlighterColor,
        shapeColor, setShapeColor, shapeBorderColor, setShapeBorderColor,
        shapeFillOpacity, setShapeFillOpacity, shapeBorderOpacity, setShapeBorderOpacity,
        fillShape, setFillShape, selectedShapeMenu, setSelectedShapeMenu,
        shape, setShape, strokeWidth, setStrokeWidth, shapeWidth, setShapeWidth,
        eraserSize, setEraserSize, highlighterSize, setHighlighterSize,
        highlighterOpacity, setHighlighterOpacity, selectedHighlighterMenu, setSelectedHighlighterMenu,
        touchDrawMode, setTouchDrawMode
    } = toolbarState;

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
    const touchDrawModeRef = useRef(false);

    const selectedIdsRef = useRef([]);
    const selectionLassoDataRef = useRef(null);
    const selectionBBoxRef = useRef(null);

    const rightClickPosRef = useRef({ x: 0, y: 0 });
    const rightClickScreenPosRef = useRef({ x: 0, y: 0 });
    const lastCursorEmitRef = useRef(0);
    const lastEmittedPointCountRef = useRef(0);

    const containerRef = useRef(null);
    const zoomTimeoutRef = useRef(null);

    useEffect(() => {scaleRef.current = scale}, [scale]);
    useEffect(() => { selectedIdsRef.current = selectedIds }, [selectedIds]);
    useEffect(() => { selectionLassoDataRef.current = selectionLasso }, [selectionLasso]);
    useEffect(() => { selectionBBoxRef.current = selectionBBox }, [selectionBBox]);
    useEffect(() => { touchDrawModeRef.current = touchDrawMode }, [touchDrawMode]);

    const [showPeers, setShowPeers] = useState(false);

    /**
     * Clears the current selection state (selected IDs, lasso, bounding box).
     */
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

    /**
     * Callback invoked when another client edits a shape.
     * If the edited shape is currently selected, clears the selection to
     * prevent display of an outdated bounding box.
     *
     * @param {string} shapeId - The ID of the shape that was edited.
     */
    const handleOtherClientEdit = useCallback((shapeId) => {
        if (selectedIdsRef.current.includes(shapeId)) clearSelection();
    }, [clearSelection]);

    /**
     * Sorts an array of line objects by their creation timestamp (parsed from ID).
     *
     * @param {Array} linesArray - The array of line objects to sort.
     * @returns {Array} A new sorted array.
     */
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
            bgPattern, setBgPattern, isLoading } = useSocket({ id, token, shared, onShapeUpdate: handleOtherClientEdit, reorderLines });

    useEffect(() => { linesRef.current = lines }, [lines]);
    useEffect(() => { toolRef.current = tool }, [tool]);
    useEffect(() => { shapeRef.current = shape }, [shape]);

    const canDraw = (role === 'editor');

    const { updateBackgroundStyle, handleBgPatternEdit, handleBgColorEdit } = useBackground({
        containerRef, socketRef, stagePositionRef, scale, bgPattern, setBgPattern, bgColor, setBgColor
    });

    const { handleUndo, handleRedo, handleCopy, handlePaste, handleModifySelection, handleDeleteSelection, copiedLinesRef } = useEditHistory({
        setEditHistory, setLines, socketRef, linesRef, selectedIdsRef, selectedIds,
        clearSelection, stageRef, setIsOpenContextMenu, sortLinesByTime, canDraw
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
    
    /**
     * Displays the zoom indicator and schedules its automatic dismissal after ZOOM_DISPLAY_TIME.
     */
    const displayZoomMeter = useCallback(() => {
        setHasZoomed(true);
        if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = setTimeout(() => {
            setHasZoomed(false);
        }, ZOOM_DISPLAY_TIME);
    }, []);

    const { touchCountRef } = useTouchHandlers({
        stageRef, setScale, scaleRef, isDrawingRef, activeLineRef, activeLineDataRef, isRotatingRef,
        activeCircleStrokeRef, activeCircleFillRef, isPenActiveRef, isResizingRef, isLoading,
        touchDrawModeRef, stagePositionRef, updateBackgroundStyle, displayZoomMeter
    });

    const { exportToPng, exportToPDF, saveThumbnail } = useExport({ stageRef, linesRef, lines, board, id, shared, bgColor, bgPattern });

    const {
        handlePointerDown, handlePointerMove, handlePointerUp,
        handlePointerEnter, handlePointerLeave, handleWheel
    } = useBoardPointerEvents({
        stageRef, toolRef, shapeRef, isDrawingRef, activeLineDataRef, activeLineRef,
        activeCircleStrokeRef, activeCircleFillRef, isPanningRef, panStartRef,
        stagePositionRef, pointerTypeRef, isPenActiveRef, selectionLassoRef,
        touchDrawModeRef, lastCursorEmitRef, lastEmittedPointCountRef, linesRef,
        selectedIdsRef, selectionLassoDataRef, selectionBBoxRef, eraserCursorRef,
        canDraw, brushColor, highlighterColor, highlighterOpacity, strokeWidth,
        highlighterSize, shapeWidth, shapeColor, shapeBorderColor, fillShape,
        shapeFillOpacity, shapeBorderOpacity, clearSelection, handleDragStart,
        handleDragMove, handleDragEnd, handleRotationDrag, handleRotationEnd,
        handleResizeDrag, handleResizeEnd, isResizingRef, isRotatingRef,
        isDraggingSelectionRef, setSelectionLasso, setSelectedIds, setSelectionBBox,
        setSelectionBBoxRotation, setLines, setEditHistory, socketRef,
        updateBackgroundStyle, scaleRef, setScale, displayZoomMeter,
        setIsOpenContextMenu, setIsManipulating, touchCountRef,
        lastUpdate, setLastUpdate, eraserSize
    });

    const { selectionMenuVisible, selectionMenuPosition } = useSelectionMenu({
        selectedIds, selectionBBox, selectionBBoxRotation, isManipulating, stageRef
    });

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

    const activeSize = (tool === 'eraser') ? eraserSize : (tool === 'highlighter') ? highlighterSize : (tool === 'shape') ? shapeWidth : strokeWidth;
    
    /**
     * Sets the active size for the current tool.
     * @param {function} fn - A function that receives the current size and returns the new size.
     */
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

    /**
     * Sets the color for the current tool (brush or highlighter).
     * @param {string} fn - The new color hex value.
     */
    const setColor = (fn) => {
        if (tool === 'highlighter') setHighlighterColor(fn)
        else setBrushColor(fn)
        setIsOpenContextMenu(false);
    };

    /**
     * Handles the exit action: saves a thumbnail of the board and navigates to the dashboard.
     */
    const handleExitAndSaveThumbnail = () => {
        clearSelection();
        setTimeout(() => {
            saveThumbnail();
            navigate('/dashboard');
        }, WAIT_BEFORE_EXIT);
    };

    /**
     * Handles the right-click context menu event on the stage.
     * Records the pointer position in both world and screen coordinates.
     *
     * @param {object} e - The Konva event object.
     */
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

    if (isLoading) return <LoadingScreen />;

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
                        {...toolbarState}
                        setColor={setColor}
                        activeSize={activeSize} setActiveSize={setActiveSize}
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