import { useRef, useEffect, useCallback } from "react";
import { NUM_MAX_UNDO } from "../utils/boardConstants";
import { translatePoints } from "../utils/boardUtils";

/**
 * Manages the undo/redo history, clipboard operations, and edit actions for the board.
 *
 * This hook tracks a history stack of edit operations (draw, erase, drag, resize, rotate,
 * modify selection, paste) and provides methods to undo and redo them. It also handles
 * copy, paste, delete, and selection modification actions, emitting corresponding socket
 * events to synchronize changes with other collaborators. Keyboard shortcuts for
 * Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y (redo), Ctrl/Cmd+C (copy),
 * Ctrl/Cmd+V (paste), Delete/Backspace (delete selection) are registered globally.
 *
 * @param {object} params - Hook parameters.
 * @param {function} params.setEditHistory - Sets the edit history state ({ history, editIndex }).
 * @param {function} params.setLines - Sets the complete lines array on the board.
 * @param {React.MutableRefObject} params.socketRef - Ref to the active socket connection.
 * @param {React.MutableRefObject<Array>} params.linesRef - Ref to the current lines array.
 * @param {boolean} params.canDraw - Whether the user has permission to edit the board.
 * @param {React.MutableRefObject<Array<string>>} params.selectedIdsRef - Ref to the array of selected line IDs.
 * @param {Array<string>} params.selectedIds - The currently selected line IDs (state).
 * @param {function} params.clearSelection - Clears the current selection.
 * @param {React.RefObject} params.stageRef - Ref to the Konva Stage instance.
 * @param {function} params.setIsOpenContextMenu - Sets the context menu open state.
 * @param {function} params.sortLinesByTime - Function to sort lines array by creation time.
 * @returns {object} An object containing:
 *   - handleUndo: Function to perform an undo action.
 *   - handleRedo: Function to perform a redo action.
 *   - handleCopy: Function to copy the selected lines to an internal clipboard.
 *   - handlePaste: Function to paste copied lines at a specified position.
 *   - handleModifySelection: Function to modify properties (color, fill, width, opacity) of selected lines.
 *   - handleDeleteSelection: Function to delete all currently selected lines.
 *   - copiedLinesRef: Ref to the internal clipboard of copied lines.
 */

export default function useEditHistory({
    setEditHistory, setLines, socketRef, linesRef, canDraw,
    selectedIdsRef, selectedIds, clearSelection, stageRef,
    setIsOpenContextMenu, sortLinesByTime
}) {
    const copiedLinesRef = useRef([]);
    const numTimesPastedRef = useRef(null);
    const lastPastePosRef = useRef({ x: 0, y: 0 });

    /**
     * Modifies the stroke color, fill color, stroke width, and/or opacity of all selected lines.
     * Records the change in the edit history and emits the updated lines to other users.
     *
     * @param {string|null} newBrushColor - The new stroke color hex value, or null to keep unchanged.
     * @param {string|null} newFillColor - The new fill color hex value, or null to keep unchanged.
     * @param {number|null} newStrokeWidth - The new stroke width, or null to keep unchanged.
     * @param {number|null} newOpacity - The new opacity value, or null to keep unchanged.
     */
    const handleModifySelection = useCallback((newBrushColor, newFillColor, newStrokeWidth, newOpacity) => {
        if (selectedIdsRef.current.length === 0) return;

        const linePairs = selectedIdsRef.current?.map(id => {
            const oldLine = linesRef.current?.find(line => line.id === id);
            const modifiedLine = {
                ...oldLine,
                color: newBrushColor !== null ? newBrushColor : oldLine.color,
                strokeWidth: newStrokeWidth !== null ? newStrokeWidth : oldLine.strokeWidth,
                opacity: newOpacity !== null ? newOpacity : oldLine.opacity,
                fill: newFillColor !== null ? newFillColor : (oldLine.fill ? oldLine.fill : undefined)
            };
            if (!oldLine || !modifiedLine) return null;
            return { prev_line: oldLine, new_line: modifiedLine };
        }).filter(Boolean);

        setLines((prev) => {
            const newLines = linePairs.map(entry => entry.new_line);
            const updatedLines = prev.map(l => {
                const foundLine = newLines.find(line => line.id === l.id);
                return foundLine ? foundLine : l;
            });
            return sortLinesByTime(updatedLines);
        });

        if (linePairs.length > 0) {
            setEditHistory((prev) => {
                let newHistory;
                if (prev.history.length < NUM_MAX_UNDO) {
                    newHistory = [...prev.history.slice(0, prev.editIndex + 1), { lines: linePairs, op: "modify_selection" }];
                } else {
                    newHistory = [...prev.history.slice(1, prev.editIndex + 1), { lines: linePairs, op: "modify_selection" }];
                }
                return { history: newHistory, editIndex: newHistory.length - 1 };
            });
        }

        socketRef.current?.emit('board:draw:modify_selection', linePairs.map(entry => entry.new_line));
    }, [selectedIdsRef, linesRef, setEditHistory, socketRef, setLines, sortLinesByTime]);

    /**
     * Deletes all currently selected lines.
     * Records a 'group_erase' entry in edit history and emits the deletion to other users.
     */
    const handleDeleteSelection = useCallback(() => {
        if (selectedIdsRef.current.length === 0) return;

        const linesToErase = selectedIdsRef.current.map(id => linesRef.current?.find(l => l.id === id)).filter(Boolean);
        if (linesToErase.length > 0) {
            setEditHistory((prev) => {
                const currentHistory = prev.history.slice(0, prev.editIndex + 1);
                const currentErasedSignature = linesToErase.map(l => l.id).sort().join(',');
                const isDuplicate = currentHistory.some(item => {
                    if (item.op !== 'group_erase') return false;
                    return item.lines.map(l => l.id).sort().join(',') === currentErasedSignature;
                });
                if (isDuplicate) return prev;

                let newHistory;
                if (prev.history.length < NUM_MAX_UNDO) newHistory = [...prev.history.slice(0, prev.editIndex + 1), { lines: linesToErase, op: "group_erase" }];
                else newHistory = [...prev.history.slice(1, prev.editIndex + 1), { lines: linesToErase, op: "group_erase" }];

                return { history: newHistory, editIndex: newHistory.length - 1 };
            });
            const erasedIds = linesToErase.map(l => l.id);
            socketRef.current?.emit('board:draw:group_erase', erasedIds);
        }
        setLines(prev => prev.filter(l => !selectedIdsRef.current.includes(l.id)));
        clearSelection();
    }, [clearSelection, socketRef, setLines, setEditHistory, selectedIdsRef, linesRef]);

    // registers a global keydown listener for Delete/Backspace to delete selected lines
    useEffect(() => {
        const onKeyDown = (e) => {
            if (!canDraw) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; // avoids deleting selectons while chat is open

            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
                handleDeleteSelection();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedIds, handleDeleteSelection]);

    /**
     * Performs an undo operation.
     * Reverts the most recent edit from the history stack based on its operation type
     * (draw, erase, drag, rotate, resize, modify_selection, group_erase, paste).
     * Emits the corresponding undo socket event to synchronize with other users.
     */
    const handleUndo = useCallback(() => {
        setIsOpenContextMenu(false);
        setEditHistory((prevHistory) => {
            if (prevHistory.history.length === 0 || prevHistory.editIndex === -1) return prevHistory;
            const curr_edit_indx = prevHistory.editIndex;
            const last_edit = prevHistory.history.at(curr_edit_indx);
            if (last_edit.op === 'draw') {
                setLines((prevLines) => prevLines.filter(l => l.id !== last_edit.line.id));
                socketRef.current?.emit('board:draw:undo', { lineId: last_edit.line.id, op: 'draw' });
            }
            else if (last_edit.op === 'rotate' || last_edit.op === 'drag' || last_edit.op === 'resize' || last_edit.op === 'modify_selection') {
                setLines((prev) => {
                    return prev.map(l => {
                        const historyEntry = last_edit.lines.find(entry => entry.prev_line.id === l.id);
                        return historyEntry ? historyEntry.prev_line : l;
                    });
                });
                clearSelection();
                socketRef.current?.emit('board:draw:undo', { op: last_edit.op, line: last_edit.lines });
            }
            else if (last_edit.op === 'group_erase') {
                setLines((prevLines) => {
                    if (prevLines.some(l => last_edit.lines.some(line => l.id === line.id))) return prevLines;
                    const newLines = [...prevLines, ...last_edit.lines];
                    return sortLinesByTime(newLines)
                });
                socketRef.current?.emit('board:draw:undo', { op: 'group_erase', line: last_edit.lines });
            }
            else if (last_edit.op === 'paste') {
                setLines((prevLines) => {
                    return (prevLines.filter(l => !last_edit.lines.find(line => line.id === l.id)));
                });
                socketRef.current?.emit('board:draw:undo', { op: 'paste', line: last_edit.lines });
                clearSelection();
            }
            else {
                setLines((prevLines) => {
                    if (prevLines.some(l => l.id === last_edit.line.id)) return prevLines;
                    const newLines = [...prevLines, last_edit.line];
                    return sortLinesByTime(newLines)
                });
                clearSelection();
                socketRef.current?.emit('board:draw:undo', { lineId: last_edit.line.id, op: 'erase', line: last_edit.line });
            }
            return { history: prevHistory.history, editIndex: prevHistory.editIndex - 1 };
        });
    }, [clearSelection, socketRef, setLines, setIsOpenContextMenu, setEditHistory, sortLinesByTime]);

     /**
     * Performs a redo operation.
     * Re-applies the next undone edit from the history stack based on its operation type.
     * Emits the corresponding redo socket event to synchronize with other users.
     */
    const handleRedo = useCallback(() => {
        setIsOpenContextMenu(false);
        setEditHistory((prevHistory) => {
            if (prevHistory.history.length === 0 || prevHistory.editIndex === prevHistory.history.length - 1) return prevHistory;

            const last_edit = prevHistory.history.at(prevHistory.editIndex + 1);
            if (last_edit.op === 'draw') {
                setLines((prevLines) => {
                    if (prevLines.some(l => l.id === last_edit.line.id)) return prevLines;
                    const newLines = [...prevLines, last_edit.line];
                    return sortLinesByTime(newLines)
                });
                socketRef.current?.emit('board:draw:redo', { lineId: last_edit.line.id, op: 'draw', line: last_edit.line });
            }
            else if (last_edit.op === 'rotate' || last_edit.op === 'drag' || last_edit.op === 'resize' || last_edit.op === 'modify_selection') {
                setLines((prev) => {
                    return prev.map(l => {
                        const historyEntry = last_edit.lines.find(entry => entry.new_line.id === l.id);
                        return historyEntry ? historyEntry.new_line : l;
                    });
                });
                clearSelection();
                socketRef.current?.emit('board:draw:redo', { op: last_edit.op, line: last_edit.lines });
            }
            else if (last_edit.op === 'group_erase') {
                setLines((prevLines) => prevLines.filter(l => !last_edit.lines.some(line => l.id === line.id)));
                socketRef.current?.emit('board:draw:redo', { op: 'group_erase', line: last_edit.lines });
            }
            else if (last_edit.op === 'paste') {
                setLines((prev) => {
                    if (prev.some(l => last_edit.lines.some(line => l.id === line.id))) return prev;
                    const updatedLines = [...prev, ...last_edit.lines];
                    return sortLinesByTime(updatedLines);
                })
                socketRef.current?.emit('board:draw:redo', { op: 'paste', line: last_edit.lines });
            }
            else {
                setLines((prevLines) => prevLines.filter(l => l.id !== last_edit.line.id));
                socketRef.current?.emit('board:draw:redo', { lineId: last_edit.line.id, op: 'erase' });
            }
            return { history: prevHistory.history, editIndex: prevHistory.editIndex + 1 };
        });
    }, [clearSelection, socketRef, setLines, setIsOpenContextMenu, setEditHistory, sortLinesByTime]);

    /**
     * Copies the currently selected lines to an internal clipboard.
     * The selection is cleared if the copy was triggered from the context menu.
     *
     * @param {boolean} [clickedFromMenu=false] - Whether the copy was initiated from a menu click.
     */
    const handleCopy = useCallback((clickedFromMenu = false) => {
        if (!selectedIdsRef.current?.length > 0) return;
        if (clickedFromMenu) clearSelection();
        numTimesPastedRef.current = 0;
        copiedLinesRef.current = linesRef.current?.filter(l => selectedIdsRef.current.includes(l.id));
    }, [clearSelection, selectedIdsRef, linesRef]);

    /**
     * Pastes the copied lines at the current pointer position or a specified override position.
     * An offset is applied to successive pastes in the same area to prevent overlapping.
     *
     * @param {object|null} [overridePos=null] - An optional {x, y} position override.
     */
    const handlePaste = useCallback((overridePos = null) => {
        if (!copiedLinesRef.current?.length) return;

        let pos;
        if (overridePos) pos = overridePos;
        else {
            const stage = stageRef.current;
            const pointerPos = stage.getPointerPosition();
            const pointerScale = stage.scaleX() || 1;
            pos = {
                x: (pointerPos.x - stage.x()) / pointerScale,
                y: (pointerPos.y - stage.y()) / pointerScale
            };
        }

        const originalCopies = JSON.parse(JSON.stringify(copiedLinesRef.current));

        const refX = originalCopies[0].points[0];
        const refY = originalCopies[0].points[1];

        const dist = Math.sqrt(
            Math.pow(lastPastePosRef.current.x - pos.x, 2) +
            Math.pow(lastPastePosRef.current.y - pos.y, 2)
        );

        if (dist < 30) {
            numTimesPastedRef.current += 1;
        } else {
            numTimesPastedRef.current = 0;
        }

        const offsetX = 20 * (numTimesPastedRef.current + 1);
        const commonDx = pos.x - refX + offsetX;
        const commonDy = pos.y - refY;

        const linesToAdd = originalCopies.map(l => ({
            ...l,
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            points: translatePoints(l.points, commonDx, commonDy)
        }));

        lastPastePosRef.current = { x: pos.x, y: pos.y };

        setLines(prev => [...prev, ...linesToAdd]);

        setEditHistory(prev => {
            const newHistory = [...prev.history.slice(0, prev.editIndex + 1), { lines: linesToAdd, op: "paste" }];
            if (newHistory.length > NUM_MAX_UNDO) newHistory.shift();
            return { history: newHistory, editIndex: newHistory.length - 1 };
        });

        socketRef.current?.emit('board:draw:paste', linesToAdd);
        clearSelection();
    }, [clearSelection, setLines, stageRef, setEditHistory, socketRef]);

    // registers global keyboard shortcuts for undo, redo, copy, and paste
    useEffect(() => {
        const handleShortcuts = (e) => {
            if (!canDraw) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
            if (!cmdOrCtrl) return;

            if (e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) handleRedo();
                else handleUndo();
            }
            else if (e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
            }
            else if (e.key.toLowerCase() === 'c') {
                e.preventDefault();
                handleCopy();
            }
            else if (e.key.toLowerCase() === 'v') {
                e.preventDefault();
                handlePaste();
            }
        };

        window.addEventListener('keydown', handleShortcuts);
        return () => window.removeEventListener('keydown', handleShortcuts);
    }, [handleUndo, handleRedo, handleCopy, handlePaste]);

    return {
        handleUndo, handleRedo, handleCopy, handlePaste,
        handleModifySelection, handleDeleteSelection,
        copiedLinesRef
    };
}