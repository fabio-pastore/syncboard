import { Line, Circle, Group } from "react-konva";
import { computeCircleData } from "../../utils/boardUtils";

export default function DrawingLines({
    lines, selectedIds,
    activeLineRef, activeCircleFillRef, activeCircleStrokeRef,
    selectionLassoRef
}) {
    return (
        <>
            {lines.filter(line => !selectedIds.includes(line.id)).map((line) => {
                if (line.type === 'circle') {
                    const { x_center, y_center, radius } = computeCircleData(line.points);
                    const sw = line.strokeWidth || 0;
                    return (
                        <Group
                            key={line.id}
                            x={line.x || 0}
                            y={line.y || 0}
                            offsetX={line.offsetX || 0}
                            offsetY={line.offsetY || 0}
                            rotation={line.rotation || 0}
                        >
                            {line.fill && (
                                <Circle
                                    key={line.id + '_fill'}
                                    id={line.id}
                                    x={x_center}
                                    y={y_center}
                                    radius={Math.max(0, radius - sw / 2)}
                                    fill={line.fill}
                                    opacity={line.opacity}
                                    globalCompositeOperation={line.globalCompositeOperation}
                                    listening={true}
                                />
                            )}
                            <Circle
                                id={line.id}
                                x={x_center}
                                y={y_center}
                                radius={radius}
                                stroke={line.color}
                                strokeWidth={sw}
                                opacity={line.opacity}
                                globalCompositeOperation={line.globalCompositeOperation}
                                listening={true}
                                fillEnabled={false}
                            />
                        </Group>
                    );
                }
                return (
                    <Line
                        key={line.id}
                        id={line.id}
                        points={line.points}
                        stroke={line.color}
                        fill={line.fill}
                        fillEnabled={!!line.fill}
                        strokeWidth={line.strokeWidth}
                        opacity={line.opacity}
                        hitStrokeWidth={line.hitStrokeWidth}
                        tension={line.tension}
                        globalCompositeOperation={line.globalCompositeOperation}
                        closed={line.closed}
                        lineCap={line.lineCap}
                        lineJoin={line.lineJoin}
                        dash={line.dash}
                        x={line.x}
                        y={line.y}
                        offsetX={line.offsetX}
                        offsetY={line.offsetY}
                        rotation={line.rotation}
                        listening={true}
                    />
                );
            })}

            {/* selected lines */}
            {lines.filter(line => selectedIds.includes(line.id)).map((line) => {
                if (line.type === 'circle') {
                    const { x_center, y_center, radius } = computeCircleData(line.points);
                    const sw = line.strokeWidth || 0;
                    return (
                        <Group
                            key={`sel_${line.id}`}
                            x={line.x || 0}
                            y={line.y || 0}
                            offsetX={line.offsetX || 0}
                            offsetY={line.offsetY || 0}
                            rotation={line.rotation || 0}
                        >
                            <Circle
                                x={x_center}
                                y={y_center}
                                radius={radius}
                                stroke="#3b82f6"
                                strokeWidth={sw + 12}
                                opacity={0.75}
                                listening={false}
                            />

                            {line.fill && (
                                <Circle
                                    id={line.id}
                                    x={x_center}
                                    y={y_center}
                                    radius={Math.max(0, radius - sw / 2)}
                                    fill={line.fill}
                                    opacity={line.opacity}
                                    globalCompositeOperation={line.globalCompositeOperation}
                                    listening={true}
                                />
                            )}
                            <Circle
                                id={line.id}
                                x={x_center}
                                y={y_center}
                                radius={radius}
                                stroke={line.color}
                                strokeWidth={sw}
                                opacity={line.opacity}
                                globalCompositeOperation={line.globalCompositeOperation}
                                listening={true}
                                fillEnabled={false}
                            />
                        </Group>
                    );
                }
                return (
                    <Group
                        key={line.id}
                        x={line.x || 0}
                        y={line.y || 0}
                        offsetX={line.offsetX || 0}
                        offsetY={line.offsetY || 0}
                        rotation={line.rotation || 0}
                    >
                        <Line
                            points={line.points}
                            stroke="#3b82f6"
                            strokeWidth={(line.strokeWidth || 3) + 12}
                            opacity={0.75}
                            tension={line.tension}
                            closed={line.closed}
                            lineCap={line.lineCap}
                            lineJoin={line.lineJoin}
                            listening={false}
                        />

                        <Line
                            id={line.id}
                            points={line.points}
                            stroke={line.color}
                            fill={line.fill}
                            fillEnabled={!!line.fill}
                            strokeWidth={line.strokeWidth}
                            opacity={line.opacity}
                            hitStrokeWidth={line.hitStrokeWidth}
                            tension={line.tension}
                            globalCompositeOperation={line.globalCompositeOperation}
                            closed={line.closed}
                            lineCap={line.lineCap}
                            lineJoin={line.lineJoin}
                            dash={line.dash}
                            listening={true}
                        />
                    </Group>
                );
            })}

            <Line
                ref={activeLineRef}
                tension={0.3}
                lineCap="round"
                lineJoin="round"
                dash={activeLineRef.dash}
                listening={false}
                visible={false}
            />

            <Circle
                ref={activeCircleFillRef}
                visible={false}
                listening={false}
            />

            <Circle
                ref={activeCircleStrokeRef}
                visible={false}
                listening={false}
            />

            <Line
                ref={selectionLassoRef}
                stroke="#3b82f6"
                strokeWidth={1.5}
                dash={[8, 4]}
                closed={true}
                listening={false}
                visible={false}
                opacity={0.7}
            />
        </>
    );
}