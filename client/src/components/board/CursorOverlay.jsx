import { Group, Line, Text, Rect } from "react-konva";
import Konva from "konva";
import { CURSOR_IDLE_FADE } from "../../utils/boardConstants";

// yes i'm drawing a cursor specifing the coordinates
const POINTER_PATH = [
    0, 0,     // where it starts
    0, 14,    // down the left edge
    4, 11,    // inner notch
    7, 18,    // tail bottom
    10, 16,   // tail right
    7, 9,     // inner right
    12, 9,    // right wing
];

export default function CursorOverlay({ cursors }) {
    const now = Date.now();

    return Object.entries(cursors).map(([socketId, cursor]) => {
        const age = now - cursor.lastSeen;
        // fade out thing
        const opacity = age > CURSOR_IDLE_FADE ? Math.max(0, 1 - (age - CURSOR_IDLE_FADE) / 5000) : 1;
        if (opacity <= 0) return null;

        const { x, y, username, color } = cursor;
        const fontSize = 11;
        const paddingX = 8;
        const paddingY = 4;
        const fontFamily = "Inter, system-ui, sans-serif";
        const fontStyle = "600";
        const measured = new Konva.Text({ text: username, fontSize, fontFamily, fontStyle });
        const textWidth = measured.width();
        const pillWidth = textWidth + paddingX * 2;
        const pillHeight = fontSize + paddingY * 2;

        return (
            <Group key={socketId} x={x} y={y} opacity={opacity} listening={false}>
                <Line
                    points={POINTER_PATH.map((v, i) => v + (i % 2 === 0 ? 1.5 : 1.5))}
                    fill="rgba(0,0,0,0.18)"
                    closed={true}
                    listening={false}
                />
                
                <Line
                    points={POINTER_PATH}
                    fill={color}
                    stroke="white"
                    strokeWidth={1.2}
                    closed={true}
                    lineJoin="round"
                    listening={false}
                />
                
                <Rect
                    x={14}
                    y={16}
                    width={pillWidth}
                    height={pillHeight}
                    cornerRadius={6}
                    fill="rgba(0,0,0,0.12)"
                    listening={false}
                />
                
                <Rect
                    x={12}
                    y={14}
                    width={pillWidth}
                    height={pillHeight}
                    cornerRadius={6}
                    fill={color}
                    listening={false}
                />
                
                <Text
                    x={12 + paddingX}
                    y={14 + paddingY - 1}
                    text={username}
                    fontSize={fontSize}
                    fontFamily={fontFamily}
                    fontStyle={fontStyle}
                    fill="white"
                    listening={false}
                />
            </Group>
        );
    });
}