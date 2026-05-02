import { useState, useEffect, useRef } from 'react';
import { Copy, Trash2, ListPlus, Eye } from 'lucide-react';

export default function SelectionContextMenu({ visible, position, onCopy, onDelete, onModify }) {
    const [modifiedBrushColor, setModifiedBrushColor] = useState("#000000");
    const [modifiedFillColor, setModifiedFillColor] = useState("#000000");
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

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        onModify(modifiedBrushColor, modifiedFillColor, modifiedStrokeWidth, modifiedOpacity);
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

            <label className="m-2 relative w-4 h-4 cursor-pointer items-center flex transition hover:scale-110" title="Brush color">
                    <div className="w-4 h-4 rounded-full border-2"
                        style={{
                            background: modifiedBrushColor,
                            borderColor: `color-mix(in srgb, ${modifiedBrushColor}, black 30%)`
                        }}
                    />
                    <input type="color" value={modifiedBrushColor} onChange={(e) => setModifiedBrushColor(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
            </label>

            <label className="m-2 relative w-4 h-4 cursor-pointer items-center flex transition hover:scale-110" title="Fill color">
                    <div className="w-4 h-4 rounded-full border-2"
                        style={{
                            background: modifiedFillColor,
                            borderColor: `color-mix(in srgb, ${modifiedFillColor}, black 30%)`
                        }}
                    />
                    <input type="color" value={modifiedFillColor} onChange={(e) => setModifiedFillColor(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
            </label>

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