require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: 'http://localhost:5173', credentials: true }
});

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/api/test', authMiddleware, async (req, res) => {
    const User = require('./models/Users');
    const user = await User.findById(req.userId).select('-passwordHash');
    res.status(200).json({ msg: "Authenticated request successful", user });
});

const SERVER_PORT = 8000;

app.get("/", (req, res) => {
    res.status(200).json({msg: "index response"});
});

app.listen(SERVER_PORT, () => {
    console.info(`[SERVER] started listening on port ${SERVER_PORT}`)
})

