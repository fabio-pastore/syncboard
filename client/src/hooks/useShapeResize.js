import { useRef, useCallback } from "react";
import { NUM_MAX_UNDO, HANDLE_BOTTOM_RIGHT, HANDLE_TOP_LEFT, HANDLE_TOP_RIGHT, HANDLE_BOTTOM_LEFT, HANDLE_TOP, HANDLE_RIGHT, HANDLE_BOTTOM, HANDLE_LEFT } from "../utils/boardConstants";
import { rotatePoint } from "../utils/boardUtils";

export default function useShapeResize({
    stageRef,
    linesRef,
    setLines,
    selectionBBoxRef,
    selectionBBoxRotation,
    setSelectionBBox,
    selectedIdsRef,
    setEditHistory,
    socketRef,
    setIsManipulating
}) {
    const isResizingRef = useRef(false);
    const activeResizeHandleRef = useRef(null);
    const initialBBoxRef = useRef(null);
    const linesBeforeResizeRef = useRef([]);
    const initialBoxRotRef = useRef(0);

    const handleResizeStart = useCallback((e, current_handle) => {
        e.cancelBubble = true;
        e.evt.preventDefault();
        isResizingRef.current = true;
        setIsManipulating(true);
        activeResizeHandleRef.current = current_handle;
        linesBeforeResizeRef.current = linesRef.current.map(l => ({...l, points: [...l.points]}));
        initialBBoxRef.current = {...selectionBBoxRef.current};
        initialBoxRotRef.current = selectionBBoxRotation || 0;
    }, [selectionBBoxRotation, linesRef, selectionBBoxRef, setIsManipulating]);

    const handleResizeDrag = useCallback((pointerPos, pointerScale) => {
        const stage = stageRef.current;
        const handle = activeResizeHandleRef.current;
        const initBBox = initialBBoxRef.current;
        const rotationDeg = initialBoxRotRef.current;

        const globalCx = initBBox.globalCenterX !== undefined ? initBBox.globalCenterX : initBBox.x + initBBox.width / 2;
        const globalCy = initBBox.globalCenterY !== undefined ? initBBox.globalCenterY : initBBox.y + initBBox.height / 2;
        
        const rawMouse = {
            x: (pointerPos.x - stage.x()) / pointerScale,
            y: (pointerPos.y - stage.y()) / pointerScale
        };

        const localMouse = rotatePoint(rawMouse.x, rawMouse.y, globalCx, globalCy, -rotationDeg);

        const localLeft = globalCx - initBBox.width / 2;
        const localRight = globalCx + initBBox.width / 2;
        const localTop = globalCy - initBBox.height / 2;
        const localBottom = globalCy + initBBox.height / 2;

        let newLocalLeft = localLeft;
        let newLocalRight = localRight;
        let newLocalTop = localTop;
        let newLocalBottom = localBottom;

        let anchorX, anchorY;
        switch(handle) {
            case HANDLE_TOP_LEFT: anchorX = localRight; anchorY = localBottom; break;
            case HANDLE_TOP: anchorX = null; anchorY = localBottom; break;
            case HANDLE_TOP_RIGHT: anchorX = localLeft; anchorY = localBottom; break;
            case HANDLE_RIGHT: anchorX = localLeft; anchorY = null; break;
            case HANDLE_BOTTOM_RIGHT: anchorX = localLeft; anchorY = localTop; break;
            case HANDLE_BOTTOM: anchorX = null; anchorY = localTop; break;
            case HANDLE_BOTTOM_LEFT: anchorX = localRight; anchorY = localTop; break;
            case HANDLE_LEFT: anchorX = localRight; anchorY = null; break;
        }

        switch (handle) {
            case HANDLE_TOP: newLocalTop = localMouse.y; break;
            case HANDLE_RIGHT: newLocalRight = localMouse.x; break;
            case HANDLE_BOTTOM: newLocalBottom = localMouse.y; break;
            case HANDLE_LEFT: newLocalLeft = localMouse.x; break;
        }

        const isCornerHandle = [HANDLE_BOTTOM_RIGHT, HANDLE_TOP_LEFT, HANDLE_TOP_RIGHT, HANDLE_BOTTOM_LEFT].includes(handle);
        if (isCornerHandle) {
            let diagX = 0, diagY = 0;
            if (handle === HANDLE_BOTTOM_RIGHT) { diagX = initBBox.width; diagY = initBBox.height; }
            else if (handle === HANDLE_TOP_LEFT) { diagX = -initBBox.width; diagY = -initBBox.height; }
            else if (handle === HANDLE_TOP_RIGHT) { diagX = initBBox.width; diagY = -initBBox.height; }
            else if (handle === HANDLE_BOTTOM_LEFT) { diagX = -initBBox.width; diagY = initBBox.height; }

            const mx = localMouse.x - anchorX;
            const my = localMouse.y - anchorY;

            const dot = (mx * diagX) + (my * diagY);
            const diagLengthSq = (diagX * diagX) + (diagY * diagY);
            
            const scaleFactor = diagLengthSq > 0 ? (dot / diagLengthSq) : 0;

            const finalDx = diagX * scaleFactor;
            const finalDy = diagY * scaleFactor;

            if (handle === HANDLE_BOTTOM_RIGHT) {
                newLocalLeft = anchorX; newLocalRight = anchorX + finalDx;
                newLocalTop = anchorY; newLocalBottom = anchorY + finalDy;
            } 
            else if (handle === HANDLE_TOP_LEFT) {
                newLocalRight = anchorX; newLocalLeft = anchorX + finalDx;
                newLocalBottom = anchorY; newLocalTop = anchorY + finalDy;
            } 
            else if (handle === HANDLE_TOP_RIGHT) {
                newLocalLeft = anchorX; newLocalRight = anchorX + finalDx;
                newLocalBottom = anchorY; newLocalTop = anchorY + finalDy;
            } 
            else if (handle === HANDLE_BOTTOM_LEFT) {
                newLocalRight = anchorX; newLocalLeft = anchorX + finalDx;
                newLocalTop = anchorY; newLocalBottom = anchorY + finalDy;
            }
        }

        const curWidth = newLocalRight - newLocalLeft;
        const curHeight = newLocalBottom - newLocalTop;

        const scaleX = initBBox.width > 0 ? curWidth / initBBox.width : 1;
        const scaleY = initBBox.height > 0 ? curHeight / initBBox.height : 1;

        const visualWidth = Math.abs(curWidth);
        const visualHeight = Math.abs(curHeight);

        const newLocalCx = (newLocalLeft + newLocalRight) / 2;
        const newLocalCy = (newLocalTop + newLocalBottom) / 2;
        const newGlobalCenter = rotatePoint(newLocalCx, newLocalCy, globalCx, globalCy, rotationDeg);

        setSelectionBBox(prev => ({
            ...prev,
            x: newGlobalCenter.x - visualWidth / 2,
            y: newGlobalCenter.y - visualHeight / 2,
            width: visualWidth,
            height: visualHeight,
            globalCenterX: newGlobalCenter.x,
            globalCenterY: newGlobalCenter.y
        }));

        setLines(prev => {
            const updated = prev.map(l => {
                if (!selectedIdsRef.current.includes(l.id)) return l;
                const oldL = linesBeforeResizeRef.current.find(old => old.id === l.id);
                if (!oldL) return l;

                const newPoints = new Array(oldL.points.length);
                
                if (oldL.type === 'circle') {
                    
                    const cx = oldL.points[0];
                    const cy = oldL.points[1];
                    const edgeX = oldL.points[2];
                    const edgeY = oldL.points[3];
                    const radius = Math.sqrt((edgeX - cx)**2 + (edgeY - cy)**2);
                    
                    const localC = rotatePoint(cx, cy, globalCx, globalCy, -rotationDeg);
                    const scaledCx = newLocalLeft + (localC.x - localLeft) * scaleX;
                    const scaledCy = newLocalTop + (localC.y - localTop) * scaleY;
                    const globalC = rotatePoint(scaledCx, scaledCy, globalCx, globalCy, rotationDeg);
                    
                    let rScale = 1;
                    if ([HANDLE_LEFT, HANDLE_RIGHT].includes(handle)) rScale = Math.abs(scaleX);
                    else if ([HANDLE_TOP, HANDLE_BOTTOM].includes(handle)) rScale = Math.abs(scaleY);
                    else rScale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
                    
                    const newRadius = radius * rScale;
                    
                    newPoints[0] = globalC.x;
                    newPoints[1] = globalC.y;
                    newPoints[2] = globalC.x + newRadius;
                    newPoints[3] = globalC.y;
                } else {

                    for (let i = 0; i < oldL.points.length; i += 2) {
                        const localP = rotatePoint(oldL.points[i], oldL.points[i+1], globalCx, globalCy, -rotationDeg);
                        const scaledX = newLocalLeft + (localP.x - localLeft) * scaleX;
                        const scaledY = newLocalTop + (localP.y - localTop) * scaleY;
                        const globalP = rotatePoint(scaledX, scaledY, globalCx, globalCy, rotationDeg);
                        
                        newPoints[i] = globalP.x;
                        newPoints[i+1] = globalP.y;
                    }
                }

                let newX = oldL.x, newY = oldL.y;
                let newOffsetX = oldL.offsetX, newOffsetY = oldL.offsetY;

                if (oldL.x !== undefined && oldL.y !== undefined) {
                    const localCenter = rotatePoint(oldL.x, oldL.y, globalCx, globalCy, -rotationDeg);
                    const scaledCx = newLocalLeft + (localCenter.x - localLeft) * scaleX;
                    const scaledCy = newLocalTop + (localCenter.y - localTop) * scaleY;
                    const globalCenterP = rotatePoint(scaledCx, scaledCy, globalCx, globalCy, rotationDeg);
                    newX = globalCenterP.x;
                    newY = globalCenterP.y;
                }

                if (oldL.offsetX !== undefined && oldL.offsetY !== undefined) {
                    const localOff = rotatePoint(oldL.offsetX, oldL.offsetY, globalCx, globalCy, -rotationDeg);
                    const scaledOffX = newLocalLeft + (localOff.x - localLeft) * scaleX;
                    const scaledOffY = newLocalTop + (localOff.y - localTop) * scaleY;
                    const globalOffP = rotatePoint(scaledOffX, scaledOffY, globalCx, globalCy, rotationDeg);
                    newOffsetX = globalOffP.x;
                    newOffsetY = globalOffP.y;
                }

                return { ...l, points: newPoints, x: newX, y: newY, offsetX: newOffsetX, offsetY: newOffsetY };
            });
            linesRef.current = updated;
            return updated;
        });
    }, [stageRef, selectedIdsRef, setSelectionBBox, setLines]);

    const handleResizeEnd = useCallback(() => {
        const resizedLinesPairs = selectedIdsRef.current.map(id => {
            const newLineData = linesRef.current?.find(l => l.id === id);
            const oldLineData = linesBeforeResizeRef.current?.find(l => l.id === id);
            if (!newLineData || !oldLineData) return null;
            if (JSON.stringify(newLineData) === JSON.stringify(oldLineData)) return null;
            return { prev_line: oldLineData, new_line: newLineData };
        }).filter(Boolean);

        if (resizedLinesPairs.length > 0) {
            setEditHistory((prev) => {
                let newHistory;
                const currentHistory = prev.history.slice(0, prev.editIndex + 1);
                if (currentHistory.length < NUM_MAX_UNDO) newHistory = [...currentHistory, { lines: resizedLinesPairs, op: "resize" }];
                else newHistory = [...currentHistory.slice(1), { lines: resizedLinesPairs, op: "resize" }];
                return { history: newHistory, editIndex: newHistory.length - 1 };
            });
            const resizedLines = resizedLinesPairs.map(pair => pair.new_line);
            socketRef.current?.emit('board:draw:group_resize', resizedLines);
        }

        isResizingRef.current = false;
        setIsManipulating(false);
        activeResizeHandleRef.current = null;
    }, [selectedIdsRef, linesRef, setEditHistory, socketRef, setIsManipulating]);

    return { isResizingRef, handleResizeStart, handleResizeDrag, handleResizeEnd };
}