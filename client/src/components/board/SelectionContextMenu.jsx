import {Copy, Trash2} from 'lucide-react';

export default function SelectionContextMenu({ visible, position, onCopy, onDelete }) {
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

        </div>
    );
}