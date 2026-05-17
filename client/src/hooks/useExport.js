import { useCallback } from "react";
import { jsPDF } from "jspdf";
import Konva from "konva";
import { apiFetch } from "../api";
import { getSmallestRectangle } from "../utils/boardUtils";

/**
 * Adds temporary background elements (color and pattern) to a Konva layer.
 * Used during export to ensure drawings have the correct background.
 *
 * @param {Konva.Layer} layer - The Konva layer.
 * @param {object} box - The bounding box {x, y, width, height}.
 * @param {string} bgColor - The background color.
 * @param {string} bgPattern - The background pattern type.
 * @returns {Array} Array of created Konva elements to be destroyed later.
 */
function addTempBGElements(layer, box, bgColor, bgPattern) {
    const tempElements = [];

    if (bgPattern === 'grid') {
        const gridSize = 40;
        const startX = Math.floor(box.x / gridSize) * gridSize;
        for (let x = startX; x <= box.x + box.width; x += gridSize) {
            const line = new Konva.Line({
                points: [x, box.y, x, box.y + box.height],
                stroke: '#d1d5db',
                strokeWidth: 1,
            });
            layer.add(line);
            line.moveToBottom();
            tempElements.push(line);
        }
        const startY = Math.floor(box.y / gridSize) * gridSize;
        for (let y = startY; y <= box.y + box.height; y += gridSize) {
            const line = new Konva.Line({
                points: [box.x, y, box.x + box.width, y],
                stroke: '#d1d5db',
                strokeWidth: 1,
            });
            layer.add(line);
            line.moveToBottom();
            tempElements.push(line);
        }
    } else if (bgPattern === 'lines') {
        const lineSpacing = 40;
        const startY = Math.floor(box.y / lineSpacing) * lineSpacing;
        for (let y = startY; y <= box.y + box.height; y += lineSpacing) {
            const line = new Konva.Line({
                points: [box.x, y, box.x + box.width, y],
                stroke: '#d1d5db',
                strokeWidth: 1,
            });
            layer.add(line);
            line.moveToBottom();
            tempElements.push(line);
        }
    }

    const bgRect = new Konva.Rect({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        fill: bgColor || '#ffffff',
    });
    layer.add(bgRect);
    bgRect.moveToBottom();
    tempElements.push(bgRect);

    return tempElements;
}

/**
 * Manages board export operations (PNG, PDF) and thumbnail generation/saving.
 *
 * Provides callbacks to export the current board content as a PNG or PDF image,
 * capturing only the area containing drawings. Also handles generation of a
 * 4:3 thumbnail image and saving it to the server for dashboard previews.
 *
 * @param {object} params - Hook parameters.
 * @param {React.RefObject} params.stageRef - Ref to the Konva Stage instance.
 * @param {React.MutableRefObject<Array>} params.linesRef - Ref to the current lines array.
 * @param {Array} params.lines - The current lines array (state).
 * @param {object} params.board - The current board data object.
 * @param {string} params.id - The board ID.
 * @param {boolean} params.shared - Whether the board is accessed via a share link.
 * @param {string} params.bgColor - The current background color.
 * @param {string} params.bgPattern - The current background pattern ID.
 * @returns {object} An object containing:
 *   - `exportToPng`: Exports the board as a PNG file.
 *   - `exportToPDF`: Exports the board as a PDF file.
 *   - `saveThumbnail`: Generates and saves a thumbnail to the server.
 */

export default function useExport({ stageRef, linesRef, lines, board, id, shared, bgColor, bgPattern }) {
    /**
     * Exports the current board content as a PNG image file.
     * Triggers a download in the browser. Does nothing if there are no lines to export.
     */
    const exportToPng = useCallback(() => {
        if (!lines.length) return;
        const box = getSmallestRectangle(lines);
        const layer = stageRef.current.findOne('.draw-layer');
        const tempElements = addTempBGElements(layer, box, bgColor, bgPattern);
        
        const oldPos = stageRef.current.position();
        const oldScale = stageRef.current.scale();
        stageRef.current.position({ x: 0, y: 0 });
        stageRef.current.scale({ x: 1, y: 1 });
        const dataUrl = layer.toDataURL({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            pixelRatio: 2,
            mimeType: 'image/jpeg',
        });
        tempElements.forEach(el => el.destroy());

        const link = document.createElement('a');
        link.download = `${board?.name || 'board'}.png`;
        link.href = dataUrl;
        link.click();
        stageRef.current.position(oldPos);
        stageRef.current.scale(oldScale);
    }, [lines, board, stageRef, bgColor, bgPattern]);

    /**
     * Exports the current board content as a PDF file.
     * Uses jsPDF to create the document sized to fit the drawing bounding box.
     * Does nothing if there are no lines to export.
     */
    const exportToPDF = useCallback(() => {
        if (!lines.length) return;
        const box = getSmallestRectangle(lines);
        const layer = stageRef.current.findOne('.draw-layer');
        const tempElements = addTempBGElements(layer, box, bgColor, bgPattern);
        
        const oldPos = stageRef.current.position();
        const oldScale = stageRef.current.scale();
        stageRef.current.position({ x: 0, y: 0 });
        stageRef.current.scale({ x: 1, y: 1 });
        const dataUrl = layer.toDataURL({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            pixelRatio: 2,
            mimeType: 'image/jpeg',
        });
        tempElements.forEach(el => el.destroy());

        const orientation = box.width > box.height ? 'landscape' : 'portrait';
        const pdf = new jsPDF(orientation, 'px', [box.width, box.height]);
        pdf.addImage(dataUrl, 'PNG', 0, 0, box.width, box.height);
        pdf.save(`${board?.name || 'board'}.pdf`);
        stageRef.current.position(oldPos);
        stageRef.current.scale(oldScale);
    }, [lines, board, stageRef, bgColor, bgPattern]);

    /**
     * Generates a thumbnail data URL of the board content.
     * Captures a 4:3 aspect ratio viewport, includes background pattern lines if active.
     *
     * @param {number} [mw=400] - The max width of the thumbnail in pixels.
     * @returns {string|null} The base64 data URL of the thumbnail image, or null if there's no content.
     */
    const generateThumbnail = useCallback((mw = 400) => {
        const stage = stageRef.current;
        if (!stage || !linesRef?.current.length) return null;

        stage.position({ x: 0, y: 0 });
        stage.scale({ x: 1, y: 1 });

        const viewW = stage.width();
        const viewH = stage.height();

        const captureW = Math.min(viewW, viewH * (4 / 3));
        const captureH = captureW * (3 / 4);

        const cropX = (viewW - captureW) / 2;
        const cropY = (viewH - captureH) / 2;

        const pixelRatio = mw / captureW;

        const layer = stage.findOne('.draw-layer');  // temp background
        const tempElements = [];

        if (bgPattern === 'grid') {
            const gridSize = 40;
            for (let x = cropX; x <= cropX + captureW; x += gridSize) {
                const line = new Konva.Line({
                    points: [x, cropY, x, cropY + captureH],
                    stroke: '#d1d5db',
                    strokeWidth: 1,
                });
                layer.add(line);
                line.moveToBottom();
                tempElements.push(line);
            }
            for (let y = cropY; y <= cropY + captureH; y += gridSize) {
                const line = new Konva.Line({
                    points: [cropX, y, cropX + captureW, y],
                    stroke: '#d1d5db',
                    strokeWidth: 1,
                });
                layer.add(line);
                line.moveToBottom();
                tempElements.push(line);
            }
        } else if (bgPattern === 'lines') {
            const lineSpacing = 40;
            for (let y = cropY; y <= cropY + captureH; y += lineSpacing) {
                const line = new Konva.Line({
                    points: [cropX, y, cropX + captureW, y],
                    stroke: '#d1d5db',
                    strokeWidth: 1,
                });
                layer.add(line);
                line.moveToBottom();
                tempElements.push(line);
            }
        }

        // background rect last and move to bottom so it sits below pattern lines
        const bgRect = new Konva.Rect({
            x: cropX,
            y: cropY,
            width: captureW,
            height: captureH,
            fill: bgColor || '#ffffff',
        });
        layer.add(bgRect);
        bgRect.moveToBottom();
        tempElements.push(bgRect);

        const dataUrl = stage.toDataURL({
            x: cropX,
            y: cropY,
            width: captureW,
            height: captureH,
            pixelRatio: pixelRatio,
            mimeType: 'image/png',
        });

        tempElements.forEach(el => el.destroy());

        return dataUrl;
    }, [stageRef, linesRef, bgColor, bgPattern]);

    /**
     * Generates a thumbnail of the board and saves it to the server via API.
     * Only executes if the board has content and is not a shared view.
     */
    const saveThumbnail = useCallback(async () => {
        if (!lines.length || !stageRef.current || shared) return;
        const dataUrl = generateThumbnail(400);
        if (!dataUrl) return;

        try {
            await apiFetch(`/boards/${id}/thumbnail`, {
                method: 'PUT',
                body: JSON.stringify({ thumbnail: dataUrl }),
            });
        } catch (err) {
            console.error("Failed to save thumbnail:", err);
        }
    }, [lines, stageRef, shared, id, generateThumbnail]);

    return { exportToPng, exportToPDF, saveThumbnail };
}
