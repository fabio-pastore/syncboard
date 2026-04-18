import { Pencil, Eraser, Minus, Plus, Undo2, Redo2, Highlighter, Shapes, Triangle, Square, Circle as CircleIcon, PaintBucket, LassoSelect } from "lucide-react";
import ToolButton from "./ToolButton";
import { PRESET_COLORS } from "../../utils/boardConstants";
import { getContrastColor } from "../../utils/boardUtils";

export default function Toolbar({
    tool, setTool,
    shape, setShape,
    brushColor, highlighterColor, setColor,
    activeSize, setActiveSize,
    strokeWidth, highlighterSize, eraserSize, shapeWidth,
    highlighterOpacity, setHighlighterOpacity,
    selectedShapeMenu, setSelectedShapeMenu,
    selectedHighlighterMenu, setSelectedHighlighterMenu,
    shapeBorderColor, setShapeBorderColor,
    shapeColor, setShapeColor,
    shapeBorderOpacity, setShapeBorderOpacity,
    shapeFillOpacity, setShapeFillOpacity,
    fillShape, setFillShape,
    editHistory, handleUndo, handleRedo,
}) {
    return (
        <div className="fixed bottom-6 left-1/2 bg-white flex items-center gap-1 px-3 py-2 
            -translate-x-1/2 border border-gray-200 rounded-2xl backdrop-blur-md shadow-2xl z-10
            max-w-[95vw] overflow-x-clip overflow-y-visible"
        >
            <ToolButton
                active={tool === "pen"}
                onClick={() => {
                    setTool("pen");
                    setSelectedShapeMenu(false);
                    setSelectedHighlighterMenu(false);
                }}
                title="Pen"
            >
                <Pencil size={18} />
            </ToolButton>

            <ToolButton
                active={tool === "highlighter"}
                onClick={() => {
                    setTool("highlighter");
                    setSelectedShapeMenu(false);
                    setSelectedHighlighterMenu(prev => !prev);
                }}
                title="Highlighter"
            >
                <Highlighter size={18} />
            </ToolButton>

            <div
                id='highlighter_op_selector'
                className="absolute bottom-14 left-6 bg-white flex items-center gap-1 px-2 py-4 border border-gray-200 rounded-2xl"
                style={{ display: (tool === 'highlighter' && selectedHighlighterMenu) ? 'flex' : 'none' }}
            >
                <div className="flex flex-col gap-1 mx-1" title="Highlighter opacity">
                    <span className="text-[9px] text-gray-400 leading-none pb-1">Opacity</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={highlighterOpacity}
                        onChange={(e) => setHighlighterOpacity(parseFloat(e.target.value))}
                        className="w-16 h-1 accent-gray-900 cursor-pointer"
                    />
                </div>
            </div>

            <ToolButton
                active={tool === "eraser"}
                onClick={() => {
                    setTool("eraser");
                    setSelectedShapeMenu(false);
                    setSelectedHighlighterMenu(false);
                }}
                title="Eraser"
            >
                <Eraser size={18} />
            </ToolButton>

            <ToolButton
                active={tool === "select"}
                onClick={() => {
                    setTool("select");
                    setSelectedShapeMenu(false);
                    setSelectedHighlighterMenu(false);
                }}
                title="Select"
            >
                <LassoSelect size={18} />
            </ToolButton>

            <ToolButton
                active={tool === "shape"}
                onClick={() => {
                    setTool('shape');
                    setSelectedShapeMenu(prev => !prev);
                    setSelectedHighlighterMenu(false);
                }}
                title="Shape"
            >
                <Shapes size={18} />
            </ToolButton>

            <div
                id='shape_selector'
                className="absolute bottom-14 left-16 bg-white flex items-center gap-1 px-2 py-2 border border-gray-200 rounded-2xl"
                style={{ display: (tool === 'shape' && selectedShapeMenu) ? 'flex' : 'none' }}
            >
                <ToolButton active={shape === "line"} onClick={() => setShape("line")} title="Line">
                    <Minus size={18} />
                </ToolButton>
                <ToolButton active={shape === "triangle"} onClick={() => setShape("triangle")} title="Triangle">
                    <Triangle size={18} />
                </ToolButton>
                <ToolButton active={shape === "rectangle"} onClick={() => setShape("rectangle")} title="Rectangle">
                    <Square size={18} />
                </ToolButton>
                <ToolButton active={shape === "circle"} onClick={() => setShape("circle")} title="Circle">
                    <CircleIcon size={18} />
                </ToolButton>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                <label className="relative w-6 h-6 cursor-pointer" title="Shape border color">
                    <div className="w-6 h-6 rounded-full border-2 transition hover:scale-110"
                        style={{
                            background: shapeBorderColor,
                            borderColor: `color-mix(in srgb, ${shapeBorderColor}, black 30%)`
                        }}
                    />
                    <input type="color" value={shapeBorderColor} onChange={(e) => setShapeBorderColor(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                </label>

                <label className="relative w-6 h-6 cursor-pointer" title="Shape color">
                    <div className="w-6 h-6 rounded-full border-2 transition hover:scale-110"
                        style={{
                            background: shapeColor,
                            borderColor: `color-mix(in srgb, ${shapeColor}, black 30%)`
                        }}
                    />
                    <input type="color" value={shapeColor} onChange={(e) => setShapeColor(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                </label>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                <div className="flex flex-col gap-1 mx-1" title="Border opacity">
                    <span className="text-[9px] text-gray-400 leading-none pb-1">Border</span>
                    <input
                        type="range" min="0" max="1" step="0.05"
                        value={shapeBorderOpacity}
                        onChange={(e) => setShapeBorderOpacity(parseFloat(e.target.value))}
                        className="w-16 h-1 accent-gray-900 cursor-pointer"
                    />
                </div>

                <div className="flex flex-col gap-1 mx-1" title="Fill opacity">
                    <span className="text-[9px] text-gray-400 leading-none pb-1">Fill</span>
                    <input
                        type="range" min="0" max="1" step="0.05"
                        value={shapeFillOpacity}
                        onChange={(e) => setShapeFillOpacity(parseFloat(e.target.value))}
                        className="w-16 h-1 accent-gray-900 cursor-pointer"
                    />
                </div>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                <PaintBucket size={18} />
                <div className="relative mx-2 w-5 h-5">
                    <div
                        className={`absolute inset-0 border-2 border-gray-600 transition-colors duration-200 
                            ${fillShape ? 'bg-current' : 'bg-white'}`}
                        style={{
                            borderRadius: '25%',
                            color: fillShape ? shapeColor : 'transparent'
                        }}
                    >
                        {fillShape && (
                            <svg className="w-full h-full text-white p-0" fill="none" viewBox="0 0 24 24" stroke={getContrastColor(shapeColor)} strokeWidth="4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                    <input
                        type='checkbox'
                        checked={fillShape}
                        onChange={(e) => setFillShape(e.target.checked)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                </div>
            </div>

            {PRESET_COLORS.map((c) => (
                <button
                    key={c}
                    onClick={() => setColor(c)}
                    title={c}
                    className="w-6 h-6 rounded-full border-2 transition cursor-pointer hover:scale-110"
                    style={{
                        background: c,
                        borderColor: `color-mix(in srgb, ${c}, black 30%)`,
                        outline: c === '#ffffff' ? "1px solid #d1d5db" : "none",
                    }}
                />
            ))}

            <label className="relative w-7 h-7 cursor-pointer" title="Color">
                <div className="w-7 h-7 rounded-full border-2 transition hover:scale-110"
                    style={{
                        background: tool === 'highlighter' ? highlighterColor : brushColor,
                        borderColor: `color-mix(in srgb, ${tool === 'highlighter' ? highlighterColor : brushColor}, black 30%)`
                    }}
                />
                <input type="color" value={tool === 'highlighter' ? highlighterColor : brushColor} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
            </label>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            <button
                onClick={() => setActiveSize((s) => Math.max(1, s - ((tool === 'eraser' || tool === 'highlighter') ? 5 : 1)))}
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg cursor-pointer transition"
            >
                <Minus size={14} />
            </button>

            <div className="flex items-center justify-center w-7">
                <div className="rounded-full bg-gray-800" style={{
                    width: Math.min(activeSize * ((tool === 'eraser' || tool === 'highlighter') ? 0.7 : (tool === 'shape') ? 1.25 : 2.5), 22),
                    height: Math.min(activeSize * ((tool === 'eraser' || tool === 'highlighter') ? 0.7 : (tool === 'shape') ? 1.25 : 2.5), 22),
                }} />
            </div>

            <button
                onClick={() => setActiveSize((s) => Math.min((tool === 'eraser' || tool === 'highlighter') ? 80 : 30, s + ((tool === 'eraser' || tool === 'highlighter') ? 5 : 1)))}
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg cursor-pointer transition"
            >
                <Plus size={14} />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            <ToolButton title="Undo" disabled={editHistory.history.length === 0 || editHistory.editIndex === -1} onClick={handleUndo}>
                <Undo2 size={18} />
            </ToolButton>

            <ToolButton title="Redo" disabled={editHistory.history.length === 0 || editHistory.editIndex === editHistory.history.length - 1} onClick={handleRedo}>
                <Redo2 size={18} />
            </ToolButton>
        </div>
    );
}
