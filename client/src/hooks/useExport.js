import { useCallback } from "react";
import { jsPDF } from "jspdf";
import Konva from "konva";
import { apiFetch } from "../api";
import { getSmallestRectangle } from "../utils/boardUtils";

function addTempBG(layer, box) {
    const bg = new Konva.Rect({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        fill: '#ffffff',
    });
    layer.add(bg);
    bg.moveToBottom();
    return bg;
}

export default function useExport({ stageRef, linesRef, lines, board, id, shared }) {
    const exportToPng = useCallback(() => {
        if (!lines.length) return;
        const box = getSmallestRectangle(lines);
        const layer = stageRef.current.findOne('.draw-layer');
        const bg = addTempBG(layer, box);
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
        bg.destroy();

        const link = document.createElement('a');
        link.download = `${board?.name || 'board'}.png`;
        link.href = dataUrl;
        link.click();
    }, [lines, board, stageRef]);

    const exportToPDF = useCallback(() => {
        if (!lines.length) return;
        const box = getSmallestRectangle(lines);
        const layer = stageRef.current.findOne('.draw-layer');
        const bg = addTempBG(layer, box);
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
        bg.destroy();

        const orientation = box.width > box.height ? 'landscape' : 'portrait';
        const pdf = new jsPDF(orientation, 'px', [box.width, box.height]);
        pdf.addImage(dataUrl, 'PNG', 0, 0, box.width, box.height);
        pdf.save(`${board?.name || 'board'}.pdf`);
    }, [lines, board, stageRef]);

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

        return stage.toDataURL({
            x: cropX,
            y: cropY,
            width: captureW,
            height: captureH,
            pixelRatio: pixelRatio,
            mimeType: 'image/png',
        });
    }, [stageRef, linesRef]);

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
