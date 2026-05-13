import { useMemo } from "react";

/**
 * Calculates the visibility and screen position for the selection context menu.
 *
 * The menu is positioned just above the topmost point of the selection bounding box,
 * taking into account the box's rotation angle. The position is clamped to stay
 * within the viewport bounds. The menu is only visible when there is an active
 * selection and the user is not currently manipulating (dragging, resizing, rotating) it.
 *
 * @param {object} params - Hook parameters.
 * @param {Array<string>} params.selectedIds - The array of currently selected line IDs.
 * @param {object|null} params.selectionBBox - The selection bounding box data, including globalCenterX/Y, width, height.
 * @param {number} params.selectionBBoxRotation - The rotation angle of the selection box in degrees.
 * @param {boolean} params.isManipulating - Whether a manipulation action is in progress.
 * @param {React.RefObject} params.stageRef - Ref to the Konva Stage instance.
 * @returns {object} An object containing:
 *   - `selectionMenuVisible` {boolean}: Whether the context menu should be displayed.
 *   - `selectionMenuPosition` {object}: The {x, y} screen coordinates for the menu.
 */

export default function useSelectionMenu({
    selectedIds,
    selectionBBox,
    selectionBBoxRotation,
    isManipulating,
    stageRef
}) {
    const selectionMenuVisible = selectedIds.length > 0 && selectionBBox && !isManipulating;
    
    const selectionMenuPosition = useMemo(() => {
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
    }, [selectionBBox, selectionBBoxRotation, stageRef]);

    return { selectionMenuVisible, selectionMenuPosition };
}
