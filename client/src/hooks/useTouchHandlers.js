import { useEffect, useRef } from "react";

/**
 * Manages touch gestures for panning and pinching on the board stage.
 *
 * Handles multi-touch events on the stage container to distinguish between
 * drawing (in finger-draw mode) and view manipulation. Single-finger touch
 * pans the stage (when not in finger-draw mode), while two-finger pinch
 * zooms the stage in/out. Respects active pen, rotation, and resize operations
 * by not interfering with them.
 *
 * @param {object} params - Hook parameters.
 * @param {React.RefObject} params.stageRef - Ref to the Konva Stage instance.
 * @param {function} params.setScale - Sets the zoom scale state.
 * @param {React.MutableRefObject<number>} params.scaleRef - Ref to the current stage zoom scale.
 * @param {React.MutableRefObject<boolean>} params.isDrawingRef - Ref indicating if drawing is in progress.
 * @param {React.RefObject} params.activeLineRef - Ref to the active drawing Line shape.
 * @param {React.MutableRefObject<object|null>} params.activeLineDataRef - Ref to the active line data model.
 * @param {React.RefObject} params.activeCircleStrokeRef - Ref to the active Circle stroke shape.
 * @param {React.RefObject} params.activeCircleFillRef - Ref to the active Circle fill shape.
 * @param {React.MutableRefObject<boolean>} params.isPenActiveRef - Ref indicating if pen/stylus is active.
 * @param {React.MutableRefObject<boolean>} params.isRotatingRef - Ref indicating if rotation is in progress.
 * @param {React.MutableRefObject<boolean>} params.isResizingRef - Ref indicating if resize is in progress.
 * @param {React.MutableRefObject<boolean>} params.touchDrawModeRef - Ref indicating if finger-draw mode is active.
 * @param {React.MutableRefObject<object>} params.stagePositionRef - Ref to the current {x, y} stage position.
 * @param {function} params.updateBackgroundStyle - Callback to update the CSS background pattern.
 * @param {function} params.displayZoomMeter - Callback to show the zoom level indicator.
 * @param {boolean} params.isLoading - Whether the board is still loading.
 * @returns {object} An object containing:
 *   - touchCountRef {React.MutableRefObject<number>}: Ref tracking the current number of active touch points.
 */

export default function useTouchHandlers({
    stageRef,
    setScale,
    scaleRef,
    isDrawingRef,
    activeLineRef,
    activeLineDataRef,
    activeCircleStrokeRef,
    activeCircleFillRef,
    isPenActiveRef,
    isRotatingRef,
    isResizingRef,
    touchDrawModeRef,
    stagePositionRef,
    updateBackgroundStyle,
    displayZoomMeter,
    isLoading
}) {
    const touchCountRef = useRef(0);
    const lastTouchCenterRef = useRef(null);
    const lastPinchDistRef = useRef(null);

    const updateBgRef = useRef(updateBackgroundStyle);
    useEffect(()=> {updateBgRef.current = updateBackgroundStyle;}, [updateBackgroundStyle]);

    useEffect(() => {
        if (isLoading) return;
        const container = stageRef.current?.container();
        if (!container) return;

        /**
         * Handles the touchstart event on the stage container.
         * Tracks the number of active touches. If a single touch and not in
         * finger-draw mode, records the touch center for panning. If two or
         * more touches, cancels any active drawing and records pinch start data.
         *
         * @param {TouchEvent} e - The native touch event.
         */
        const handleTouchStart = (e) => {
            if (isRotatingRef.current || isResizingRef.current) return;
            if (isPenActiveRef.current) return;
            const fingers = e.touches.length;
            touchCountRef.current = fingers;
            if (fingers === 1) {
                if (touchDrawModeRef.current) {
                    lastTouchCenterRef.current = null;
                    lastPinchDistRef.current = null;
                    return;
                }
                const t = e.touches[0];
                lastTouchCenterRef.current = { x: t.clientX, y: t.clientY };
                lastPinchDistRef.current = null;
            } else if (fingers >= 2) {
                isDrawingRef.current = false;
                activeLineDataRef.current = null;
                if (activeLineRef.current) activeLineRef.current.hide();
                if (activeCircleStrokeRef.current) activeCircleStrokeRef.current.hide();
                if (activeCircleFillRef.current) activeCircleFillRef.current.hide();

                const t1 = e.touches[0], t2 = e.touches[1];
                lastTouchCenterRef.current = {
                    x: (t1.clientX + t2.clientX) / 2,
                    y: (t1.clientY + t2.clientY) / 2,
                };
                lastPinchDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            }
        };

        /**
         * Handles the touchmove event on the stage container.
         * For single touch (not in draw mode), pans the stage. For multi-touch,
         * calculates pinch-to-zoom and pans the stage accordingly. Updates the
         * background pattern position and zoom indicator.
         *
         * @param {TouchEvent} e - The native touch event.
         */
        const handleTouchMove = (e) => {
            if (isRotatingRef.current || isResizingRef.current) return;
            if (isPenActiveRef.current) return;
            e.preventDefault();
            const fingers = e.touches.length;
            const stage = stageRef.current;

            if (fingers === 1 && !lastPinchDistRef.current) {
                if (touchDrawModeRef.current) return;
                const t = e.touches[0];
                if (lastTouchCenterRef.current) {
                    const dx = t.clientX - lastTouchCenterRef.current.x;
                    const dy = t.clientY - lastTouchCenterRef.current.y;
                    const newPos = { x: stage.x() + dx, y: stage.y() + dy };
                    stage.position(newPos);
                    stagePositionRef.current = newPos;
                    updateBgRef.current(newPos, scaleRef.current);
                }
                lastTouchCenterRef.current = { x: t.clientX, y: t.clientY };
            } else if (fingers >= 2) {
                const t1 = e.touches[0], t2 = e.touches[1];
                const center = {
                    x: (t1.clientX + t2.clientX) / 2,
                    y: (t1.clientY + t2.clientY) / 2,
                };
                const oldScale = stage.scaleX();
                const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

                const pointTo = {
                    x: (center.x - stage.x()) / oldScale,
                    y: (center.y - stage.y()) / oldScale,
                };

                const newScale = lastPinchDistRef.current
                    ? Math.max(0.1, Math.min(10, oldScale * (dist / lastPinchDistRef.current)))
                    : oldScale;
                
                if (newScale !== oldScale) {
                    stage.scale({ x: newScale, y: newScale });
                    setScale(newScale);
                    scaleRef.current = newScale;
                    displayZoomMeter();
                }

                const newPos = {
                    x: center.x - pointTo.x * newScale,
                    y: center.y - pointTo.y * newScale,
                };
                stage.position(newPos);
                stagePositionRef.current = newPos;
                updateBgRef.current(newPos, newScale);
                lastTouchCenterRef.current = center;
                lastPinchDistRef.current = dist;
            }
        };

        /**
         * Handles the touchend/touchcancel events on the stage container.
         * Resets pinch state when all fingers are lifted, or transitions to
         * single-finger panning if one finger remains.
         *
         * @param {TouchEvent} e - The native touch event.
         */
        const handleTouchEnd = (e) => {
            if (isRotatingRef.current || isResizingRef.current) return;
            if (isPenActiveRef.current) return;
            const fingers = e.touches.length;
            touchCountRef.current = fingers;
            if (fingers === 0) {
                lastPinchDistRef.current = null;
                lastTouchCenterRef.current = null;
            } else if (fingers === 1) {
                lastPinchDistRef.current = null;
                const t = e.touches[0];
                lastTouchCenterRef.current = { x: t.clientX, y: t.clientY };
            }
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: false });
        container.addEventListener('touchcancel', handleTouchEnd);
        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [isLoading]);

    return { touchCountRef };
}
