import { useState } from "react";

export default function useToolbarState() {
    const [tool, setTool] = useState("pen");
    const [brushColor, setBrushColor] = useState("#000000");
    const [highlighterColor, setHighlighterColor] = useState("#eab308");
    const [shapeColor, setShapeColor] = useState("#3b82f6");
    const [shapeBorderColor, setShapeBorderColor] = useState("#000000");
    const [shapeFillOpacity, setShapeFillOpacity] = useState(1);
    const [shapeBorderOpacity, setShapeBorderOpacity] = useState(1);
    const [fillShape, setFillShape] = useState(false);
    const [selectedShapeMenu, setSelectedShapeMenu] = useState(false);
    const [shape, setShape] = useState('');
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [shapeWidth, setShapeWidth] = useState(5);
    const [eraserSize, setEraserSize] = useState(10);
    const [highlighterSize, setHighlighterSize] = useState(30);
    const [highlighterOpacity, setHighlighterOpacity] = useState(0.3);
    const [selectedHighlighterMenu, setSelectedHighlighterMenu] = useState(false);
    const [touchDrawMode, setTouchDrawMode] = useState(false);

    return {
        tool, setTool,
        brushColor, setBrushColor,
        highlighterColor, setHighlighterColor,
        shapeColor, setShapeColor,
        shapeBorderColor, setShapeBorderColor,
        shapeFillOpacity, setShapeFillOpacity,
        shapeBorderOpacity, setShapeBorderOpacity,
        fillShape, setFillShape,
        selectedShapeMenu, setSelectedShapeMenu,
        shape, setShape,
        strokeWidth, setStrokeWidth,
        shapeWidth, setShapeWidth,
        eraserSize, setEraserSize,
        highlighterSize, setHighlighterSize,
        highlighterOpacity, setHighlighterOpacity,
        selectedHighlighterMenu, setSelectedHighlighterMenu,
        touchDrawMode, setTouchDrawMode
    };
}
