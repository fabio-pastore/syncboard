const express = require('express');
const Folder = require('../models/Folder');
const Board = require('../models/Board');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

/**
 * Builds the full path string for a folder by walking up the parent chain.
 * E.g., "Root Folder / Sub Folder / Current Folder".
 *
 * @async
 * @function buildFolderPath
 * @param {string} folderId - The ID of the folder to build the path for.
 * @returns {Promise<string>} The constructed folder path string.
 */
async function buildFolderPath(folderId) {
    const parts = [];
    let current = await Folder.findById(folderId).select('name parent');
    while (current) {
        parts.unshift(current.name);
        current = current.parent ? await Folder.findById(current.parent).select('name parent') : null;
    }
    return parts.join(' / ');
}

/**
 * GET /api/search
 *
 * Performs a case-insensitive search across folders and boards based on the provided query term.
 * Searches folder names and board names that the user owns or has access to.
 * Returns the matching folders and boards along with their constructed paths.
 *
 * @name GET /api/search
 * @function
 * @param {string} q - The search query term.
 * @returns {object} JSON object containing arrays of matched `folders` and `boards`.
 */
router.get('/', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q) return res.json({ folders: [], boards: [] });

        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        // Search all folders owned by user
        const folders = await Folder.find({
            owner: req.userId,
            name: regex
        }).sort({ name: 1 });

        // Search all boards owned by or shared with user
        const boards = await Board.find({
            $or: [
                { owner: req.userId },
                { 'sharedWith.user': req.userId }
            ],
            name: regex
        }).populate('owner', 'username profileImage').sort({ updatedAt: -1 });

        // Build folder paths for display
        const folderResults = await Promise.all(
            folders.map(async (f) => {
                const path = f.parent ? await buildFolderPath(f.parent) : null;
                return { ...f.toObject(), path };
            })
        );

        const boardResults = await Promise.all(
            boards.map(async (b) => {
                const path = b.folder ? await buildFolderPath(b.folder) : null;
                return { ...b.toObject(), path };
            })
        );

        res.json({ folders: folderResults, boards: boardResults });
    } catch (err) {
        console.error('GET /search error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;