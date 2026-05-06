const express = require('express');
const Folder = require('../models/Folder');
const Board = require('../models/Board');
const BoardLine = require('../models/BoardLine');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/folders
router.get('/', async (req, res) => {
  try {
    const folders = await Folder.find({
      owner: req.userId,
      parent: null
    }).sort({ name: 1 });
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/folders/:id/children
router.get('/:id/children', async (req, res) => {
  try {
    const folders = await Folder.find({
      owner: req.userId,
      parent: req.params.id
    }).sort({ name: 1 });
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/folders
router.post('/', async (req, res) => {
  try {
    const { name, parent } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const folder = await Folder.create({
      owner: req.userId,
      name,
      parent: parent || null
    });
    res.status(201).json(folder);
  } catch (err) {
    console.error('POST /folders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/folders/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, parent } = req.body;

    if (parent) {
      let check = await Folder.findById(parent);
      while (check) {
        if (check._id.toString() === req.params.id) {
          return res.status(400).json({ error: 'Cannot move folder inside its own subfolder' });
        }
        check = check.parent ? await Folder.findById(check.parent) : null;
      }
    }

    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      { ...(name && { name }), ...(parent !== undefined && { parent }) },
      { returnDocument: 'after' }
    );
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
      res.json(folder);
    } catch (err) {
      console.error('PUT /folders/:id error:', err);
      res.status(500).json({ error: 'Server error' });
    }
});

async function deleteFolderRecursive(folderId, ownerId) {
  const subfolders = await Folder.find({ parent: folderId, owner: ownerId });
  for (const sub of subfolders) {
    await deleteFolderRecursive(sub._id, ownerId);
  }
  const boardsToDelete = await Board.find({ folder: folderId, owner: ownerId });
  const boardIds = boardsToDelete.map(b => b._id);
  
  if (boardIds.length > 0) {
      await BoardLine.deleteMany({ boardId: { $in: boardIds } });
  }
  
  await Board.deleteMany({ folder: folderId, owner: ownerId });
  await Folder.deleteOne({ _id: folderId, owner: ownerId });
}

// DELETE /api/folders/:id
router.delete('/:id', async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.id, owner: req.userId });
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    await deleteFolderRecursive(req.params.id, req.userId); // deletes subfolders + their boards + this folder
    res.json({ message: 'Folder deleted' });
  } catch (err) {
    console.error('DELETE /folders/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;