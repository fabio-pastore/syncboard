import { useRef, useEffect, useCallback } from "react";
import { calculateLuminosity } from "../utils/boardUtils";

/**
 * Manages the background pattern and color of the board container.
 *
 * Handles CSS background-image updates based on the selected pattern (grid/lines/none)
 * and color. Adjusts the pattern color dynamically for contrast based on the background
 * color's luminosity. Emits socket events for real-time background changes.
 *
 * @param {object} params - Hook parameters.
 * @param {React.RefObject} params.containerRef - Ref to the board container DOM element.
 * @param {React.MutableRefObject} params.socketRef - Ref to the socket connection.
 * @param {React.MutableRefObject} params.stagePositionRef - Ref to the current {x, y} stage position.
 * @param {number} params.scale - The current zoom scale of the stage.
 * @param {string} params.bgPattern - The active background pattern ID.
 * @param {function} params.setBgPattern - Sets the background pattern state.
 * @param {string} params.bgColor - The current background color.
 * @param {function} params.setBgColor - Sets the background color state.
 * @returns {object} An object containing `updateBackgroundStyle`, `handleBgPatternEdit`, and `handleBgColorEdit`.
 */

export default function useBackground({ containerRef, socketRef, stagePositionRef, scale, bgPattern, setBgPattern, bgColor, setBgColor }) {
    const bgPatternRef = useRef(bgPattern);
    const patternColorRef = useRef(null);
    const lastBgRef = useRef({ pattern: null, posX: null, posY: null, scale: null, color: null });
    useEffect(() => {
        const colorLuminosity = calculateLuminosity(bgColor);
        patternColorRef.current = colorLuminosity > 128 ? 'rgba(0, 0, 0, 0.125)' : 'rgba(255, 255, 255, 0.125)';
    }, [bgColor])

    /**
     * Updates the container's CSS background based on the current pattern, position, and scale.
     * Only applies changes if the relevant properties have changed to avoid unnecessary repaints.
     *
     * @param {object} pos - The {x, y} position of the stage.
     * @param {number} currentScale - The current zoom scale.
     */
    const updateBackgroundStyle = useCallback((pos, currentScale) => {
    if (!containerRef.current) return;
    
    const pattern = bgPatternRef.current;
    const patternColor = patternColorRef.current;
    const last = lastBgRef.current;
    
    if (
        last.pattern === pattern && 
        last.posX === pos.x && 
        last.posY === pos.y && 
        last.scale === currentScale &&
        last.color === patternColor 
    ) return;
    
    lastBgRef.current = { pattern, posX: pos.x, posY: pos.y, scale: currentScale, color: patternColor };
    
    if (pattern === 'none') {
        containerRef.current.style.backgroundImage = 'none';
        return;
    }

    const size = 40 * currentScale;
    containerRef.current.style.backgroundPosition = `${pos.x}px ${pos.y}px`;
    
    if (pattern === 'grid') {
        containerRef.current.style.backgroundSize = `${size}px ${size}px`;
        containerRef.current.style.backgroundImage = `linear-gradient(to right, ${patternColor} 1px, transparent 1px), 
                                                      linear-gradient(to bottom, ${patternColor} 1px, transparent 1px)`;
    } else if (pattern === 'lines') {
        containerRef.current.style.backgroundSize = `100% ${size}px`;
        containerRef.current.style.backgroundImage = `linear-gradient(to bottom, ${patternColor} 1px, transparent 1px)`;
    }
    else {}
}, [containerRef]);

    useEffect(() => {
        bgPatternRef.current = bgPattern;
        updateBackgroundStyle(stagePositionRef.current, scale);
    }, [bgColor, bgPattern, scale, updateBackgroundStyle, stagePositionRef]);

    /**
     * Sets a new background pattern and emits the change via socket.
     *
     * @param {string} newPattern - The new background pattern ID ('none', 'grid', 'lines').
     */
    const handleBgPatternEdit = useCallback((newPattern) => {
        setBgPattern(newPattern);
        socketRef.current?.emit('board:bg:modify', { newType: newPattern, newColor: null });
    }, [setBgPattern, socketRef]);

    /**
     * Sets a new background color and emits the change via socket.
     *
     * @param {string} newColor - The new background color hex value.
     */
    const handleBgColorEdit = useCallback((newColor) => {
        setBgColor(newColor);
        socketRef.current?.emit('board:bg:modify', { newType: null, newColor: newColor });
    }, [setBgColor, socketRef]);

    return { updateBackgroundStyle, handleBgPatternEdit, handleBgColorEdit };
}