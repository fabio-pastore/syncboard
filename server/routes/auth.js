const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/Users.js');

const router = express.Router();
const SALT_ROUNDS = 10;

router.post('/signup', async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if (!email || !username || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters long" });
        }

        const existing = await User.findOne({ $or: [{ email }, { username }] });
        if (existing) {
            return res.status(400).json({ error: "Email or username already in use" });
        }
        
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await User.create({ email, username, passwordHash });

        // create token to be returned to user on log-in for authentication
        const token = jwt.sign({ userId: user._id}, process.env.JWT_SECRET, { expiresIn: '7d'});

        // send response
        res.status(200).json({
            token,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
            }
        })
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({error: "Internal server error" });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body; 
        if (!identifier || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const user = await User.findOne({ $or: [{email: identifier}, {username: identifier}]});
        if (!user) {
            return res.status(401).json({ error: "Incorrect username or password" })
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: "Incorrect username or password" })
        }

        const token = jwt.sign({ userId: user._id}, process.env.JWT_SECRET, { expiresIn: '7d'});

        res.status(200).json({
            token,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
            }
        })
    } catch(err) {
        console.error("Login error:", err);
        res.status(500).json({error: "Internal server error" });
    }
});

module.exports = router;