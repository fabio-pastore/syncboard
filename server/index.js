require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const folderRoutes = require('./routes/folders');
const authMiddleware = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const allowedOrigins = process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',')
    : ['http://localhost:5173'];

const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true }
});

const Board = require('./models/Board');
const User = require('./models/Users');

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/api/auth', authRoutes);

app.get('/api/boards/share/:token', authMiddleware, async (req, res) => {
    try {
        const board = await Board.findOne({ 'shareTokens.token': req.params.token });
        if (!board) return res.status(404).json({ error: 'Invalid link' });

        const entry = board.shareTokens.find((s) => s.token === req.params.token);
        res.json({ board, role: entry.role });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.use('/api/boards', boardRoutes);

app.use('/api/folders', folderRoutes);

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connect to MongoDB');
        const PORT = process.env.PORT || 3001;
        server.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });


io.on('connection', (socket) => {
    const {token, shareToken} = socket.handshake.auth;
    let userId = null;
    if (token) {
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.userId;
        } catch (err) {}
    }

    socket.on('board:join', async ({ boardId }) => {
        try {
            let board, role;
            if (shareToken) {
                board = await Board.findOne({ 'shareTokens.token': shareToken });
                if (!board) return socket.emit('error', 'Invalid share token');
                role = board.shareTokens.find(s => s.token === shareToken).role;
            } else if (userId) {
                board = await Board.findOne({
                    _id: boardId,
                    $or: [{ owner: userId }, { 'sharedWith.user': userId }]
                });
                if (!board) return socket.emit('error', 'Board not found');
                const shared = board.sharedWith.find(s => s.user.toString() === userId);
                role = shared ? shared.role : (board.owner.toString() === userId ? 'editor' : 'viewer');
            } else {
                return socket.emit('error', 'Unauthorized');
            }

            const roomId = board._id.toString();
            socket.join(roomId);
            socket.data.boardId = roomId;
            socket.data.role = role;
            socket.data.userId = userId;
            socket.data.isShareToken = !!shareToken;
            socket.data.isOwner = !shareToken && !!userId && board.owner.toString() === userId;
            const joinedUser = await User.findById(userId).select('username');
            if (!joinedUser) return socket.emit('error', 'User not found');
            socket.data.username = joinedUser.username;

            const peerCount = io.sockets.adapter.rooms.get(roomId)?.size || 1;
            const sockets = await io.in(roomId).fetchSockets();
            const connectedPeers = sockets.map((sock) => sock.data.username);

            socket.emit('board:load', { lines: board.content, count: peerCount, connectedPeers: connectedPeers, role: role });
            io.to(roomId).emit('board:peers', {count: peerCount, connectedPeers: connectedPeers});
            
        } catch (err) {
            return socket.emit('error', 'Failed to join board');
        }
    });

    socket.on('board:draw:line', async(line) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:line', line);
        await Board.updateOne({ _id: roomId }, { $pull: { content: { id: line.id } } });
        await Board.updateOne({ _id: roomId }, { $push: { content: line } });
    });

    socket.on('board:draw:tmpline', async(line) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:line', line);
    });

    socket.on('board:draw:erase', async(lineId ) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;
        socket.to(roomId).emit('board:draw:erase', lineId);
        await Board.updateOne({ _id: roomId }, { $pull: { content: { id: lineId } } });
    });

    socket.on('board:draw:undo', async ({ lineId, op, line }) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;

        if (op === 'draw') {
            socket.to(roomId).emit('board:draw:undo', { lineId, op });
            await Board.updateOne({ _id: roomId }, { $pull: { content: { id: lineId } } });
        } else {
            socket.to(roomId).emit('board:draw:undo', { lineId, op, line });
            await Board.updateOne({ _id: roomId }, { $push: { content: line } });
        }
    });

    socket.on('board:draw:redo', async ({ lineId, op, line }) => {
        const roomId = socket.data.boardId;
        if (!roomId || socket.data.role !== 'editor') return;

        if (op === 'draw') {
            socket.to(roomId).emit('board:draw:redo', { lineId, op, line });
            await Board.updateOne({ _id: roomId }, { $push: { content: line } }); 
        } else {
            socket.to(roomId).emit('board:draw:redo', { lineId, op }); 
            await Board.updateOne({ _id: roomId }, { $pull: { content: { id: lineId } } }); 
        }
    });

    socket.on('chat:send', async ({id, username, time, body}) => {
        const roomId = socket.data.boardId;
        if (!roomId) return;
        socket.to(roomId).emit('chat:send', {id: id, username: username, time: time, body: body});
    });

    socket.on('disconnect', async () => {
        const roomId = socket.data.boardId;
        if (!roomId) return;

        if (socket.data.isOwner) {
            // if i quit everyone has to be kicked out
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
        } else if (shareToken) {
            // if i didn't quit someone did so revoke their token
            Board.updateOne({ _id: roomId }, { $pull: { shareTokens: { token: shareToken } } }).catch(() => {});
        }

        const peerCount = io.sockets.adapter.rooms.get(roomId)?.size || 0;
        const sockets = await io.in(roomId).fetchSockets();
        const connectedPeers = sockets.map((sock) => sock.data.username);

        io.to(roomId).emit('board:peers', {count: peerCount, connectedPeers: connectedPeers});
    });

})