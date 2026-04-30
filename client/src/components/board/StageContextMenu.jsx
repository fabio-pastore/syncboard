import { ClipboardPaste } from 'lucide-react';

export default function StageContextMenu({ visible, disabled, position, onPaste, onClose}) {
    if (!visible) return null;
    return (
        <>
            <div className='fixed inset-0 z-[9]' onClick={onClose} onContextMenu={(e) => {e.preventDefault(); onClose();}}>
            </div>
            <div 
            className={`fixed z-10 items-center gap-1 px-2 py-1.5
                bg-white border border-gray-200 rounded-2xl backdrop-blur-md shadow-2xl
                transition-opacity transition-colors duration-150 origin-bottom flex 
                ${disabled ? '' : 'hover:bg-gray-100 hover:text-gray-900'}
            `} 
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -100%)',
            }}
            >
                <div className='p-2'>
                    <button
                        onClick={onPaste}
                        title="Paste"
                        className={
                            `flex items-center gap-1.5 rounded-xl transition 
                            ${disabled ? 'text-gray-400' : 'text-gray-700'}`
                        }
                        disabled={disabled}
                    >
                        <ClipboardPaste size={16} />
                        <span className='text-sm'>Paste</span> 
                    </button>
                    
                </div>
            </div>
        </>
    );
}