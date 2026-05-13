import { useRef, useCallback } from "react";
import { NUM_MAX_UNDO, UPDATE_INTERVAL } from "../utils/boardConstants";
import { translatePoints } from "../utils/boardUtils";

/**
 * Manages the dragging of selected shapes on the board.
 *
 * Handles the start, move, and end phases of a drag operation on the current
 * selection. Updates the positions of all selected lines in real-time, throttles
 * socket emissions for collaborative previews, and records the drag in the edit
 * history for undo/redo.
 *
 * @param {object} params - Hook parameters.
 * @param {React.RefObject} params.stageRef - Ref to the Konva Stage instance.
 * @param {React.MutableRefObject<Array>} params.linesRef - Ref to the current lines array.
 * @param {function} params.setLines - Sets the complete lines array.
 * @param {React.MutableRefObject<object|null>} params.selectionBBoxRef - Ref to the selection bounding box.
 * @param {function} params.setSelectionBBox - Sets the selection bounding box.
 * @param {React.MutableRefObject<Array<string>>} params.selectedIdsRef - Ref to the array of selected line IDs.
 * @param {function} params.setEditHistory - Sets the edit history state.
 * @param {React.MutableRefObject} params.socketRef - Ref to the active socket connection.
 * @param {function} params.setIsDraggingSelection - Sets the dragging selection state.
 * @param {function} params.setIsManipulating - Sets the global manipulating state.
 * @returns {object} An object containing:
 *   - isDraggingSelectionRef {React.MutableRefObject<boolean>}: Ref tracking if a drag is active.
 *   - handleDragStart {function}: Initiates the drag operation.
 *   - handleDragMove {function}: Updates positions during the drag.
 *   - handleDragEnd {function}: Finalizes the drag and records it in history.
 */

export default function useShapeDrag({
    stageRef,
    linesRef,
    setLines,
    selectionBBoxRef,
    setSelectionBBox,
    selectedIdsRef,
    setEditHistory,
    socketRef,
    setIsDraggingSelection,
    setIsManipulating
}) {
    const isDraggingSelectionRef = useRef(false);
    const dragStartRef = useRef(null);
    const linesBeforeDragRef = useRef([]);
    const lastTmpDragEmitRef = useRef(0);

    /**
     * Begins the drag operation.
     * Captures the initial state of all lines for history purposes.
     *
     * @param {object} pos - The starting {x, y} position of the drag.
     */
    const handleDragStart = useCallback((pos) => {
        setIsDraggingSelection(true);
        setIsManipulating(true);
        linesBeforeDragRef.current = linesRef.current?.map(line => ({ ...line, points: [...line.points] }));
        isDraggingSelectionRef.current = true;
        dragStartRef.current = { x: pos.x, y: pos.y };
    }, [linesRef, setIsDraggingSelection, setIsManipulating]);

    /**
     * Handles the movement during a drag.
     * Translates all selected lines by the delta from the last drag position.
     * Throttled socket emissions for real-time collaborative previews.
     *
     * @param {object} pointerPos - The current pointer {x, y} position.
     * @param {number} pointerScale - The current stage scale.
     */
    const handleDragMove = useCallback((pointerPos, pointerScale) => {
        const stage = stageRef.current;
        const pos = {
            x: (pointerPos.x - stage.x()) / pointerScale,
            y: (pointerPos.y - stage.y()) / pointerScale,
        };
        const dx = pos.x - dragStartRef.current.x;
        const dy = pos.y - dragStartRef.current.y;
        dragStartRef.current = { x: pos.x, y: pos.y };

        setLines(prev => {
            const updated = prev.map(l => {
                if (!selectedIdsRef.current.includes(l.id)) return l;
                const newPoints = translatePoints(l.points, dx, dy);
                return {
                    ...l, 
                    points: newPoints,
                    x: l.x !== undefined ? l.x + dx : undefined,
                    y: l.y !== undefined ? l.y + dy : undefined,
                    offsetX: l.offsetX !== undefined ? l.offsetX + dx : undefined,
                    offsetY: l.offsetY !== undefined ? l.offsetY + dy : undefined
                };
            });
            linesRef.current = updated;
            return updated;
        });

        setSelectionBBox(prev => prev ? {
            ...prev, 
            x: prev.x + dx, 
            y: prev.y + dy,
            globalCenterX: prev.globalCenterX !== undefined ? prev.globalCenterX + dx : undefined,
            globalCenterY: prev.globalCenterY !== undefined ? prev.globalCenterY + dy : undefined
        } : null);

        const now = Date.now();
        if (now - lastTmpDragEmitRef.current > UPDATE_INTERVAL) {
            lastTmpDragEmitRef.current = now;
            const draggedLines = selectedIdsRef.current.map(id => linesRef.current?.find(l => l.id === id)).filter(Boolean);
            if (draggedLines.length > 0) {
                socketRef.current?.emit('board:draw:tmpdrag', draggedLines);
            }
        }
    }, [stageRef, selectedIdsRef, setLines, setSelectionBBox, socketRef]);

    /**
     * Ends the drag operation.
     * Compares the final state against the initial state and records a 'drag' operation
     * in the edit history if any lines actually moved. Emits final positions to collaborators.
     */
    const handleDragEnd = useCallback(() => {
        setIsDraggingSelection(false);
        setIsManipulating(false);
        isDraggingSelectionRef.current = false;
        dragStartRef.current = null;

        const draggedLinesPairs = selectedIdsRef.current.map(id => {
            const newLineData = linesRef.current?.find(l => l.id === id);
            const oldLineData = linesBeforeDragRef.current?.find(l => l.id === id);
            if (!newLineData || !oldLineData) return null;
            const hasMovedX = newLineData.x !== oldLineData.x;
            const hasMovedY = newLineData.y !== oldLineData.y;
            const havePointCoordsMoved = newLineData.points && oldLineData.points &&
                                         (newLineData.points[0] !== oldLineData.points[0] || newLineData.points[1] !== oldLineData.points[1]);
            if (!hasMovedX && !hasMovedY && !havePointCoordsMoved) return null;
            return { prev_line: oldLineData, new_line: newLineData };
        }).filter(Boolean);

        if (draggedLinesPairs.length > 0) {
            setEditHistory((prev) => {
                let newHistory;
                if (prev.history.length < NUM_MAX_UNDO) newHistory = [...prev.history.slice(0, prev.editIndex + 1), { lines: draggedLinesPairs, op: "drag" }];
                else newHistory = [...prev.history.slice(1, prev.editIndex + 1), { lines: draggedLinesPairs, op: "drag" }];
                return { history: newHistory, editIndex: newHistory.length - 1 };
            });  
            socketRef.current?.emit('board:draw:group_drag', draggedLinesPairs.map(pair => pair.new_line)); 
        }
    }, [linesRef, selectedIdsRef, setEditHistory, socketRef, setIsDraggingSelection, setIsManipulating]);

    return { isDraggingSelectionRef, handleDragStart, handleDragMove, handleDragEnd };
}