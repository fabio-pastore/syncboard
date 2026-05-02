const mongoose = require('mongoose');

const boardLineSchema = new mongoose.Schema({
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    lineId: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

boardLineSchema.index({ boardId: 1, lineId: 1 }, { unique: true });

module.exports = mongoose.model('BoardLine', boardLineSchema);