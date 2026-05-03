import { Group, Rect, Line, Circle, Text } from "react-konva";
import { SELECTION_BOX_COLOR, RESIZE_HANDLE_WH, HANDLE_BOTTOM, HANDLE_BOTTOM_LEFT, HANDLE_BOTTOM_RIGHT, HANDLE_LEFT, HANDLE_RIGHT, HANDLE_TOP, HANDLE_TOP_LEFT, HANDLE_TOP_RIGHT } from "../../utils/boardConstants";
import { getDynamicCursor } from "../../utils/boardUtils";

export default function SelectionBox({
    selectionBBox, selectionBBoxRotation,
    handleResizeStart, handleRotationStart,
    setIsManipulating, stageRef
}) {
    if (!selectionBBox) return null;

    const handleSBoxRotComponentMouseEnter = (e) => e.target.getStage().container().style.cursor = 'grab';
    const handleSBoxResizeComponentMouseEnter = (e, current_handle) => {
        const cursor = getDynamicCursor(current_handle, selectionBBoxRotation);
        e.target.getStage().container().style.cursor = cursor;
    };
    const handleSBoxComponentMouseLeave = (e) => e.target.getStage().container().style.cursor = 'default';

    return (
        <Group
            x={selectionBBox.globalCenterX !== undefined ? selectionBBox.globalCenterX : selectionBBox.x + selectionBBox.width / 2}
            y={selectionBBox.globalCenterY !== undefined ? selectionBBox.globalCenterY : selectionBBox.y + selectionBBox.height / 2}
            offsetX={selectionBBox.x + selectionBBox.width / 2}
            offsetY={selectionBBox.y + selectionBBox.height / 2}
            rotation={selectionBBoxRotation || 0}
        >
            <Rect
                name="selection-box"
                x={selectionBBox.x}
                y={selectionBBox.y}
                width={selectionBBox.width}
                height={selectionBBox.height}
                stroke={SELECTION_BOX_COLOR}
                strokeWidth={1.5}
                dash={[6, 3]}
                listening={true}
                fill="rgba(59, 130, 246, 0.25)"
            />

            {[
                { id: HANDLE_TOP_LEFT, x: selectionBBox.x, y: selectionBBox.y },
                { id: HANDLE_TOP, x: selectionBBox.x + selectionBBox.width / 2, y: selectionBBox.y },
                { id: HANDLE_TOP_RIGHT, x: selectionBBox.x + selectionBBox.width, y: selectionBBox.y },
                { id: HANDLE_RIGHT, x: selectionBBox.x + selectionBBox.width, y: selectionBBox.y + selectionBBox.height / 2 },
                { id: HANDLE_BOTTOM_RIGHT, x: selectionBBox.x + selectionBBox.width, y: selectionBBox.y + selectionBBox.height },
                { id: HANDLE_BOTTOM, x: selectionBBox.x + selectionBBox.width / 2, y: selectionBBox.y + selectionBBox.height },
                { id: HANDLE_BOTTOM_LEFT, x: selectionBBox.x, y: selectionBBox.y + selectionBBox.height },
                { id: HANDLE_LEFT, x: selectionBBox.x, y: selectionBBox.y + selectionBBox.height / 2 }
            ].map((handle) => (
                <Rect
                    key={handle.id}
                    id={handle.id}
                    x={handle.x - 4}
                    y={handle.y - 4}
                    width={RESIZE_HANDLE_WH}
                    height={RESIZE_HANDLE_WH}
                    fill={SELECTION_BOX_COLOR}
                    stroke={SELECTION_BOX_COLOR}
                    strokeWidth={1}
                    onPointerDown={(e) => { setIsManipulating(true); handleResizeStart(e, handle.id) }}
                    onTouchStart={(e) => { setIsManipulating(true); handleResizeStart(e, handle.id) }}
                    onMouseEnter={(e) => handleSBoxResizeComponentMouseEnter(e, handle.id)}
                    onMouseLeave={handleSBoxComponentMouseLeave}
                    listening={true}
                />
            ))}

            <Line
                points={[
                    selectionBBox.x + selectionBBox.width / 2, selectionBBox.y - 25,
                    selectionBBox.x + selectionBBox.width / 2, selectionBBox.y
                ]}
                stroke={SELECTION_BOX_COLOR}
                strokeWidth={1}
                dash={[4, 2]}
                listening={false}
            />

            <Group
                name="rotation-handler"
                x={selectionBBox.x + selectionBBox.width / 2}
                y={selectionBBox.y - 25}
                listening={true}

                onMouseEnter={(e) => { handleSBoxRotComponentMouseEnter(e) }}
                onMouseLeave={(e) => { handleSBoxComponentMouseLeave(e) }}

                onPointerDown={(e) => {
                    e.cancelBubble = true;
                    e.evt.preventDefault();
                    const stage = stageRef.current;
                    const pointerScale = stage.scaleX() || 1;
                    setIsManipulating(true);
                    handleRotationStart(stage.getPointerPosition(), pointerScale);
                }}

                onTouchStart={(e) => {
                    e.cancelBubble = true;
                    e.evt.preventDefault();
                    const stage = stageRef.current;
                    const pointerScale = stage.scaleX() || 1;
                    setIsManipulating(true);
                    handleRotationStart(stage.getPointerPosition(), pointerScale);
                }}
            >
                <Circle
                    x={0}
                    y={0}
                    radius={12}
                    fill="white"
                    stroke={SELECTION_BOX_COLOR}
                    strokeWidth={1.25}
                />

                <Text
                    x={0}
                    y={0}
                    text="↻"
                    fontSize={18}
                    fill={SELECTION_BOX_COLOR}
                    offsetX={7}
                    offsetY={9.5}
                    fontStyle="normal"
                />
            </Group>
        </Group>
    );
}