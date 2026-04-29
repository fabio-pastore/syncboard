const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/Users');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;
router.use(authMiddleware);

// GET /api/user/profile

router.get('/profile', async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-passwordHash');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        console.error('GET /user/profile error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// PUT /api/user/profile
router.put('/profile', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const updates = {};
        if (username) updates.username = username;
        if (email) updates.email = email;
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ message: 'Password must be at least 6 characters' });
            }
            updates.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        if (updates.username || updates.email) {
            const conflict = await User.findOne({
                _id: { $ne: req.userId },
                $or: [...(updates.username?[{username:updates.username}]:[]),...(updates.email?[{email:updates.email}]:[]),],
            });
            if (conflict) {
                return res.status(400).json({ message: 'Username or email already in use' });
            }
        }
        const user = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select('-passwordHash');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        console.error('PUT /user/profile error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;