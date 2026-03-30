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
const io = new Server(server, {
    cors: { origin: 'http://localhost:5173', credentials: true }
});

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/folders', folderRoutes);

app.get('/api/test', authMiddleware, async (req, res) => {
    const User = require('./models/Users');
    const user = await User.findById(req.userId).select('-passwordHash');
    res.status(200).json({ msg: "Authenticated request successful", user });
});

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