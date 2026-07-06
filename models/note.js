const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, required: true },
    semester: { type: String, required: true },
    documentUrl: { type: String, required: true }, // URL link to Google Drive, OneDrive, or local file
    uploadedBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', NoteSchema);
module.exports = Note;