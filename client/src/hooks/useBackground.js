import { useRef, useEffect, useCallback } from "react";

export default function useBackground({ containerRef, socketRef, stagePositionRef, scale, bgPattern, setBgPattern, bgColor, setBgColor }) {
    const bgPatternRef = useRef(bgPattern);

    const updateBackgroundStyle = useCallback((pos, currentScale) => {
        if (!containerRef.current) return;
        const pattern = bgPatternRef.current;
        
        if (pattern === 'none') {
            containerRef.current.style.backgroundImage = 'none';
            return;
        }

        const size = 40 * currentScale;
        containerRef.current.style.backgroundPosition = `${pos.x}px ${pos.y}px`;
        
        if (pattern === 'grid') {
            containerRef.current.style.backgroundSize = `${size}px ${size}px`;
            containerRef.current.style.backgroundImage = `linear-gradient(to right, #d1d5db 1px, transparent 1px), linear-gradient(to bottom, #d1d5db 1px, transparent 1px)`;
        } else if (pattern === 'lines') {
            containerRef.current.style.backgroundSize = `100% ${size}px`;
            containerRef.current.style.backgroundImage = `linear-gradient(to bottom, #d1d5db 1px, transparent 1px)`;
        }
    }, [containerRef]);

    useEffect(() => {
        bgPatternRef.current = bgPattern;
        updateBackgroundStyle(stagePositionRef.current, scale);
    }, [bgPattern, scale, updateBackgroundStyle, stagePositionRef]);

    const handleBgPatternEdit = useCallback((newPattern) => {
        setBgPattern(newPattern);
        socketRef.current?.emit('board:bg:modify', { newType: newPattern, newColor: null });
    }, [setBgPattern, socketRef]);

    const handleBgColorEdit = useCallback((newColor) => {
        setBgColor(newColor);
        socketRef.current?.emit('board:bg:modify', { newType: null, newColor: newColor });
    }, [setBgColor, socketRef]);

    return { updateBackgroundStyle, handleBgPatternEdit, handleBgColorEdit };
}