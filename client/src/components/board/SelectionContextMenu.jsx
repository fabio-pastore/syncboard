import { useState, useEffect, useRef } from 'react';
import { Copy, Trash2, ListPlus, Eye } from 'lucide-react';
import { RgbaToHex } from '../../utils/boardUtils';
import { INPUT_UPDATE_INTERVAL } from '../../utils/boardConstants';
import LocalColorPicker from './LocalColorPicker';

export default function SelectionContextMenu({ visible, position, selectedLines, onCopy, onDelete, onModify }) {
    const [modifiedBrushColor, setModifiedBrushColor] = useState("#000000");
    const [modifiedFillColor, setModifiedFillColor] = useState("#ffffff");
    const [modifiedStrokeWidth, setModifiedStrokeWidth] = useState(3);
    const [modifiedOpacity, setModifiedOpacity] = useState(1);
    const [activeMenu, setActiveMenu] = useState(null); // 'width' if width menu is open or 'opacity' for opacity menu, else null
    const isInitialMount = useRef(true);

    // hide sub-menus if main menu is closed
    useEffect(() => {
    if (!visible) {
        setActiveMenu(null);
    }
}, [visible]);

    const selectedCount = selectedLines?.length || 0;
    const selectedShape = selectedCount === 1 ? selectedLines[0] : null;
    const shapeId = selectedShape?.id;
    const shapeColor = selectedShape?.color;
    const shapeFill = selectedShape?.fill;
    const shapeStrokeWidth = selectedShape?.strokeWidth;
    const shapeOpacity = selectedShape?.opacity;

    const allEqual = (arr) => {
        return (new Set(arr).size == 1);
    }

    const allEqualProperties = () => {
        return (
            allEqual(selectedLines.map(l => RgbaToHex(l.color))) && 
            allEqual(selectedLines.map(l => RgbaToHex(l.fill))) && 
            allEqual(selectedLines.map(l => l.strokeWidth)) && 
            allEqual(selectedLines.map(l => l.opacity ? l.opacity : 1))        
        );
    }

    useEffect(() => {
        if (!visible) setActiveMenu(null);
    }, [visible]);

    useEffect(() => {
        if (selectedCount === 1) {
            setModifiedBrushColor(RgbaToHex(shapeColor) || "#000000");
            setModifiedFillColor(RgbaToHex(shapeFill) || "#ffffff");
            setModifiedStrokeWidth(shapeStrokeWidth || 3);
            setModifiedOpacity(shapeOpacity || 1);
        }
        else if (allEqualProperties()) {
            setModifiedBrushColor(RgbaToHex(selectedLines[0].color));
            setModifiedFillColor(RgbaToHex(selectedLines[0].fill));
            setModifiedStrokeWidth(selectedLines[0].strokeWidth);
            setModifiedOpacity(selectedLines[0].opacity ? selectedLines[0].opacity : 1);
        }
        else {
            setModifiedBrushColor("#000000");
            setModifiedFillColor("#ffffff");
            setModifiedStrokeWidth(3);
            setModifiedOpacity(1);
        }
    }, [selectedCount, shapeId, shapeColor, shapeFill, shapeStrokeWidth, shapeOpacity]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        
        // timeout is necessary unless you wish to update the board component ~60 times per second (don't remove this)
        const timeoutId = setTimeout(() => {
            onModify(modifiedBrushColor, modifiedFillColor, modifiedStrokeWidth, modifiedOpacity);
        }, INPUT_UPDATE_INTERVAL); 
        
        return () => clearTimeout(timeoutId);
    }, [modifiedBrushColor, modifiedFillColor, modifiedStrokeWidth, modifiedOpacity]);

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

            <button
                onClick={onCopy}
                title="Copy"
                className='p-2 rounded-xl transition cursor-pointer hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            >
                <Copy size={16} />
            </button>


            <button
                onClick={onDelete}
                title="Delete"
                className='p-2 rounded-xl transition cursor-pointer hover:bg-red-50 text-red-500 hover:text-red-700'
            >
                <Trash2 size={16} />
            </button>

            <div className='w-px h-5 bg-gray-200'></div>

            <LocalColorPicker 
                title="Brush color"
                className="w-4 h-4 m-2"
                value={modifiedBrushColor}
                onChange={setModifiedBrushColor}
            />

            <LocalColorPicker 
                title="Fill color"
                className="w-4 h-4 m-2"
                value={modifiedFillColor}
                onChange={setModifiedFillColor}
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
                                value={modifiedStrokeWidth} 
                                onChange={(e) => setModifiedStrokeWidth(Number(e.target.value))} 
                                className="flex-1 accent-gray-600 cursor-pointer min-w-0" 
                            />
                            <span className="text-xs text-gray-500 w-5 text-right relative bottom-0.5 right-1.5">{modifiedStrokeWidth}</span>
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
                                value={modifiedOpacity} 
                                onChange={(e) => setModifiedOpacity(Number(e.target.value))} 
                                className="flex-1 accent-gray-600 cursor-pointer min-w-0" 
                            />
                            <span className="text-xs text-gray-500 w-8 text-right relative bottom-0.5 right-2">{Math.round(modifiedOpacity * 100)}%</span>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}