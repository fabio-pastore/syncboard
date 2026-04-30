import { useState } from 'react';
import {Copy, Trash2, ListPlus, Check, Eye } from 'lucide-react';

export default function SelectionContextMenu({ visible, position, onCopy, onDelete, onModify }) {
    const [modifiedColor, setModifiedColor] = useState("#000000");
    const [modifiedStrokeWidth, setModifiedStrokeWidth] = useState(3);
    const [modifiedOpacity, setModifiedOpacity] = useState(1);
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

            <div className='w-px h-5 bg-gray-200'></div>

            <button
                onClick={onDelete}
                title="Delete"
                className='p-2 rounded-xl transition cursor-pointer hover:bg-red-50 text-red-500 hover:text-red-700'
            >
                <Trash2 size={16} />
            </button>

            <div className='w-px h-5 bg-gray-200'></div>

            <label className="m-2 relative w-4 h-4 cursor-pointer items-center flex" title="Modify color">
                    <div className="w-4 h-4 rounded-full border-2 transition"
                        style={{
                            background: modifiedColor,
                            borderColor: `color-mix(in srgb, ${modifiedColor}, black 30%)`
                        }}
                    />
                    <input type="color" value={modifiedColor} onChange={(e) => setModifiedColor(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
            </label>

            <div className='w-px h-5 bg-gray-200'></div>

            <button
                onClick={() => {}}
                title="Copy"
                className='p-2 rounded-xl transition cursor-pointer hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            >
                <ListPlus size={16} />
            </button>

            <div className='w-px h-5 bg-gray-200'></div>

            <button
                onClick={() => onModify(modifiedColor, modifiedStrokeWidth, modifiedOpacity)}
                title="Apply"
                className='p-2 rounded-xl transition cursor-pointer hover:bg-gray-100 text-green-500'
            >
                <Check size={16} />
            </button>


        </div>
    );
}