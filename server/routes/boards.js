const express = require('express');
const Board = require('../models/Board');
const authMiddleware = require('../middleware/auth')

const router = express.Router();

router.use(authMiddleware);

// GET /api/boards
router.get('/', async (req, res) => {
    try {
        const boards = await Board.find({
            $or : [
                { owner : req.userId },             // userId l'ho salvato dall'autenticazione
                { 'sharedWith.user': req.userId }
            ]   // mi serve anche per file condivisi da altri utenti
        }).sort({ updatedAt: -1 });
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
        });
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

module.exports = router;