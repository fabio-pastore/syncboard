import { useState } from 'react';
import { ClipboardPaste, Image, ChevronRight, Check } from 'lucide-react';
import LocalColorPicker from './LocalColorPicker';

export default function StageContextMenu({ 
    visible, 
    disabled, 
    position, 
    onPaste, 
    onClose,
    canModifyBackground,
    currentBackground = 'none', 
    onBackgroundChange,
    currentBgColor = '#ffffff', 
    onBgColorChange                  
}) {
    const [showBgMenu, setShowBgMenu] = useState(false);

    if (!visible) return null;

    const backgrounds = [
        { id: 'none', label: 'None' },
        { id: 'grid', label: 'Grid' },
        { id: 'lines', label: 'Lines' }
    ];

    return (
        <>
            <div 
                className='fixed inset-0 z-[9]' 
                onClick={onClose} 
                onContextMenu={(e) => { e.preventDefault(); onClose(); }}
            ></div>

            <div 
                className='fixed z-10 flex flex-col p-1.5
                    bg-white border border-gray-200 rounded-2xl backdrop-blur-md shadow-2xl
                    transition-opacity transition-colors duration-150 origin-bottom w-44'
                style={{
                    left: position.x,
                    top: position.y,
                    transform: 'translate(-50%, -100%)',
                }}
            >
                <button
                    onClick={() => { onPaste(); onClose(); }}
                    title="Paste"
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition w-full text-left
                        ${disabled ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                    disabled={disabled}
                >
                    <ClipboardPaste size={16} />
                    <span className='text-sm font-medium'>Paste</span> 
                </button>

                <div className="h-px bg-gray-100 my-1 mx-2"></div>

               <div 
                    className="relative"
                    onMouseEnter={() => canModifyBackground && setShowBgMenu(true)}
                    onMouseLeave={() => setShowBgMenu(false)}
                >
                    <button
                        disabled={!canModifyBackground}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl transition w-full text-left
                            ${!canModifyBackground 
                                ? 'text-gray-400 cursor-not-allowed' 
                                : `text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${showBgMenu ? 'bg-gray-100 text-gray-900' : ''}`
                            }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <Image size={16} />
                            <span className='text-sm font-medium'>Background</span>
                        </div>
                        <ChevronRight size={14} className={!canModifyBackground ? "text-gray-300" : "text-gray-400"} />
                    </button>

                    {showBgMenu && (
                        <div className="absolute left-full bottom-0 pl-1.5 z-20">
                            <div className="p-1.5 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl flex flex-col">
                                {backgrounds.map((bg) => (
                                    <button
                                        key={bg.id}
                                        onClick={(e) => {
                                            e.stopPropagation(); 
                                            if (onBackgroundChange) onBackgroundChange(bg.id);
                                            onClose();
                                        }}
                                        className="flex items-center justify-between px-3 py-2 rounded-xl transition hover:bg-gray-100 text-gray-700 hover:text-gray-900 text-left w-full"
                                    >
                                        <span className="text-sm font-medium">{bg.label}</span>
                                        {currentBackground === bg.id && (
                                            <Check size={16} className="text-purple-500" />
                                        )}
                                    </button>
                                ))}

                                <div className="h-px bg-gray-100 my-1 mx-2"></div>

                                <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl transition w-full ${!canModifyBackground ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <span className='text-sm font-medium text-gray-700'>BG colour</span>
                                    <LocalColorPicker 
                                        title="Canvas Color"
                                        className="w-5 h-5"
                                        value={currentBgColor}
                                        onChange={onBgColorChange}
                                    />
                                </div>    

                            </div>
                        </div>
                    )}
                </div>

            </div>
        </>
    );
}