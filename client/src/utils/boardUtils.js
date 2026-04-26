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

export function getSmallestRectangle(lines, computeCircleDataFn = computeCircleData) { // parameter passing cursed by Tutankhamon in 1320 B.C.
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

export function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) {
        const xi = polygon[i], yi = polygon[i + 1];
        const xj = polygon[j], yj = polygon[j + 1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside; // this check was blessed by Tutankhamon in 1320 B.C.
    }
    return inside;
}

export function segmentsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    const d1x = ax2 - ax1, d1y = ay2 - ay1;
    const d2x = bx2 - bx1, d2y = by2 - by1;
    const inters = d1x * d2y - d1y * d2x;
    if (inters === 0) return false;
    const dx = bx1 - ax1, dy = by1 - ay1;
    const t = (dx * d2y - dy * d2x) / inters;
    const u = (dx * d1y - dy * d1x) / inters;
    return (t >= 0 && t <= 1 && u >= 0 && u <= 1);
}

export function lineIntersectsOrInsidePolygon(line, polygon) {
    if (line.type === 'circle') {
        const { x_center, y_center, radius } = computeCircleData(line.points);
        for (let i = 0; i < 16; i++) {
            const angle = (2 * Math.PI * i) / 16;
            if (pointInPolygon(x_center + radius * Math.cos(angle), y_center + radius * Math.sin(angle), polygon)) return true;
        }
        if (pointInPolygon(x_center, y_center, polygon)) return true;
    }
    else {
        for (let i = 0; i < line.points.length; i+=2) {
            if (pointInPolygon(line.points[i], line.points[i + 1], polygon)) return true;
        }

        for (let i = 0; i < line.points.length - 2; i += 2) {
            for (let j = 0; j < polygon.length; j += 2) {
                const nj = (j + 2) % polygon.length;
                if (segmentsIntersect(line.points[i], line.points[i + 1], line.points[i + 2], line.points[i + 3], polygon[j], polygon[j + 1], polygon[nj], polygon[nj + 1])) return true;
            }
        }
        
    }
    return false;
}

export function computeSelectionBBox(lines) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; // just js things

    const rotatePoint = (px, py, originX, originY, angleDeg) => {
        if (!angleDeg) return { x: px, y: py };
        const rad = (angleDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const dx = px - originX;
        const dy = py - originY;
        
        return {
            x: cos * dx - sin * dy + originX,
            y: sin * dx + cos * dy + originY
        };
    };

    for (const line of lines) {
        const rot = line.rotation || 0;
        const originX = line.offsetX || 0;
        const originY = line.offsetY || 0;
        
        const shiftX = (line.x || 0) - originX;
        const shiftY = (line.y || 0) - originY;

        if (line.type === 'circle') {
            const { x_center, y_center, radius } = computeCircleData(line.points);
            const sw = line.strokeWidth || 0;
            
            const rotatedCenter = rotatePoint(x_center, y_center, originX, originY, rot);
            const finalCX = rotatedCenter.x + shiftX;
            const finalCY = rotatedCenter.y + shiftY;

            minX = Math.min(minX, finalCX - radius - sw);
            minY = Math.min(minY, finalCY - radius - sw);
            maxX = Math.max(maxX, finalCX + radius + sw);
            maxY = Math.max(maxY, finalCY + radius + sw);
            
        } else {
            const sw = line.strokeWidth || 0;
            for (let i = 0; i < line.points.length; i += 2) {
                const px = line.points[i];
                const py = line.points[i + 1];
                
                const rotated = rotatePoint(px, py, originX, originY, rot);
                const finalX = rotated.x + shiftX;
                const finalY = rotated.y + shiftY;

                minX = Math.min(minX, finalX - sw);
                minY = Math.min(minY, finalY - sw);
                maxX = Math.max(maxX, finalX + sw);
                maxY = Math.max(maxY, finalY + sw);
            }
        }
    }

    const padding = 10;
    return {
        x: minX - padding,
        y: minY - padding,
        width: maxX - minX + 2 * padding,
        height: maxY - minY + 2 * padding
    };
}

export function translatePoints(points, dx, dy) {
    const result = new Array(points.length);
    for (let i = 0; i < points.length; i += 2) {
        result[i] = points[i] + dx;
        result[i + 1] = points[i + 1] + dy;
    }
    return result;
}