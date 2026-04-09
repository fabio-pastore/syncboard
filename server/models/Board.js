const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
    owner:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:       { type: String, required: true },
    folder:     { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    sharedWith: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['viewer', 'editor'], default: 'viewer' }
    }],
    content: { type: Array, default: [] },
    shareTokens: [{
        token: { type: String, required: true },
        role: {type: String, enum: ['viewer', 'editor'], default: 'viewer' }
    }]
    // roba da aggiungere dopo -> DOMANDA: come memorizziamo i dati della lavagna?
}, { timestamps: true });

module.exports = mongoose.model('Board', boardSchema);