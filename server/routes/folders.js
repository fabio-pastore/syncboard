const express = require('express');
const Folder = require('../models/Folder');
const Board = require('../models/Board');
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
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/folders/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, parent } = req.body;
    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      { ...(name && { name }), ...(parent !== undefined && { parent }) },
      { new: true }
    );
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    res.json(folder);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

async function deleteFolderRecursive(folderId, ownerId) {
  const subfolders = await Folder.find({ parent: folderId, owner: ownerId });
  for (const sub of subfolders) {
    await deleteFolderRecursive(sub._id, ownerId);
  }
  await Board.deleteMany({ folder: folderId, owner: ownerId }); // we can use updatemany to bring stuff to root instead
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
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;