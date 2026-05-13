const express = require('express');
const crypto = require('crypto');
const Board = require('../models/Board');
const BoardLine = require('../models/BoardLine');
const authMiddleware = require('../middleware/auth')

const router = express.Router();
const MAX_TB_SIZE = 150000

// all routes require authentication
router.use(authMiddleware);

/**
 * GET /api/boards
 *
 * Retrieves all boards that the authenticated user owns or has access to.
 * Returns boards with thumbnail and folder information, sorted by update time
 * (most recent first).
 *
 * @name GET /api/boards
 * @function
 * @returns {Array<object>} Array of board objects with owner username and folder name populated.
 */
router.get('/', async (req, res) => {
    try {
        const boards = await Board.find({
            $or : [
                { owner : req.userId },
                { 'sharedWith.user': req.userId }
            ]
        }).populate('owner', 'username').sort({ updatedAt: -1 });
        res.json(boards);
    } catch (err) {
        res.status(500).json({ error: "Server error"});
    }
});

/**
 * POST /api/boards/create
 *
 * Creates a new board. The authenticated user becomes the board owner.
 * The board is created with a name, optional folder assignment, and
 * default background settings.
 *
 * @name POST /api/boards/create
 * @function
 * @param {string} name - The name for the new board.
 * @param {string} [folder] - Optional ID of the parent folder.
 * @returns {object} The newly created board document.
 */
router.post('/create', async (req, res) => {
    try {
        const { name, folder } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const board = await Board.create({
            owner: req.userId,
            name,
            folder: folder || null
        });
        res.status(201).json(board);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/boards/folder/:folderId
 *
 * Retrieves all boards that belong to a specific folder and are owned by the authenticated user.
 * Returns boards sorted by update time (most recent first).
 *
 * @name GET /api/boards/folder/:folderId
 * @function
 * @param {string} folderId - The ID of the folder to retrieve boards from.
 * @returns {Array<object>} Array of board objects within the specified folder.
 */
router.get('/folder/:folderId', async (req, res) => {
    try {
        const boards = await Board.find({
            owner: req.userId,
            folder: req.params.folderId
        }).sort({ updatedAt: -1 });
        res.json(boards);
    } catch (err) {
        res.status(500).json({ error: 'Server error'});
    }
});

/**
 * GET /api/boards/:id
 *
 * Retrieves a single board by its ID. Verifies that the requesting user
 * is either the owner or has been shared the board.
 *
 * @name GET /api/boards/:id
 * @function
 * @param {string} id - The board ID.
 * @returns {object} The board document with owner info populated.
 */
router.get('/:id', async (req, res) => {
    try {
        const board = await Board.findOne({
            _id: req.params.id,
            $or: [
                { owner: req.userId },
                { 'sharedWith.user': req.userId}
            ]
        }).populate('sharedWith.user', 'username');
        if (!board) return res.status(404).json({ error: 'Board not found'});

        const lineDocs = await BoardLine.find({ boardId: board._id }).lean();
        const boardObj = board.toObject();
        boardObj.content = lineDocs.map(doc => doc.data);

        res.json(boardObj);
    }
    catch (err) {
        console.error('GET /boards/:id error:', err);
        res.status(500).json({ error: 'Server error'});
    }
});

/**
 * PUT /api/boards/:id
 *
 * Updates a board's metadata (name or folder). Only the board owner can update.
 *
 * @name PUT /api/boards/:id
 * @function
 * @param {string} id - The board ID.
 * @param {string} [name] - New board name.
 * @param {string|null} [folder] - New parent folder ID, or null to remove.
 * @returns {object} The updated board document.
 */
router.put('/:id', async (req, res) => {
    try {
        const {name, folder} = req.body;

        if (folder) {
            const f = require('../models/Folder');
            const tf = await f.findOne({_id: folder, owner: req.userId});
            if (!tf) return res.status(405).json({ error: 'Folder not found' });
        }
        const board = await Board.findOneAndUpdate(
            {_id: req.params.id, owner: req.userId},
            { ...(name && { name }), ...(folder !== undefined && { folder })},
            { returnDocument: 'after' }
        );
        if (!board) return res.status(404).json({ error: 'Board not found'});
        res.json(board);
    } catch (err) {
        console.error('PUT /boards/:id error:', err);
        res.status(500).json({error: 'Server error'});
    }
})

/**
 * POST /api/boards/:id/share/user
 *
 * Permanently shares the board with another user by their username.
 * Only the board owner can share with other users.
 *
 * @name POST /api/boards/:id/share/user
 * @function
 * @param {string} id - The board ID.
 * @param {string} username - The username of the user to share with.
 * @param {string} role - The role to assign ('viewer' or 'editor').
 * @returns {object} JSON with the shared user's ID, username, and role.
 */
router.post('/:id/share/user', async (req, res) => {
    try {
        const { username, role } = req.body;
        if (!['viewer', 'editor'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        const board = await Board.findOne({ _id: req.params.id, owner: req.userId });
        if (!board) return res.status(404).json({ error: 'Board not found' });

        const User = require('../models/Users');
        const targetUser = await User.findOne({ username });
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        if (targetUser._id.toString() === req.userId) {
            return res.status(400).json({ error: 'Cannot share with yourself' });
        }

        const existingShare = board.sharedWith.find(s => s.user.toString() === targetUser._id.toString());
        if (existingShare) {
            existingShare.role = role;
        } else {
            board.sharedWith.push({ user: targetUser._id, role });
        }
        await board.save();
        res.json({ message: 'Board shared successfully', userId: targetUser._id, username: targetUser.username, role });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/boards/:id/share/user/:userId
 *
 * Removes a user's access to the board. Only the board owner can revoke access.
 *
 * @name DELETE /api/boards/:id/share/user/:userId
 * @function
 * @param {string} id - The board ID.
 * @param {string} userId - The ID of the user to remove.
 * @returns {object} JSON confirmation message.
 */
router.delete('/:id/share/user/:targetUserId', async (req, res) => {
    try {
        const board = await Board.findOne({ _id: req.params.id, owner: req.userId });
        if (!board) return res.status(404).json({ error: 'Board not found' });
        board.sharedWith = board.sharedWith.filter(s => s.user.toString() !== req.params.targetUserId);
        await board.save();

        // seems to work
        const roomId = board._id.toString();
        const room = req.io.sockets.adapter.rooms.get(roomId);
        if (room) {
            for (const sid of room) {
                const s = req.io.sockets.sockets.get(sid);
                if (s && s.data.userId === req.params.targetUserId) {
                    s.emit('board:kicked', 'Your access was revoked by the owner');
                    s.disconnect(true);
                }
            }
        }

        res.json({ message: 'Access revoked' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * POST /api/boards/:id/share
 *
 * Generates a one-time share token for the board with the specified role.
 * Only the board owner can create share links.
 *
 * @name POST /api/boards/:id/share
 * @function
 * @param {string} id - The board ID.
 * @param {string} role - The role for the share link ('viewer' or 'editor').
 * @returns {object} JSON with the generated `shareToken`.
 */
router.post('/:id/share', async (req, res) => { // (generate one time link)
    try {
        const { role } = req.body;
        if (!['viewer', 'editor'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        const board = await Board.findOne({_id: req.params.id, owner: req.userId});
        if (!board) return res.status(404).json({ error: 'Board not found' });

        const shareToken = crypto.randomBytes(32).toString('hex');
        board.shareTokens.push({ token: shareToken, role });
        await board.save();
        res.json({ shareToken });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/boards/:id
 *
 * Deletes a board and all its associated lines. Only the board owner can delete.
 *
 * @name DELETE /api/boards/:id
 * @function
 * @param {string} id - The board ID.
 * @returns {object} JSON confirmation message.
 */
router.delete('/:id', async (req, res) => {
    try {
        const board = await Board.findOneAndDelete({
            _id: req.params.id,
            owner: req.userId
        });
        if (!board) return res.status(404).json({ error: 'Board not found'})

        await BoardLine.deleteMany({ boardId: board._id });

        res.json({ message: 'Board deleted successfully'});
    } catch (err) {
        res.status(500).json( {error: 'Server error'});
    }
})

/**
 * PUT /api/boards/:id/thumbnail
 *
 * Saves or updates the thumbnail image (base64 data URL) for a board.
 * Only the board owner can update the thumbnail.
 *
 * @name PUT /api/boards/:id/thumbnail
 * @function
 * @param {string} id - The board ID.
 * @param {string} thumbnail - The base64-encoded image data URL.
 * @returns {object} JSON confirmation message.
 */
router.put('/:id/thumbnail', async (req, res) => {
    try {
        const { thumbnail } = req.body;
        if (!thumbnail || typeof thumbnail !== 'string') {
            return res.status(400).json({ error: 'Thumbnail is required' });
        }

        if (thumbnail.length > MAX_TB_SIZE) {
            return res.status(400).json({ error: 'Thumbnail is too large' });
        }

        const board = await Board.findOneAndUpdate(
            {
                _id: req.params.id,
                $or : [
                    { owner : req.userId },
                    { 'sharedWith' : { $elemMatch : { user: req.userId, role: 'editor' } } }
                ]
            }, { thumbnail }, { returnDocument: 'after' }
        );
        if (!board) return res.status(404).json({ error: 'Board not found' });
        res.json({ message: 'Thumbnail saved'});;
    } catch (err) {
        res.status(500).json( {error: 'Server error'});
    }
})

module.exports = router;