import { useEffect, useRef } from "react";

export default function useTouchHandlers({
    stageRef,
    setScale,
    isDrawingRef,
    activeLineRef,
    activeLineDataRef,
    activeCircleStrokeRef,
    activeCircleFillRef,
    isPenActiveRef,
}) {
    const touchCountRef = useRef(0);
    const lastTouchCenterRef = useRef(null);
    const lastPinchDistRef = useRef(null);

    useEffect(() => {
        const container = stageRef.current?.container();
        if (!container) return;

        const handleTouchStart = (e) => {
            if (isPenActiveRef.current) return;
            const fingers = e.touches.length;
            touchCountRef.current = fingers;
            if (fingers === 1) {
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

        const handleTouchMove = (e) => {
            if (isPenActiveRef.current) return;
            e.preventDefault();
            const fingers = e.touches.length;
            const stage = stageRef.current;

            if (fingers === 1 && !lastPinchDistRef.current) {
                const t = e.touches[0];
                if (lastTouchCenterRef.current) {
                    const dx = t.clientX - lastTouchCenterRef.current.x;
                    const dy = t.clientY - lastTouchCenterRef.current.y;
                    const newPos = { x: stage.x() + dx, y: stage.y() + dy };
                    stage.position(newPos);
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
                stage.scale({ x: newScale, y: newScale });
                setScale(newScale);

                const newPos = {
                    x: center.x - pointTo.x * newScale,
                    y: center.y - pointTo.y * newScale,
                };
                stage.position(newPos);
                lastTouchCenterRef.current = center;
                lastPinchDistRef.current = dist;
            }
        };

        const handleTouchEnd = (e) => {
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
    }, []);

    return { touchCountRef };
}
