import { useState } from "react";

/**
 * Manages the complete state for the drawing toolbar.
 *
 * Provides state and setters for all tool settings including active tool,
 * colors, stroke widths, shape options, opacity values, submenu visibility,
 * and touch-device modes.
 *
 * @returns {object} An object containing all toolbar state variables and their setters:
 *   - tool {string}: The active tool ID ('pen', 'highlighter', etc.).
 *   - setTool {function}: Sets the active tool.
 *   - brushColor {string}: The pen brush color hex value.
 *   - setBrushColor {function}: Sets the pen brush color.
 *   - highlighterColor {string}: The highlighter color hex value.
 *   - setHighlighterColor {function}: Sets the highlighter color.
 *   - shapeColor {string}: The shape fill color hex value.
 *   - setShapeColor {function}: Sets the shape fill color.
 *   - shapeBorderColor {string}: The shape border color hex value.
 *   - setShapeBorderColor {function}: Sets the shape border color.
 *   - shapeFillOpacity {number}: Opacity of the shape fill.
 *   - setShapeFillOpacity {function}: Sets the shape fill opacity.
 *   - shapeBorderOpacity {number}: Opacity of the shape border.
 *   - setShapeBorderOpacity {function}: Sets the shape border opacity.
 *   - fillShape {boolean}: Whether shapes should be filled.
 *   - setFillShape {function}: Toggles shape fill.
 *   - selectedShapeMenu {boolean}: Whether the shape submenu is visible.
 *   - setSelectedShapeMenu {function}: Toggles the shape submenu.
 *   - shape {string}: The selected shape type ('line', 'triangle', etc.).
 *   - setShape {function}: Sets the shape type.
 *   - strokeWidth {number}: The pen stroke width.
 *   - setStrokeWidth {function}: Sets the pen stroke width.
 *   - shapeWidth {number}: The shape stroke width.
 *   - setShapeWidth {function}: Sets the shape stroke width.
 *   - eraserSize {number}: The eraser size.
 *   - setEraserSize {function}: Sets the eraser size.
 *   - highlighterSize {number}: The highlighter stroke width.
 *   - setHighlighterSize {function}: Sets the highlighter size.
 *   - highlighterOpacity {number}: The highlighter opacity value.
 *   - setHighlighterOpacity {function}: Sets the highlighter opacity.
 *   - selectedHighlighterMenu {boolean}: Whether the highlighter submenu is visible.
 *   - setSelectedHighlighterMenu {function}: Toggles the highlighter submenu.
 *   - touchDrawMode` {boolean}: Whether finger-draw mode is active on touch devices.
 *   - setTouchDrawMode` {function}: Toggles touch draw mode.
 */

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
