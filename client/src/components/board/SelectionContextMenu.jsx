import { useState, useEffect, useRef } from 'react';
import { Copy, Trash2, ListPlus, Eye } from 'lucide-react';
import { RgbaToHex } from '../../utils/boardUtils';
import { INPUT_UPDATE_INTERVAL } from '../../utils/boardConstants';
import LocalColorPicker from './LocalColorPicker';

export default function SelectionContextMenu({ visible, position, selectedLines, onCopy, onDelete, onModify }) {
    const [modifiedBrushColor, setModifiedBrushColor] = useState(null);
    const [modifiedFillColor, setModifiedFillColor] = useState(null);
    const [modifiedStrokeWidth, setModifiedStrokeWidth] = useState(null);
    const [modifiedOpacity, setModifiedOpacity] = useState(null);
    
    const [activeMenu, setActiveMenu] = useState(null); 
    const modifyTimeoutRef = useRef(null); 

    const selectedCount = selectedLines?.length || 0;
    const selectedSignature = selectedLines?.map(l => l.id).sort().join(',') || '';

    // hide sub-menus if main menu is closed
    useEffect(() => { 
        if (!visible) setActiveMenu(null);
    }, [visible]);

    const allEqual = (arr) => new Set(arr).size === 1;

    useEffect(() => {
        if (selectedCount === 0) return;

        const colors = selectedLines.map(l => RgbaToHex(l.color));
        const fills = selectedLines.map(l => RgbaToHex(l.fill));
        const widths = selectedLines.map(l => l.strokeWidth);
        const opacities = selectedLines.map(l => l.opacity ?? 1);

        setModifiedBrushColor(allEqual(colors) ? colors[0] : null);
        setModifiedFillColor(allEqual(fills) ? fills[0] : null);
        setModifiedStrokeWidth(allEqual(widths) ? widths[0] : null);
        setModifiedOpacity(allEqual(opacities) ? opacities[0] : null);

    }, [selectedSignature]); 

    const handleUserChange = (field, value) => {
        if (field === 'brush') setModifiedBrushColor(value);
        if (field === 'fill') setModifiedFillColor(value);
        if (field === 'width') setModifiedStrokeWidth(value);
        if (field === 'opacity') setModifiedOpacity(value);

        const newBrush = field === 'brush' ? value : modifiedBrushColor;
        const newFill = field === 'fill' ? value : modifiedFillColor;
        const newWidth = field === 'width' ? value : modifiedStrokeWidth;
        const newOpacity = field === 'opacity' ? value : modifiedOpacity;

        if (modifyTimeoutRef.current) clearTimeout(modifyTimeoutRef.current);
        
        // timeout is necessary unless you wish to update the board component ~60 times per second (don't remove this)
        modifyTimeoutRef.current = setTimeout(() => {
            onModify(newBrush, newFill, newWidth, newOpacity);
        }, INPUT_UPDATE_INTERVAL);
    };

    return (
        <div 
            className='fixed z-10 items-center gap-1 px-2 py-1.5
                bg-white border border-gray-200 rounded-2xl backdrop-blur-md shadow-2xl
                transition-opacity duration-150 origin-bottom flex'
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -100%)',
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? 'auto' : 'none'
            }}
        >
            <button onClick={onCopy} title="Copy" className='p-2 rounded-xl transition cursor-pointer hover:bg-gray-100 text-gray-600 hover:text-gray-900'>
                <Copy size={16} />
            </button>

            <button onClick={onDelete} title="Delete" className='p-2 rounded-xl transition cursor-pointer hover:bg-red-50 text-red-500 hover:text-red-700'>
                <Trash2 size={16} />
            </button>

            <div className='w-px h-5 bg-gray-200'></div>

            <LocalColorPicker 
                title="Brush color"
                className="w-4 h-4 m-2"
                value={modifiedBrushColor || "#000000"} 
                onChange={(val) => handleUserChange('brush', val)}
            />

            <LocalColorPicker 
                title="Fill color"
                className="w-4 h-4 m-2"
                value={modifiedFillColor || "#ffffff"} 
                onChange={(val) => handleUserChange('fill', val)}
            />

            <div className="relative flex items-center">
                <button
                    onClick={() => setActiveMenu(prev => prev === 'width' ? null : 'width')}
                    title="Stroke width"
                    className={`p-2 rounded-xl transition cursor-pointer hover:text-gray-900 ${activeMenu === 'width' ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                    <ListPlus size={16} />
                </button>
                
                {activeMenu === 'width' && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-2 bg-white border border-gray-200 rounded-xl shadow-xl flex flex-col w-32">
                        <span className="text-[9px] text-gray-400 font-normal pb-0.5 text-left w-full">Stroke width</span>
                        <div className="flex items-center gap-2 w-full">
                            <input 
                                type="range" 
                                min="1" 
                                max="50" 
                                step="1"
                                value={modifiedStrokeWidth ?? 3} 
                                onChange={(e) => handleUserChange('width', Number(e.target.value))} 
                                className="flex-1 accent-gray-600 cursor-pointer min-w-0" 
                            />
                            <span className="text-xs text-gray-500 w-5 text-right relative bottom-0.5 right-1.5">
                                {modifiedStrokeWidth !== null ? modifiedStrokeWidth : '-'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="relative flex items-center">
                <button
                    onClick={() => setActiveMenu(prev => prev === 'opacity' ? null : 'opacity')}
                    title="Opacity"
                    className={`p-2 rounded-xl transition cursor-pointer hover:text-gray-900 ${activeMenu === 'opacity' ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                    <Eye size={16} />
                </button>

                {activeMenu === 'opacity' && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-2 bg-white border border-gray-200 rounded-xl shadow-xl flex flex-col w-32">
                        <span className="text-[9px] text-gray-400 font-normal pb-0.5 text-left w-full">Opacity</span>
                        <div className="flex items-center gap-2 w-full">
                            <input 
                                type="range" 
                                min="0.1" 
                                max="1" 
                                step="0.1"
                                value={modifiedOpacity ?? 1} 
                                onChange={(e) => handleUserChange('opacity', Number(e.target.value))} 
                                className="flex-1 accent-gray-600 cursor-pointer min-w-0" 
                            />
                            <span className="text-xs text-gray-500 w-8 text-right relative bottom-0.5 right-2">
                                {modifiedOpacity !== null ? `${Math.round(modifiedOpacity * 100)}%` : '-'}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}