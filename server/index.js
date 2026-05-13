require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const folderRoutes = require('./routes/folders');
const userRoutes = require('./routes/user');
const searchRoutes = require('./routes/search');
const authMiddleware = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

/**
 * @fileoverview Main server entry point for SyncBoard.
 * Establishes an Express + Socket.io server with MongoDB persistence.
 * Manages real-time collaborative board sessions, cursor broadcasting,
 * and batched database writes for optimal performance.
 */

/**
 * Allowed CORS origins for the server.
 * Loaded from the CLIENT_ORIGIN environment variable, split by commas,
 * with a fallback to the default Vite dev server URL.
 * @type {string[]}
 */
const allowedOrigins = process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',')
    : ['http://localhost:5173'];

const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true }
});

const Board = require('./models/Board');
const BoardLine = require('./models/BoardLine');
const User = require('./models/Users');

// trying to keep stuff in memory as trade-off for bandwidth usage

/** Maps roomId to a Map of socketId -> peer metadata. */

const peerMap = new Map();                  // roomId -> Map<socketId, {username, profilePicture, userId, role, isShareToken, isOwner}> 

/** Maps roomId to a Map of socketId -> cursor state {x, y, username, viewport}. */

const cursorState = new Map();              // roomId -> Map<socketId, {x, y, username, viewport}>

/** Maps roomId to an array of pending database write operations. */

const writeBuffer = new Map();              // roomId -> Array<{action, ...}>

/** Maps roomId to the interval timer for cursor broadcast. */

const cursorBroadcastTimers = new Map();    // roomId -> intervalId

const CURSOR_BROADCAST_INTERVAL = 16;   
const WRITE_FLUSH_INTERVAL = 500;       // batch DB writes every 500 ms
const VIEWPORT_PADDING = 500;           // padding around viewport

/**
 * Encodes an array of cursor updates into a binary buffer for efficient network transfer.
 *
 * Binary format: [count: uint16] per cursor: [idLen: uint8][id: utf8][x: float32][y: float32][nameLen: uint8][name: utf8]
 *
 * @param {Array<object>} updates - Array of {socketId, username, x, y}.
 * @returns {Buffer} The encoded binary buffer.
 */
function encodeCursorBatch(updates) { // encoding cursor in binary to save bandwidth
    const encoded = updates.map(u => {
        const idBuf = Buffer.from(u.socketId, 'utf8');
        const nameBuf = Buffer.from(u.username || '', 'utf8');
        return { ...u, idBuf, nameBuf };
    });

    let totalSize = 2; // uint16 count
    for (const u of encoded) {
        totalSize += 1 + u.idBuf.length + 8 + 1 + u.nameBuf.length;
    }

    const buffer = Buffer.alloc(totalSize);
    let offset = 0;

    buffer.writeUInt16BE(encoded.length, offset);
    offset += 2;

    for (const u of encoded) {
        buffer.writeUInt8(u.idBuf.length, offset);
        offset += 1;
        u.idBuf.copy(buffer, offset);
        offset += u.idBuf.length;

        buffer.writeFloatBE(u.x, offset);
        offset += 4;
        buffer.writeFloatBE(u.y, offset);
        offset += 4;

        buffer.writeUInt8(u.nameBuf.length, offset);
        offset += 1;
        u.nameBuf.copy(buffer, offset);
        offset += u.nameBuf.length;
    }

    return buffer;
}

/**
 * Starts the periodic cursor broadcast timer for a room.
 * Every CURSOR_BROADCAST_INTERVAL ms, sends a binary batch of cursor positions
 * to each connected user, filtering out cursors outside their viewport.
 *
 * @param {string} roomId - The board room ID.
 */
function startCursorBroadcast(roomId) {
    if (cursorBroadcastTimers.has(roomId)) return;

    const timer = setInterval(() => {
        const cursors = cursorState.get(roomId);
        if (!cursors || cursors.size === 0) return;

        for (const [recipientId, recipientData] of cursors) {
            const recipientSocket = io.sockets.sockets.get(recipientId);
            if (!recipientSocket) continue;

            const updates = [];
            for (const [senderId, cursor] of cursors) {
                if (senderId === recipientId) continue;

                // skip cursors far outside the other users view
                const rv = recipientData.viewport;
                if (rv) {
                    if (
                        cursor.x < rv.x1 - VIEWPORT_PADDING ||
                        cursor.x > rv.x2 + VIEWPORT_PADDING ||
                        cursor.y < rv.y1 - VIEWPORT_PADDING ||
                        cursor.y > rv.y2 + VIEWPORT_PADDING
                    ) {
                        continue;
                    }
                }

                updates.push({
                    socketId: senderId,
                    username: cursor.username,
                    x: cursor.x,
                    y: cursor.y,
                });
            }

            if (updates.length > 0) {
                const binary = encodeCursorBatch(updates);
                recipientSocket.emit('board:cursor:batch', binary);
            }
        }
    }, CURSOR_BROADCAST_INTERVAL);

    cursorBroadcastTimers.set(roomId, timer);
}


/**
 * Deduplicates the write buffer by keeping only the latest operation per line ID.
 * Resolves conflicts where multiple writes to the same line occur within a flush cycle.
 *
 * @param {Array<object>} buffer - Array of write operations.
 * @returns {Array<object>} The deduplicated array of operations.
 */
function deduplicateBuffer(buffer) {
    const lineOps = new Map(); // lineId -> last operation

    for (const entry of buffer) {
        switch (entry.action) {
            case 'upsertLine':
                lineOps.set(entry.data.id, { action: 'upsertLine', data: entry.data });
                break;
            case 'deleteLine':
                lineOps.set(entry.lineId, { action: 'deleteLine', lineId: entry.lineId });
                break;
            case 'deleteLines':
                for (const id of entry.lineIds) {
                    lineOps.set(id, { action: 'deleteLine', lineId: id });
                }
                break;
            case 'upsertLines':
            case 'addLines':
                for (const line of entry.lines) {
                    lineOps.set(line.id, { action: 'upsertLine', data: line });
                }
                break;
        }
    }

    return Array.from(lineOps.values());
}

/**
 * Flushes the write buffer for a room, performing a bulk write to MongoDB.
 * Deduplicates operations and uses upsert for line data to ensure consistency.
 *
 * @param {string} roomId - The board room ID.
 * @returns {Promise<void>}
 */
async function flushWriteBuffer(roomId) {
    const raw = writeBuffer.get(roomId);
    if (!raw || raw.length === 0) return;

    writeBuffer.set(roomId, []); // clear

    const ops = deduplicateBuffer(raw);
    if (ops.length === 0) return;

    const bulkOps = [];
    for (const op of ops) {
        if (op.action === 'upsertLine') {
            bulkOps.push({
                updateOne: {
                    filter: { boardId: roomId, lineId: op.data.id },
                    update: { $set: { boardId: roomId, lineId: op.data.id, data: op.data } },
                    upsert: true,
                },
            });
        } else if (op.action === 'deleteLine') {
            bulkOps.push({
                deleteOne: { filter: { boardId: roomId, lineId: op.lineId } },
            });
        }
    }

    if (bulkOps.length > 0) {
        try {
            await BoardLine.bulkWrite(bulkOps, { ordered: false });
        } catch (err) {
            console.error('Flush error for room', roomId, err.message);
        }
    }
}

/**
 * Periodic interval that flushes write buffers for all active rooms.
 */
setInterval(() => {
    for (const [roomId] of writeBuffer) {
        flushWriteBuffer(roomId).catch(() => {});
    }
}, WRITE_FLUSH_INTERVAL);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

/**
 * Calculates unique connected peers to avoid duplicate tab counting.
 * Groups by userId if available, otherwise treats sockets as unique guests.
 */
function getUniquePeers(roomId) {
    const peers = peerMap.get(roomId);
    if (!peers) return { count: 0, connectedPeers: [] };

    const uniqueUsers = new Map();
    const guestPeers = [];

    for (const peer of peers.values()) {
        if (peer.userId) {
            // This ensures a user with 5 tabs only gets added to this Map once
            uniqueUsers.set(peer.userId.toString(), {
                username: peer.username,
                pfp: peer.profilePicture
            });
        } else {
            // Fallback for share token guests without accounts
            guestPeers.push({
                username: peer.username,
                pfp: peer.profilePicture
            });
        }
    }

    const connectedPeers = [...uniqueUsers.values(), ...guestPeers];
    return {
        count: connectedPeers.length,
        connectedPeers
    };
}

/**
 * Middleware to attach the Socket.io instance to every request object.
 */
app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/api/auth', authRoutes);

/**
 * GET /api/boards/share/:token
 * Fetches a shared board by its access token, including the assigned role and full content.
 */
app.get('/api/boards/share/:token', authMiddleware, async (req, res) => {
    try {
        const board = await Board.findOne({ 'shareTokens.token': req.params.token });
        if (!board) return res.status(404).json({ error: 'Invalid link' });

        const entry = board.shareTokens.find((s) => s.token === req.params.token);

        const lineDocs = await BoardLine.find({ boardId: board._id }).lean();
        const boardObj = board.toObject();
        boardObj.content = lineDocs.map((doc) => doc.data);

        res.json({ board: boardObj, role: entry.role });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.use('/api/boards', boardRoutes);
app.use('/api/user', userRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/search', searchRoutes);

/**
 * Connects to MongoDB and starts the HTTP server on the configured port.
 */
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Successfully connected to MongoDB database');
        const PORT = process.env.PORT || 3001;
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });


io.on('connection', (socket) => {
    const { token, shareToken } = socket.handshake.auth;
    let userId = null;
    if (token) {
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.userId;
        } catch (err) { /** invalid token */ }
    }

    /**
     * Handles a client joining a board room.
     * Verifies access (owner, shared with, or share token), joins the Socket.io room,
     * loads board data and active lines from the database, and notifies all peers.
     *
     * @param {object} payload - The join payload.
     * @param {string} payload.boardId - The ID of the board to join.
     */
    socket.on('board:join', async ({ boardId }) => {
        try {
            let board, role;
            if (shareToken) {
                board = await Board.findOne({ 'shareTokens.token': shareToken });
                if (!board) return socket.emit('error', 'Invalid share token');
                role = board.shareTokens.find((s) => s.token === shareToken).role;
            } else if (userId) {
                board = await Board.findOne({
                    _id: boardId,
                    $or: [{ owner: userId }, { 'sharedWith.user': userId }],
                });
                if (!board) return socket.emit('error', 'Board not found');
                const shared = board.sharedWith.find((s) => s.user.toString() === userId);
                role = shared ? shared.role : board.owner.toString() === userId ? 'editor' : 'viewer';
            } else {
                return socket.emit('error', 'Unauthorized');
            }

            const bgType = board.bgType;
            const bgColor = board.bgColor;

            const roomId = board._id.toString();
            socket.join(roomId);
            socket.data.boardId = roomId;
            socket.data.role = role;
            socket.data.userId = userId;
            socket.data.isShareToken = !!shareToken;
            socket.data.isOwner = !shareToken && !!userId && board.owner.toString() === userId;

            const joinedUser = await User.findById(userId).select('username profileImage');
            if (!joinedUser) return socket.emit('error', 'User not found');
            socket.data.username = joinedUser.username;
            socket.data.profilePicture = joinedUser.profileImage;

            // keeping track in memory
            if (!peerMap.has(roomId)) peerMap.set(roomId, new Map());
            const roomPeers = peerMap.get(roomId);

            roomPeers.set(socket.id, {
                username: joinedUser.username,
                profilePicture: joinedUser.profileImage,
                userId,
                role,
                isShareToken: !!shareToken,
                isOwner: !shareToken && !!userId && board.owner.toString() === userId,
            });

            if (!cursorState.has(roomId)) cursorState.set(roomId, new Map());
            startCursorBroadcast(roomId);

            let lineDocs = await BoardLine.find({ boardId: roomId }).lean();
            if (lineDocs.length === 0 && board.content && board.content.length > 0) {
                const bulkOps = board.content.map((line) => ({
                    updateOne: {
                        filter: { boardId: roomId, lineId: line.id },
                        update: { $set: { boardId: roomId, lineId: line.id, data: line } },
                        upsert: true,
                    },
                }));
                await BoardLine.bulkWrite(bulkOps, { ordered: false });
                await Board.updateOne({ _id: roomId }, { $set: { content: [] } });
                lineDocs = await BoardLine.find({ boardId: roomId }).lean();
            }

            const lines = lineDocs.map((doc) => doc.data);

            const { count: peerCount, connectedPeers } = getUniquePeers(roomId);

            socket.emit('board:load', { lines, count: peerCount, connectedPeers, role, bgType: bgType, bgColor: bgColor });
            io.to(roomId).emit('board:peers', { count: peerCount, connectedPeers });
        } catch (err) {
            console.error('board:join error:', err);
            return socket.emit('error', 'Failed to join board');
        }
    });

    /**
     * Receives a cursor position update from a client and stores it in memory.
     */
    socket.on('board:cursor:move', ({ x, y, viewport }) => {
        const roomId = socket.data.boardId;
        if (!roomId) return;
        const cursors = cursorState.get(roomId);
        if (!cursors) return;
        // made this just save in memory the position of the cursor
        cursors.set(socket.id, {
            x,
            y,
            username: socket.data.username,
            viewport: viewport || null,
        });
    });

    /**
     * Handles background type/color changes from an editor.
     * Broadcasts the change to all other peers and persists it to the database.
     */
    socket.on('board:bg:modify', async ({ newType, newColor }) => { 
        if (!newType && !newColor) return;
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:bg:modify', { newType, newColor });
        
        const updateData = {};
        if (newType !== null && newType !== undefined) {
            updateData.bgType = newType;
        }
        if (newColor !== null && newColor !== undefined) {
            updateData.bgColor = newColor;
        }

        try {
            await Board.findByIdAndUpdate(
                roomId, 
                { $set: updateData }
            );
        } catch (err) {
            console.error("Failed to save background information", error);
        }
    });

    /**
     * Handles a completed drawing line from an editor.
     * Broadcasts to all peers and queues a write to the database.
     */
    socket.on('board:draw:line', (line) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:line', line);

        if (!writeBuffer.has(roomId)) writeBuffer.set(roomId, []);
        writeBuffer.get(roomId).push({ action: 'upsertLine', data: line });
    });

    /**
     * Handles a temporary (in-progress) line update from an editor.
     * Broadcasts to all peers but does not persist to the database.
     */
    socket.on('board:draw:tmpline', (lineData) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:tmpline', lineData);
    });

    /**
     * Handles erasing a single line from an editor.
     * Broadcasts to all peers and queues a delete in the database.
     */
    socket.on('board:draw:erase', (lineId) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:erase', lineId);

        if (!writeBuffer.has(roomId)) writeBuffer.set(roomId, []);
        writeBuffer.get(roomId).push({ action: 'deleteLine', lineId });
    });

    /**
     * Handles a selection modification (color, width, opacity) from an editor.
     * Broadcasts the updated lines to all peers and queues a database write.
     */
    socket.on('board:draw:modify_selection', (modifiedLines) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:modify_selection', modifiedLines);

        if (!writeBuffer.has(roomId)) writeBuffer.set(roomId, []);
        writeBuffer.get(roomId).push({ action: 'upsertLines', lines: modifiedLines });
    });

    /**
     * Handles temporary drag updates from an editor for collaborative preview.
     */
    socket.on('board:draw:tmpdrag', (draggedLines) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:group_drag', draggedLines);
    });

    /**
     * Handles temporary rotation updates from an editor for collaborative preview.
     */
    socket.on('board:draw:tmprotate', (rotatedLines) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:group_rotate', rotatedLines);
    });

    /**
     * Handles temporary resize updates from an editor for collaborative preview.
     */
    socket.on('board:draw:tmpresize', (resizedLines) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:group_resize', resizedLines);
    });

    /**
     * Handles a completed group drag from an editor.
     * Broadcasts the final positions to all peers and queues a database write.
     */
    socket.on('board:draw:group_drag', (draggedLines) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:group_drag', draggedLines);

        if (!writeBuffer.has(roomId)) writeBuffer.set(roomId, []);
        writeBuffer.get(roomId).push({ action: 'upsertLines', lines: draggedLines });
    });

    /**
     * Handles a completed group rotation from an editor.
     * Broadcasts the final angles to all peers and queues a database write.
     */
    socket.on('board:draw:group_rotate', (rotatedLines) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:group_rotate', rotatedLines);

        if (!writeBuffer.has(roomId)) writeBuffer.set(roomId, []);
        writeBuffer.get(roomId).push({ action: 'upsertLines', lines: rotatedLines });
    });

    /**
     * Handles a completed group resize from an editor.
     * Broadcasts the final dimensions to all peers and queues a database write.
     */
    socket.on('board:draw:group_resize', (resizedLines) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:group_resize', resizedLines);

        if (!writeBuffer.has(roomId)) writeBuffer.set(roomId, []);
        writeBuffer.get(roomId).push({ action: 'upsertLines', lines: resizedLines });
    });

    /**
     * Handles erasing multiple selected lines from an editor.
     * Broadcasts the erased IDs to all peers and queues database deletes.
     */
    socket.on('board:draw:group_erase', (erasedIds) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:group_erase', erasedIds);

        if (!writeBuffer.has(roomId)) writeBuffer.set(roomId, []);
        writeBuffer.get(roomId).push({ action: 'deleteLines', lineIds: erasedIds });
    });

    /**
     * Handles a paste operation from an editor.
     * Broadcasts the new lines to all peers and queues database inserts.
     */
    socket.on('board:draw:paste', (linesToAdd) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:paste', linesToAdd);

        if (!writeBuffer.has(roomId)) writeBuffer.set(roomId, []);
        writeBuffer.get(roomId).push({ action: 'addLines', lines: linesToAdd });
    });

    /**
     * Handles an undo operation from an editor.
     * Broadcasts the undo to all peers and queues the necessary database operations
     * to reverse the most recent edit.
     */
    socket.on('board:draw:undo', ({ lineId, op, line }) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;

        if (!writeBuffer.has(roomId)) writeBuffer.set(roomId, []);
        const buffer = writeBuffer.get(roomId);

        if (op === 'draw') {
            socket.to(roomId).emit('board:draw:undo', { lineId, op });
            buffer.push({ action: 'deleteLine', lineId });
        } else if (op === 'rotate' || op === 'drag' || op === 'resize' || op === 'modify_selection') {
            socket.to(roomId).emit('board:draw:undo', { op, line });
            if (!line) return;
            const prevLines = line.map((entry) => entry.prev_line);
            const newLineIds = line.map((entry) => entry.new_line.id);
            buffer.push({ action: 'deleteLines', lineIds: newLineIds });
            buffer.push({ action: 'upsertLines', lines: prevLines });
        } else if (op === 'group_erase') {
            socket.to(roomId).emit('board:draw:undo', { op, line });
            if (!line) return;
            buffer.push({ action: 'addLines', lines: line });
        } else if (op === 'paste') {
            socket.to(roomId).emit('board:draw:undo', { op, line });
            if (!line) return;
            const linesToRemoveIds = line.map((l) => l.id);
            buffer.push({ action: 'deleteLines', lineIds: linesToRemoveIds });
        } else {
            socket.to(roomId).emit('board:draw:undo', { lineId, op, line });
            buffer.push({ action: 'upsertLine', data: line });
        }
    });

    /**
     * Handles a redo operation from an editor.
     * Broadcasts the redo to all peers and queues the necessary database operations
     * to re-apply the most recently undone edit.
     */
    socket.on('board:draw:redo', ({ lineId, op, line }) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;

        if (!writeBuffer.has(roomId)) writeBuffer.set(roomId, []);
        const buffer = writeBuffer.get(roomId);

        if (op === 'draw') {
            socket.to(roomId).emit('board:draw:redo', { lineId, op, line });
            buffer.push({ action: 'upsertLine', data: line });
        } else if (op === 'rotate' || op === 'drag' || op === 'resize' || op === 'modify_selection') {
            socket.to(roomId).emit('board:draw:redo', { op, line });
            if (!line) return;
            const oldLineIds = line.map((entry) => entry.prev_line.id);
            const newLines = line.map((entry) => entry.new_line);
            buffer.push({ action: 'deleteLines', lineIds: oldLineIds });
            buffer.push({ action: 'upsertLines', lines: newLines });
        } else if (op === 'group_erase') {
            socket.to(roomId).emit('board:draw:redo', { op, line });
            if (!line) return;
            const lineIds = line.map((l) => l.id);
            buffer.push({ action: 'deleteLines', lineIds });
        } else if (op === 'paste') {
            socket.to(roomId).emit('board:draw:redo', { op, line });
            if (!line) return;
            buffer.push({ action: 'addLines', lines: line });
        } else {
            socket.to(roomId).emit('board:draw:redo', { lineId, op });
            buffer.push({ action: 'deleteLine', lineId });
        }
    });

    /**
     * Handles a chat message from a user.
     * Broadcasts the message to all other peers in the room.
     */
    socket.on('chat:send', ({ id, username, time, body }) => {
        const roomId = socket.data.boardId;
        if (!roomId) return;
        socket.to(roomId).emit('chat:send', { id, username, time, body });
    });

    /**
     * Handles a client disconnecting from the server.
     * Cleans up the peer map, cursor state, and notifies remaining peers.
     * If the board owner disconnects and no other owner instance remains,
     * kicks all users connected via share tokens and revokes all share links.
     */
    socket.on('disconnect', async () => {
        const roomId = socket.data.boardId;
        if (!roomId) return;

        const cursors = cursorState.get(roomId);
        if (cursors) cursors.delete(socket.id);

        socket.to(roomId).emit('board:cursor:leave', { socketId: socket.id });

        const peers = peerMap.get(roomId);
        const disconnectedPeer = peers?.get(socket.id);
        if (peers) peers.delete(socket.id);

        if (socket.data.isOwner) {
            const remainingPeers = Array.from(peers?.values() || []);
            const isOwnerStillPresent = remainingPeers.some(p => p.isOwner); // we must check since owner may have duplicated tab and closed original one

            if (!isOwnerStillPresent) {
                // if owner left then we kick all users that joined with a shared link
                const room = io.sockets.adapter.rooms.get(roomId);
                if (room) {
                    for (const sid of room) {
                        const s = io.sockets.sockets.get(sid);
                        if (s && s.data.isShareToken) {
                            s.emit('board:kicked', 'Owner left the board');
                            s.disconnect(true);
                        }
                    }
                }
                Board.updateOne({ _id: roomId }, { $set: { shareTokens: [] } }).catch(() => {});
            }
        } else if (shareToken) {
            Board.updateOne({ _id: roomId }, { $pull: { shareTokens: { token: shareToken } } }).catch(() => {});
        }

        const remainingPeersMap = peerMap.get(roomId);
        const activeSocketsCount = remainingPeersMap ? remainingPeersMap.size : 0;
        const { count: peerCount, connectedPeers } = getUniquePeers(roomId);

        io.to(roomId).emit('board:peers', { count: peerCount, connectedPeers });

        if (activeSocketsCount === 0) {
            await flushWriteBuffer(roomId); // persist remaining writes
            peerMap.delete(roomId);
            cursorState.delete(roomId);
            writeBuffer.delete(roomId);
            const cursorTimer = cursorBroadcastTimers.get(roomId);
            if (cursorTimer) {
                clearInterval(cursorTimer);
                cursorBroadcastTimers.delete(roomId);
            }
        }
    });
});