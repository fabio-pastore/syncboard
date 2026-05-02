import { useRef, useCallback } from "react";
import { NUM_MAX_UNDO, UPDATE_INTERVAL } from "../utils/boardConstants";
import { rotatePoint } from "../utils/boardUtils";

export default function useShapeRotate({
    stageRef,
    linesRef,
    setLines,
    selectionBBoxRef,
    selectionBBoxRotation,
    setSelectionBBoxRotation,
    selectedIdsRef,
    setEditHistory,
    socketRef,
    setIsManipulating
}) {
    const isRotatingRef = useRef(false);
    const dragStartAngleRef = useRef(0);
    const initialBoxRotRef = useRef(0);
    const linesBeforeRotateRef = useRef([]);
    const lastTmpRotateEmitRef = useRef(0);

    const handleRotationStart = useCallback((pointerPos, pointerScale) => { 
        const currSelectionBBox = selectionBBoxRef.current;
        if (!currSelectionBBox) return;

        const stage = stageRef.current;
        const virtualX = (pointerPos.x - stage.x()) / pointerScale;
        const virtualY = (pointerPos.y - stage.y()) / pointerScale;
        
        const centerX = currSelectionBBox.globalCenterX !== undefined ? currSelectionBBox.globalCenterX : currSelectionBBox.x + currSelectionBBox.width / 2;
        const centerY = currSelectionBBox.globalCenterY !== undefined ? currSelectionBBox.globalCenterY : currSelectionBBox.y + currSelectionBBox.height / 2;
        
        isRotatingRef.current = true;
        setIsManipulating(true);
        dragStartAngleRef.current = Math.atan2(virtualY - centerY, virtualX - centerX) * (180 / Math.PI);
        initialBoxRotRef.current = selectionBBoxRotation || 0;
        linesBeforeRotateRef.current = linesRef.current.map(l => ({...l, points: [...l.points]}));
    }, [stageRef, selectionBBoxRef, selectionBBoxRotation, linesRef, setIsManipulating]);

    const handleRotationDrag = useCallback((pointerPos, pointerScale) => {
        const currBBox = selectionBBoxRef.current;
        if (!currBBox) return;

        const stage = stageRef.current;
        const virtualX = (pointerPos.x - stage.x()) / pointerScale;
        const virtualY = (pointerPos.y - stage.y()) / pointerScale;
        
        const centerX = currBBox.globalCenterX !== undefined ? currBBox.globalCenterX : currBBox.x + currBBox.width / 2;
        const centerY = currBBox.globalCenterY !== undefined ? currBBox.globalCenterY : currBBox.y + currBBox.height / 2;
        
        const currentAngle = Math.atan2(virtualY - centerY, virtualX - centerX) * (180 / Math.PI);
        let deltaAngle = currentAngle - dragStartAngleRef.current;
        
        const newRotation = (initialBoxRotRef.current + deltaAngle) % 360;
        setSelectionBBoxRotation(newRotation);

        setLines(prev => prev.map(l => {
            if (!selectedIdsRef.current.includes(l.id)) return l;
            const originalLine = linesBeforeRotateRef.current.find(old => old.id === l.id);
            if (!originalLine) return l;

            const newPoints = new Array(originalLine.points.length);
            for (let i = 0; i < originalLine.points.length; i += 2) {
                const rotP = rotatePoint(originalLine.points[i], originalLine.points[i+1], centerX, centerY, deltaAngle);
                newPoints[i] = rotP.x;
                newPoints[i+1] = rotP.y;
            }

            let newX = originalLine.x, newY = originalLine.y;
            let newOffsetX = originalLine.offsetX, newOffsetY = originalLine.offsetY;

            if (originalLine.x !== undefined && originalLine.y !== undefined) {
                const rotXY = rotatePoint(originalLine.x, originalLine.y, centerX, centerY, deltaAngle);
                newX = rotXY.x;
                newY = rotXY.y;
            }
            if (originalLine.offsetX !== undefined && originalLine.offsetY !== undefined) {
                const rotOff = rotatePoint(originalLine.offsetX, originalLine.offsetY, centerX, centerY, deltaAngle);
                newOffsetX = rotOff.x;
                newOffsetY = rotOff.y;
            }

            return { ...l, points: newPoints, x: newX, y: newY, offsetX: newOffsetX, offsetY: newOffsetY };
        }));

        const now = Date.now();
        if (now - lastTmpRotateEmitRef.current > UPDATE_INTERVAL) {
            lastTmpRotateEmitRef.current = now;
            const rotatedLines = selectedIdsRef.current.map(id => linesRef.current?.find(l => l.id === id)).filter(Boolean);
            if (rotatedLines.length > 0) {
                socketRef.current?.emit('board:draw:tmprotate', rotatedLines);
            }
        }
    }, [stageRef, selectionBBoxRef, selectedIdsRef, setSelectionBBoxRotation, setLines, socketRef, linesRef]);

    const handleRotationEnd = useCallback(() => {
        isRotatingRef.current = false;
        setIsManipulating(false);
        if (!selectionBBoxRef.current) return;
        const rotatedLinesPairs = selectedIdsRef.current.map(id => {
            const newLineData = linesRef.current?.find(l => l.id === id);
            const oldLineData = linesBeforeRotateRef.current?.find(l => l.id === id);
            if (!newLineData || !oldLineData) return null;
            return { prev_line: oldLineData, new_line: newLineData };
        }).filter(Boolean);

        if (rotatedLinesPairs.length > 0) {
            setEditHistory((prev) => {
                let newHistory;
                if (prev.history.length < NUM_MAX_UNDO) {
                    newHistory = [...prev.history.slice(0, prev.editIndex + 1), { lines: rotatedLinesPairs, op: "rotate" }];
                } else {
                    newHistory = [...prev.history.slice(1, prev.editIndex + 1), { lines: rotatedLinesPairs, op: "rotate" }];
                }
                return { history: newHistory, editIndex: newHistory.length - 1 };
            });
            socketRef.current?.emit('board:draw:group_rotate', rotatedLinesPairs.map(p => p.new_line));
        }
    }, [selectionBBoxRef, selectedIdsRef, linesRef, setEditHistory, socketRef, setIsManipulating]);

    return { isRotatingRef, handleRotationStart, handleRotationDrag, handleRotationEnd };
}