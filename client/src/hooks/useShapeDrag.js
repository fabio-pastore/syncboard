import { useRef, useCallback } from "react";
import { NUM_MAX_UNDO } from "../utils/boardConstants";
import { translatePoints } from "../utils/boardUtils";

export default function useShapeDrag({
    stageRef,
    linesRef,
    setLines,
    selectionBBoxRef,
    setSelectionBBox,
    selectedIdsRef,
    setEditHistory,
    socketRef,
    setIsDraggingSelection
}) {
    const isDraggingSelectionRef = useRef(false);
    const dragStartRef = useRef(null);
    const linesBeforeDragRef = useRef([]);

    const handleDragStart = useCallback((pos) => {
        setIsDraggingSelection(true);
        linesBeforeDragRef.current = linesRef.current?.map(line => ({ ...line, points: [...line.points] }));
        isDraggingSelectionRef.current = true;
        dragStartRef.current = { x: pos.x, y: pos.y };
    }, [linesRef, setIsDraggingSelection]);

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
    }, [stageRef, selectedIdsRef, setLines, setSelectionBBox]);

    const handleDragEnd = useCallback(() => {
        setIsDraggingSelection(false);
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
    }, [linesRef, selectedIdsRef, setEditHistory, socketRef, setIsDraggingSelection]);

    return { isDraggingSelectionRef, handleDragStart, handleDragMove, handleDragEnd };
}