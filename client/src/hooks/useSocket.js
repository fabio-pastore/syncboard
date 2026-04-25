import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { apiFetch } from "../api";
import { SOCKET_URL } from "../utils/boardConstants";

export default function useSocket({ id, token, shared }) {
    const [board, setBoard] = useState(null);
    const [lines, setLines] = useState([]);
    const [peers, setPeers] = useState(0);
    const [peerEntries, setPeerEntries] = useState([]);
    const [role, setRole] = useState('editor');
    const [chatMessages, setChatMessages] = useState([]);
    const [error, setError] = useState("");
    const socketRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        async function init() {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            let boardData;
            try {
                if (shared) {
                    boardData = await apiFetch(`/boards/share/${token}`);
                    setRole(boardData.role || 'viewer');
                    setBoard(boardData.board);
                    setLines(boardData.board?.content || []);
                } else {
                    boardData = await apiFetch(`/boards/${id}`);
                    setBoard(boardData);
                    setLines(boardData.content || []);
                }
            } catch (error) {
                console.error("Failed to fetch board data:", error);
                navigate('/');
                return;
            }

            const sock = io(SOCKET_URL, {
                auth: {
                    token: localStorage.getItem("token"),
                    shareToken: shared ? token : null
                },
            });
            socketRef.current = sock;

            sock.on('connect', () => {
                sock.emit('board:join', { boardId: shared ? token : id });
            });

            sock.on('board:load', ({ lines: l, count: c, connectedPeers: peers, role: r }) => {
                setLines(l);
                setPeers(c);
                setPeerEntries(peers);
                if (r) setRole(r);
            });

            sock.on('board:peers', ({count: c, connectedPeers: peers}) => {
                setPeers(c);
                setPeerEntries(peers);
            });

            sock.on('board:draw:line', (line) => {
                setLines((prev) => {
                    const oldLine = prev.find(l => l.id === line.id);
                    if (oldLine) {
                        const updated = [...prev];
                        const index = updated.indexOf(oldLine);
                        updated[index] = line;
                        return updated;
                    }
                    else return [...prev, line];
                });
            });

            sock.on('board:draw:erase', (lineId) => {
                setLines((prev) => prev.filter((l) => l.id !== lineId));
            });

            sock.on('board:draw:undo', (data_payload) => {
                if (!data_payload) return;
                const { lineId, op, line } = data_payload;
                if (op === 'draw') setLines((prev) => prev.filter((l) => l.id !== lineId));
                else setLines((prev) => prev.some(l => l.id === line.id) ? prev : [...prev, line]);
            });

            sock.on('board:draw:redo', (data_payload) => {
                if (!data_payload) return;
                const { lineId, op, line } = data_payload;
                if (op === 'draw') setLines((prev) => prev.some(l => l.id === line.id) ? prev : [...prev, line]);
                else setLines((prev) => prev.filter((l) => l.id !== lineId));
            });

            sock.on('chat:send', (message_data) => {
                if (!message_data) return;
                const { id, username, time, body } = message_data;
                setChatMessages((prev) => [...prev, {type: "other", id: id, username: username, time: time, body: body}]);
            });

            sock.on('error', (message) => {
                console.error("Socket error:", message);
                setError(message);
            });

            sock.on('board:kicked', () => {
                sock.disconnect();
                navigate('/');
            });
        }

        init();
        return () => { socketRef.current?.disconnect(); };
    }, [id, token, shared]);

    return { board, setBoard, lines, setLines, peers, peerEntries, role, setRole, error, setError, socketRef, chatMessages, setChatMessages };
}
