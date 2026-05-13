// NOTE: this component is used to avoid input lag when quickly dragging color inputs, 
// since the entire parent component would otherwise have to update on each input change,
// drastically reducing performance

import { useState, useEffect, useRef } from "react";
import { INPUT_UPDATE_INTERVAL } from "../../utils/boardConstants";

/**
 * A performance-optimized color picker component.
 *
 * Uses local state to immediately reflect UI changes, debouncing updates to the
 * parent component. This prevents performance degradation caused by rapid
 * re-renders of a heavy parent component when the user drags the color slider.
 * It also ensures the final color is committed if the component unmounts.
 *
 * @param {object} props - Component props.
 * @param {string} props.value - The current color value from the parent component.
 * @param {function} props.onChange - Callback fired with the new color after the debounce interval.
 * @param {string} props.title - Title attribute for the color input.
 * @param {string} [props.className="w-6 h-6"] - CSS class for the container label.
 * @returns {JSX.Element} The color picker label and input.
 */

export default function LocalColorPicker({ value, onChange, title, className = "w-6 h-6" }) {
    const [localColor, setLocalColor] = useState(value);
    const lastPushedValue = useRef(value);

    const unmountHelperRef = useRef({ localColor, value, onChange });
    useEffect(() => {
        unmountHelperRef.current = { localColor, value, onChange };
    }, [localColor, value, onChange]);

    useEffect(() => {
        if (value !== lastPushedValue.current) {
            setLocalColor(value);
            lastPushedValue.current = value;
        }
    }, [value]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (localColor !== value) onChange(localColor);
        }, INPUT_UPDATE_INTERVAL);
        return () => clearTimeout(timeoutId);
    }, [localColor, value, onChange]);

    // apply color if color picker is suddenly unmounted, otherwise bg color won't change on tablets
    useEffect(() => {
        return () => {
            const { localColor: finalColor, value: finalValue, onChange: finalOnChange } = unmountHelperRef.current;
            if (finalColor !== finalValue) {
                finalOnChange(finalColor);
            }
        };
    }, []);

    return (
        <label className={`relative cursor-pointer flex items-center transition hover:scale-110 ${className}`} title={title}>
            <div className="w-full h-full rounded-full border-2"
                style={{
                    background: localColor,
                    borderColor: `color-mix(in srgb, ${localColor}, black 30%)`
                }}
            />
            <input 
                type="color" 
                value={localColor} 
                onChange={(e) => setLocalColor(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" 
            />
        </label>
    );
}