const express = require('express');
const Folder = require('../models/Folder');
const Board = require('../models/Board');
const BoardLine = require('../models/BoardLine');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

/**
 * GET /api/folders
 *
 * Retrieves all folders owned by the authenticated user. If a `parent`
 * query parameter is provided, only folders with that parent ID are returned.
 * Otherwise, only root-level folders (parent: null) are returned.
 *
 * @name GET /api/folders
 * @function
 * @param {string} [parent] - Optional parent folder ID to filter by.
 * @returns {Array<object>} Array of folder documents, sorted by name.
 */
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

/**
 * GET /api/folders/:id/children
 *
 * Retrieves all immediate subfolders of a specific folder owned by the authenticated user.
 *
 * @name GET /api/folders/:id/children
 * @function
 * @param {string} id - The parent folder ID.
 * @returns {Array<object>} Array of subfolder documents, sorted by name.
 */
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

/**
 * POST /api/folders
 *
 * Creates a new folder for organizing boards. The authenticated user
 * becomes the folder owner. Folders can be nested via the parent field.
 *
 * @name POST /api/folders
 * @function
 * @param {string} name - The name for the new folder.
 * @param {string|null} [parent] - Optional parent folder ID for nesting.
 * @returns {object} The newly created folder document.
 */
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

/**
 * PUT /api/folders/:id
 *
 * Updates a folder's name or parent. Only the folder owner can update it.
 *
 * @name PUT /api/folders/:id
 * @function
 * @param {string} id - The folder ID.
 * @param {string} [name] - New folder name.
 * @param {string|null} [parent] - New parent folder ID, or null.
 * @returns {object} The updated folder document.
 */
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

/**
 * Recursively deletes a folder and all its contents, including subfolders and boards.
 * Used internally by the DELETE /api/folders/:id endpoint.
 *
 * @async
 * @function deleteFolderRecursive
 * @param {string} folderId - The ID of the folder to delete.
 * @param {string} ownerId - The ID of the folder's owner.
 * @returns {Promise<void>}
 */
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

/**
 * DELETE /api/folders/:id
 *
 * Deletes a folder. All boards inside the folder are moved to root level
 * (folder set to null). Only the folder owner can delete it.
 *
 * @name DELETE /api/folders/:id
 * @function
 * @param {string} id - The folder ID.
 * @returns {object} JSON confirmation message.
 */
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