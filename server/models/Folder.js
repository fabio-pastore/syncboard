const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
    owner:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:       { type: String, required: true },
    parent:     { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Folder', folderSchema);
