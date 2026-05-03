import { useRef, useEffect, useCallback } from "react";
import { calculateLuminosity } from "../utils/boardUtils";

export default function useBackground({ containerRef, socketRef, stagePositionRef, scale, bgPattern, setBgPattern, bgColor, setBgColor }) {
    const bgPatternRef = useRef(bgPattern);
    const patternColorRef = useRef(null);
    const lastBgRef = useRef({ pattern: null, posX: null, posY: null, scale: null });
    useEffect(() => {
        const colorLuminosity = calculateLuminosity(bgColor);
        patternColorRef.current = colorLuminosity > 128 ? 'rgba(0, 0, 0, 0.125)' : 'rgba(255, 255, 255, 0.125)';
    }, [bgColor, calculateLuminosity])

    const updateBackgroundStyle = useCallback((pos, currentScale) => {
        if (!containerRef.current) return;
        const pattern = bgPatternRef.current;

        const last = lastBgRef.current;
        if (last.pattern === pattern && last.posX === pos.x && last.posY === pos.y && last.scale === currentScale) return;
        lastBgRef.current = {pattern, posX: pos.x, posY: pos.y, scale: currentScale};
        
        if (pattern === 'none') {
            containerRef.current.style.backgroundImage = 'none';
            return;
        }

        const size = 40 * currentScale;
        containerRef.current.style.backgroundPosition = `${pos.x}px ${pos.y}px`;
        
        if (pattern === 'grid') {
            containerRef.current.style.backgroundSize = `${size}px ${size}px`;
            containerRef.current.style.backgroundImage = `linear-gradient(to right, ${patternColorRef.current} 1px, transparent 1px), 
                                                          linear-gradient(to bottom, ${patternColorRef.current} 1px, transparent 1px)`;
        } else if (pattern === 'lines') {
            containerRef.current.style.backgroundSize = `100% ${size}px`;
            containerRef.current.style.backgroundImage = `linear-gradient(to bottom, ${patternColorRef.current} 1px, transparent 1px)`;
        }
    }, [containerRef]);

    useEffect(() => {
        bgPatternRef.current = bgPattern;
        updateBackgroundStyle(stagePositionRef.current, scale);
    }, [bgColor, bgPattern, scale, updateBackgroundStyle, stagePositionRef]);

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