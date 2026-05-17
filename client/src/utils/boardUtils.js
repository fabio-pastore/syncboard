import { HANDLE_BOTTOM, HANDLE_BOTTOM_LEFT, HANDLE_BOTTOM_RIGHT, HANDLE_LEFT,
         HANDLE_RIGHT, HANDLE_TOP, HANDLE_TOP_LEFT, HANDLE_TOP_RIGHT } from "../utils/boardConstants";

/**
 * Converts a hex color and opacity value to an rgba string.
 *
 * @param {string} hex - The hex color string (e.g., '#ff0000').
 * @param {number} opacity - The opacity value between 0 and 1.
 * @returns {string} An rgba color string (e.g., 'rgba(255, 0, 0, 0.5)').
 */         
export const hexToRgba = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Converts an rgba or hex color string to a 6-digit hex string.
 * Returns undefined if conversion fails.
 *
 * @param {string} colorStr - The color string (hex or rgba).
 * @returns {string|undefined} The 6-digit hex string, or undefined.
 */
export const RgbaToHex = (colorStr) => {
    if (!colorStr) return undefined;
    
    if (colorStr.startsWith('#')) {
        if (colorStr.length === 4) {
            return '#' + colorStr[1]+colorStr[1] + colorStr[2]+colorStr[2] + colorStr[3]+colorStr[3];
        }
        return colorStr.slice(0, 7); 
    }
    
    const match = colorStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
        const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
        const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
        const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }
    
    return undefined; // in case conversion fails
};

/**
 * Calculates the relative luminance of a hex color.
 * Values > 128 are considered "light", values < 128 are "dark".
 *
 * @param {string} hex - The hex color string (e.g., '#ffffff').
 * @returns {number} The luminance value (0-255).
 */
export const calculateLuminosity = (hex) => { 
    if (!hex) return;

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const R_COEFF = 0.299
    const G_COEFF = 0.587
    const B_COEFF = 0.114
    
    // NOTE: if returned value is > 128 then color is to be considered light, if < 128 then it is dark
    return (R_COEFF * r + G_COEFF * g + B_COEFF * b); 
}

/**
 * Smooths a polyline by averaging adjacent points over a specified number of iterations.
 * Uses 4-point averaging for interior points, leaving endpoints fixed.
 *
 * @param {Array<number>} pts - The flat array of points [x1, y1, x2, y2, ...].
 * @param {number} [iterations=2] - The number of smoothing passes.
 * @returns {Array<number>} The smoothed flat point array.
 */
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

/**
 * Computes the three vertices of an equilateral triangle given a peak and a base reference point.
 *
 * @param {number} xPeak - X coordinate of the triangle peak.
 * @param {number} yPeak - Y coordinate of the triangle peak.
 * @param {number} xBase - X coordinate of the base reference point.
 * @param {number} yBase - Y coordinate of the base reference point.
 * @returns {Array<number>} Flat array [peakX, peakY, leftX, leftY, rightX, rightY].
 */
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

/**
 * Computes the four corners of a rectangle from two opposite corners.
 *
 * @param {number} x1 - X coordinate of the first corner.
 * @param {number} y1 - Y coordinate of the first corner.
 * @param {number} x2 - X coordinate of the opposite corner.
 * @param {number} y2 - Y coordinate of the opposite corner.
 * @returns {Array<number>} Flat array [x1, y1, x2, y1, x2, y2, x1, y2].
 */
export const computeRectanglePoints = (x1, y1, x2, y2) => {
    return [x1, y1, x2, y1, x2, y2, x1, y2];
};

/**
 * Extracts the center and radius of a circle from its point data.
 *
 * @param {Array<number>} points - Flat array [cx, cy, edgeX, edgeY] where (cx, cy) is the center.
 * @returns {object} An object with `x_center`, `y_center`, and `radius` properties.
 */
export const computeCircleData = (points) => {
    if (points.length < 4)
        return { x: 0, y: 0, radius: 0 };
    const [x1, y1, x2, y2] = points;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const radius = Math.sqrt(dx * dx + dy * dy);
    return { x_center: x1, y_center: y1, radius };
};

/**
 * Calculates the axis-aligned bounding box that minimally encloses all given lines.
 *
 * @param {Array} lines - Array of line objects.
 * @param {function} [computeCircleDataFn=computeCircleData] - Function to compute circle data.
 * @returns {object} The bounding box {x, y, width, height} with padding.
 */
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

/**
 * Determines whether black or white provides better contrast against a given hex color.
 *
 * @param {string} hexColor - The background hex color.
 * @returns {string} 'black' or 'white'.
 */
export const getContrastColor = (hexColor) => {
    if (!hexColor) return 'white';
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? 'black' : 'white';
};

/**
 * Tests if a point is inside a polygon using a ray-casting algorithm.
 *
 * @param {number} x - X coordinate of the point.
 * @param {number} y - Y coordinate of the point.
 * @param {Array<number>} polygon - Flat array of polygon vertices [x1, y1, x2, y2, ...].
 * @returns {boolean} True if the point is inside the polygon.
 */
export function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) {
        const xi = polygon[i], yi = polygon[i + 1];
        const xj = polygon[j], yj = polygon[j + 1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside; // this check was blessed by Tutankhamon in 1320 B.C.
    }
    return inside;
}

/**
 * Tests if two line segments intersect.
 *
 * @param {number} ax1 - Start X of segment A.
 * @param {number} ay1 - Start Y of segment A.
 * @param {number} ax2 - End X of segment A.
 * @param {number} ay2 - End Y of segment A.
 * @param {number} bx1 - Start X of segment B.
 * @param {number} by1 - Start Y of segment B.
 * @param {number} bx2 - End X of segment B.
 * @param {number} by2 - End Y of segment B.
 * @returns {boolean} True if the segments intersect.
 */
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

/**
 * Tests if a line segment intersects a circle.
 *
 * @param {number} x1 - Start X of the segment.
 * @param {number} y1 - Start Y of the segment.
 * @param {number} x2 - End X of the segment.
 * @param {number} y2 - End Y of the segment.
 * @param {number} cx - Center X of the circle.
 * @param {number} cy - Center Y of the circle.
 * @param {number} r - Radius of the circle.
 * @returns {boolean} True if the segment intersects the circle.
 */

export function segmentIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const a = dx * dx + dy * dy;
    
    if (a === 0) return (x1 - cx) * (x1 - cx) + (y1 - cy) * (y1 - cy) <= r * r;
    
    
    const b = 2 * (dx * (x1 - cx) + dy * (y1 - cy));
    const c = (x1 - cx) * (x1 - cx) + (y1 - cy) * (y1 - cy) - r * r;
    const det = b * b - 4 * a * c;
    
    if (det < 0) return false;
    
    const t1 = (-b + Math.sqrt(det)) / (2 * a);
    const t2 = (-b - Math.sqrt(det)) / (2 * a);
    
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

/**
 * Tests if a line or circle intersects with or is contained within a polygon.
 * Used for lasso selection to determine which shapes to select.
 *
 * @param {object} line - The line or circle object to test.
 * @param {Array<number>} polygon - The lasso polygon as a flat array of vertices.
 * @returns {boolean} True if the shape intersects or is inside the polygon.
 */
export function lineIntersectsOrInsidePolygon(line, polygon) {
    if (line.type === 'circle') {
        const { x_center, y_center, radius } = computeCircleData(line.points);
        
        if (pointInPolygon(x_center, y_center, polygon)) return true;
        
        for (let i = 0; i < polygon.length; i += 2) {
            const dx = polygon[i] - x_center;
            const dy = polygon[i + 1] - y_center;
            if (dx * dx + dy * dy <= radius * radius) return true;
        }
        
        for (let j = 0; j < polygon.length; j += 2) {
            const nj = (j + 2) % polygon.length;
            if (segmentIntersectsCircle(polygon[j], polygon[j + 1], polygon[nj], polygon[nj + 1], x_center, y_center, radius)) {
                return true;
            }
        }
        return false;
    }
    else {
        for (let i = 0; i < line.points.length; i += 2) {
            if (pointInPolygon(line.points[i], line.points[i + 1], polygon)) return true;
        }

        if (line.closed) {
            for (let j = 0; j < polygon.length; j += 2) {
                if (pointInPolygon(polygon[j], polygon[j + 1], line.points)) return true;
            }
        }

        const len = line.points.length;
        const segmentsCount = line.closed ? len : len - 2; 
        
        for (let i = 0; i < segmentsCount; i += 2) {
            const p1x = line.points[i];
            const p1y = line.points[i + 1];
            const p2x = line.points[(i + 2) % len];
            const p2y = line.points[(i + 3) % len];
            
            for (let j = 0; j < polygon.length; j += 2) {
                const nj = (j + 2) % polygon.length;
                if (segmentsIntersect(p1x, p1y, p2x, p2y, polygon[j], polygon[j + 1], polygon[nj], polygon[nj + 1])) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Computes the axis-aligned bounding box for a set of lines, accounting for rotation and offsets.
 * Used to display the selection box around selected shapes.
 *
 * @param {Array} lines - Array of selected line objects.
 * @returns {object} The bounding box {x, y, width, height} with padding.
 */
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

/**
 * Translates all points in a flat point array by the specified delta.
 *
 * @param {Array<number>} points - Flat array [x1, y1, x2, y2, ...].
 * @param {number} dx - Horizontal translation.
 * @param {number} dy - Vertical translation.
 * @returns {Array<number>} The translated flat point array.
 */
export function translatePoints(points, dx, dy) {
    const result = new Array(points.length);
    for (let i = 0; i < points.length; i += 2) {
        result[i] = points[i] + dx;
        result[i + 1] = points[i + 1] + dy;
    }
    return result;
}

/**
 * Rotates a point around a given center by a specified angle.
 *
 * @param {number} px - X coordinate of the point.
 * @param {number} py - Y coordinate of the point.
 * @param {number} cx - X coordinate of the rotation center.
 * @param {number} cy - Y coordinate of the rotation center.
 * @param {number} angleDeg - The rotation angle in degrees.
 * @returns {object} The rotated point {x, y}.
 */
export function rotatePoint (px, py, cx, cy, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = px - cx;
    const dy = py - cy;
    return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos
    };
};


/**
 * Determines the appropriate CSS cursor for a resize handle based on its position
 * and the current rotation of the selection box.
 *
 * @param {string} handleId - The handle identifier (e.g., 'top-left', 'bottom').
 * @param {number} boxRot - The rotation angle of the selection box in degrees.
 * @returns {string} The CSS cursor value (e.g., 'nwse-resize', 'ew-resize').
 */
export function getDynamicCursor(handleId, boxRot) {
    
        const baseAngles = {
            [HANDLE_RIGHT]: 0,
            [HANDLE_BOTTOM_RIGHT]: 45,
            [HANDLE_BOTTOM]: 90,
            [HANDLE_BOTTOM_LEFT]: 135,
            [HANDLE_LEFT]: 180,
            [HANDLE_TOP_LEFT]: 225,
            [HANDLE_TOP]: 270,
            [HANDLE_TOP_RIGHT]: 315
        };

        let angle = (baseAngles[handleId] + (boxRot || 0)) % 360;
        if (angle < 0) angle += 360;

        if (angle >= 337.5 || angle < 22.5) return 'ew-resize';
        if (angle >= 22.5 && angle < 67.5) return 'nwse-resize';
        if (angle >= 67.5 && angle < 112.5) return 'ns-resize';
        if (angle >= 112.5 && angle < 157.5) return 'nesw-resize';
        if (angle >= 157.5 && angle < 202.5) return 'ew-resize';
        if (angle >= 202.5 && angle < 247.5) return 'nwse-resize';
        if (angle >= 247.5 && angle < 292.5) return 'ns-resize';
        if (angle >= 292.5 && angle < 337.5) return 'nesw-resize';
        
        return 'default';
    };

/**
 * A: why did i decide to encode it | F: can't be good if you're the one who made this are asking that... 
 * Format: [count: uint16] per cursor: [idLen: uint8][id: utf8][x: float32][y: float32][nameLen: uint8][name: utf8]
 */
/**
 * Decodes a binary buffer containing batched cursor position updates.
 *
 * Format: [count: uint16] per cursor: [idLen: uint8][id: utf8][x: float32][y: float32][nameLen: uint8][name: utf8]
 *
 * @param {ArrayBuffer|Buffer} buffer - The binary buffer to decode.
 * @returns {Array<object>} An array of cursor update objects: { socketId, x, y, username }.
 */
export function decodeCursorBatch(buffer) {
    const view = new DataView(buffer);
    let offset = 0;

    const count = view.getUint16(offset);
    offset += 2;

    const updates = [];
    for (let i = 0; i < count; i++) {
        const socketIdLen = view.getUint8(offset);
        offset += 1;
        const socketId = new TextDecoder().decode(new Uint8Array(buffer, offset, socketIdLen));
        offset += socketIdLen;

        const x = view.getFloat32(offset);
        offset += 4;
        const y = view.getFloat32(offset);
        offset += 4;

        const usernameLen = view.getUint8(offset);
        offset += 1;
        const username = new TextDecoder().decode(new Uint8Array(buffer, offset, usernameLen));
        offset += usernameLen;

        updates.push({ socketId, x, y, username });
    }

    return updates;
}
