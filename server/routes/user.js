const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/Users');
const Board = require('../models/Board');
const BoardLine = require('../models/BoardLine');
const Folder = require('../models/Folder');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;
const MAX_PROFILE_IMAGE_SIZE = 500000; // ~500KB for base64 string
router.use(authMiddleware);

/**
 * GET /api/user/profile
 *
 * Retrieves the profile information of the authenticated user, excluding the password hash.
 *
 * @name GET /api/user/profile
 * @function
 * @returns {object} The user's profile data.
 */
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


/**
 * PUT /api/user/profile
 *
 * Updates the authenticated user's profile information (username, email, password, or profile image).
 * Validates the new data (e.g., password length, unique username/email, image size).
 *
 * @name PUT /api/user/profile
 * @function
 * @param {string} [username] - New username.
 * @param {string} [email] - New email address.
 * @param {string} [password] - New password (must be at least 6 characters).
 * @param {string} [profileImage] - New profile image as a base64 string.
 * @returns {object} The updated user profile document.
 */
router.put('/profile', async (req, res) => {
    try {
        const { username, email, password, profileImage } = req.body;
        const updates = {};
        if (username) updates.username = username;
        if (email) updates.email = email;
        if (profileImage !== undefined) {
            if (profileImage !== null && typeof profileImage === 'string' && profileImage.length > MAX_PROFILE_IMAGE_SIZE) {
                return res.status(400).json({ message: 'Profile image is too large' });
            }
            updates.profileImage = profileImage;
        }
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
                $or: [...(updates.username ? [{ username: updates.username }] : []), ...(updates.email ? [{ email: updates.email }] : []),],
            });
            if (conflict) {
                return res.status(400).json({ message: 'Username or email already in use' });
            }
        }
        const user = await User.findByIdAndUpdate(req.userId, updates, { returnDocument: 'after' }).select('-passwordHash');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        console.error('PUT /user/profile error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * DELETE /api/user/account
 *
 * Permanently deletes the authenticated user's account and all associated data,
 * including owned boards, folders, and board content. Revokes their access to shared boards.
 * Requires the user's password for verification.
 *
 * @name DELETE /api/user/account
 * @function
 * @param {string} password - The user's current password to confirm deletion.
 * @returns {object} JSON confirmation message.
 */
router.delete('/account', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(403).json({ message: 'Incorrect password' });

        const userBoards = await Board.find({ owner: req.userId }).select('_id');
        const boardIds = userBoards.map(b => b._id);
        if (boardIds.length > 0) {
            await BoardLine.deleteMany({ boardId: { $in: boardIds } });
        }

        await Board.deleteMany({ owner: req.userId });

        await Board.updateMany(
            { 'sharedWith.user': req.userId },
            { $pull: { sharedWith: { user: req.userId } } }
        );

        await Folder.deleteMany({ owner: req.userId });

        await User.findByIdAndDelete(req.userId);

        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error('DELETE /user/account error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
