// NOTE: this component is used to avoid input lag when quickly dragging color inputs, 
// since the entire parent component would otherwise have to update on each input change,
// drastically reducing performance

import { useState, useEffect, useRef } from "react";

export default function LocalColorPicker({ value, onChange, title, className = "w-6 h-6" }) {
    const [localColor, setLocalColor] = useState(value);
    const lastPushedValue = useRef(value);

    useEffect(() => {
        if (value !== lastPushedValue.current) {
            setLocalColor(value);
            lastPushedValue.current = value;
        }
    }, [value]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (localColor !== value) onChange(localColor);
        }, 10);
        return () => clearTimeout(timeoutId);
    }, [localColor, value, onChange]);

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