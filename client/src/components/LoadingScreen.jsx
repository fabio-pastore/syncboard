export default function LoadingScreen() {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-[9999] overflow-hidden">
            <style>
                {`
                .stroke-violet {
                    -webkit-text-stroke: 1px #8b5cf6; /*i.e. violet-500 */
                }
                .stroke-gray {
                    -webkit-text-stroke: 1px #1f2937; /*i.e. gray-800 */
                }
                .text-fill-anim {
                    animation: fillText 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
                @keyframes fillText {
                    0%, 15% { clip-path: inset(-20px 100% -20px -20px); }
                    45%, 55% { clip-path: inset(-20px -20px -20px -20px); }
                    85%, 100% { clip-path: inset(-20px -20px -20px 100%); }
                }
                
                .shape-anim {
                    animation-duration: 6s;
                    animation-iteration-count: infinite;
                    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
                }
                .shape-1 { animation-name: shapeCycle1; }
                .shape-2 { animation-name: shapeCycle2; }
                .shape-3 { animation-name: shapeCycle3; }

                @keyframes shapeCycle1 {
                    0% { opacity: 0; transform: scale(0.5) rotate(-45deg); }
                    10%, 23% { opacity: 0.6; transform: scale(1) rotate(45deg); }
                    33.33%, 100% { opacity: 0; transform: scale(1.5) rotate(135deg); }
                }
                @keyframes shapeCycle2 {
                    0%, 33.33% { opacity: 0; transform: scale(0.5) rotate(-45deg); }
                    43.33%, 56.66% { opacity: 0.6; transform: scale(1) rotate(45deg); }
                    66.66%, 100% { opacity: 0; transform: scale(1.5) rotate(135deg); }
                }
                @keyframes shapeCycle3 {
                    0%, 66.66% { opacity: 0; transform: scale(0.5) rotate(-90deg); }
                    76.66%, 90% { opacity: 0.6; transform: scale(1) rotate(0deg); }
                    100% { opacity: 0; transform: scale(1.5) rotate(90deg); }
                }
                
                .dot-anim {
                    animation-name: dotBounce;
                    animation-duration: 1.4s;
                    animation-iteration-count: infinite;
                    animation-timing-function: ease-in-out;
                    animation-fill-mode: both;
                }
                @keyframes dotBounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-8px); }
                }
                `}
            </style>

            {/* bg shapes */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
                {/* triangle */}
                <svg className="absolute shape-anim shape-1 w-[100vw] max-w-[1000px] h-[100vw] max-h-[1000px] text-violet-400" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
                    <polygon points="50,10 85,70 15,70" />
                </svg>

                {/* square */}
                <svg className="absolute shape-anim shape-2 w-[75vw] max-w-[650px] h-[75vw] max-h-[650px] text-violet-500" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
                    <rect x="15" y="15" width="70" height="70" />
                </svg>

                {/* circle */}
                <svg className="absolute shape-anim shape-3 w-[85vw] max-w-[750px] h-[85vw] max-h-[750px] text-violet-500" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1">
                    <circle cx="50" cy="50" r="35" />
                </svg>
            </div>

            {/* central div */}
            <div className="flex flex-col items-center justify-center gap-4 z-10">
                <div className="relative text-5xl md:text-6xl font-semibold tracking-tight">
                    {/* outline layer */}
                    <div className="text-white select-none flex whitespace-nowrap">
                        <span className="stroke-violet">Sync</span>
                        <span className="stroke-gray">Board</span>
                    </div>

                    {/* fill layer */}
                    <div className="absolute inset-0 text-fill-anim flex whitespace-nowrap select-none">
                        <span className="text-violet-500 stroke-violet">Sync</span>
                        <span className="text-gray-800 stroke-gray">Board</span>
                    </div>
                </div>

                {/* three dots */}
                <div className="flex gap-2 items-center h-4 mt-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-600 dot-anim" style={{ animationDelay: '0ms' }} />
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-500 dot-anim" style={{ animationDelay: '150ms' }} />
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-400 dot-anim" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        </div>
    );
}
