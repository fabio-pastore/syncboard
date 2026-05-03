import { Search } from "lucide-react";

export default function ZoomIndicator({ scale, hasZoomed }) {
    return (
        <div 
            className={`
                fixed bottom-2 left-2 flex items-center gap-2 pointer-events-none z-10 transition-opacity duration-300 ease-in-out
                py-1.5 px-2 rounded-xl bg-white border border-gray-200 text-gray-800 shadow-sm text-sm
                ${hasZoomed ? 'opacity-100 ' : 'opacity-0'} 
            `}
        >
            <Search size={14} />
            <div className="w-px h-6 bg-gray-300"></div>
            {Math.round(100 * scale) + "%"}
        </div>
    );
}