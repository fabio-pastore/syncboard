const express = require('express');
const crypto = require('crypto');
const Board = require('../models/Board');
const authMiddleware = require('../middleware/auth')

const router = express.Router();
const MAX_TB_SIZE = 150000

router.use(authMiddleware);

// GET /api/boards
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

// POST /api/boards/create
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

// GET /api/boards/folder/:folderId

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

// GET /api/boards/:id
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
        res.json(board);
    }
    catch (err) {
        res.status(500).json({ error: 'Server rror'});
    }
});

// PUT /api/boards/:id
router.put('/:id', async (req, res) => {
    try {
        const {name, folder} = req.body;
        const board = await Board.findOneAndUpdate(
            {_id: req.params.id, owner: req.userId},
            { ...(name && { name }), ...(folder !== undefined && { folder })},
            { new: true }
        );
        if (!board) return res.status(404).json({ error: 'Board not found'});
        res.json(board);
    } catch (err) {
        res.status(500).json({error: 'Server error'});
    }
})

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

// DELETE /api/boards/:id/share/user/:userId
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

// POST /api/boards/:id/share  (one-time link)
router.post('/:id/share', async (req, res) => {
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

// DELETE /api/boards/:id
router.delete('/:id', async (req, res) => {
    try {
        const board = await Board.findOneAndDelete({
            _id: req.params.id,
            owner: req.userId
        });
        if (!board) return res.status(404).json({ error: 'Board not found'})
        res.json({ message: 'Board deleted successfully'});
    } catch (err) {
        res.status(500).json( {error: 'Server error'});
    }
})

// PUT /api/boards/:id/thumbnail
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
            }, { thumbnail }, { new: true }
        );
        if (!board) return res.status(404).json({ error: 'Board not found' });
        res.json({ message: 'Thumbnail saved'});;
    } catch (err) {
        res.status(500).json( {error: 'Server error'});
    }
})

module.exports = router;