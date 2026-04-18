export const hexToRgba = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export function smoothPoints(pts, iterations = 2) {
    if (pts.length < 6) return pts;
    let smoothed = [...pts];
    for (let iter = 0; iter < iterations; iter++) {
        const next = [smoothed[0], smoothed[1]];
        for (let i = 2; i < smoothed.length - 2; i += 2) {
            next.push(
                0.25 * smoothed[i - 2] + 0.5 * smoothed[i] + 0.25 * smoothed[i + 2],
                0.25 * smoothed[i - 1] + 0.5 * smoothed[i + 1] + 0.25 * smoothed[i + 3]
            );
        }
        next.push(smoothed[smoothed.length - 2], smoothed[smoothed.length - 1]);
        smoothed = next;
    }
    return smoothed;
}

export const computeTrianglePoints = (xPeak, yPeak, xBase, yBase) => {
    const dx = xBase - xPeak;
    const dy = yBase - yPeak;
    const h = Math.sqrt(dx * dx + dy * dy);
    if (h === 0) return [xPeak, yPeak, xPeak, yPeak, xPeak, yPeak];
    const b = h / Math.sqrt(3);
    const ux = -dy / h;
    const uy = dx / h;
    const xLeft = xBase + ux * b;
    const yLeft = yBase + uy * b;
    const xRight = xBase - ux * b;
    const yRight = yBase - uy * b;
    return [xPeak, yPeak, xLeft, yLeft, xRight, yRight];
};

export const computeRectanglePoints = (x1, y1, x2, y2) => {
    return [x1, y1, x2, y1, x2, y2, x1, y2];
};

export const computeCircleData = (points) => {
    if (points.length < 4)
        return { x: 0, y: 0, radius: 0 };
    const [x1, y1, x2, y2] = points;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const radius = Math.sqrt(dx * dx + dy * dy);
    return { x_center: x1, y_center: y1, radius };
};

export function getSmallestRectangle(lines, computeCircleDataFn = computeCircleData) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const line of lines) {
        if (line.type === 'circle') {
            const { x_center, y_center, radius } = computeCircleDataFn(line.points);
            const sw = line.strokeWidth || 0;
            minX = Math.min(minX, x_center - radius - sw);
            minY = Math.min(minY, y_center - radius - sw);
            maxX = Math.max(maxX, x_center + radius + sw);
            maxY = Math.max(maxY, y_center + radius + sw);
        } else {
            const sw = line.strokeWidth || 0;
            for (let i = 0; i < line.points.length; i += 2) {
                minX = Math.min(minX, line.points[i] - sw);
                minY = Math.min(minY, line.points[i + 1] - sw);
                maxX = Math.max(maxX, line.points[i] + sw);
                maxY = Math.max(maxY, line.points[i + 1] + sw);
            }
        }
    }
    const padding = 100;
    return {
        x: minX - padding,
        y: minY - padding,
        width: maxX - minX + 2 * padding,
        height: maxY - minY + 2 * padding
    };
}

export const getContrastColor = (hexColor) => {
    if (!hexColor) return 'white';
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? 'black' : 'white';
};
