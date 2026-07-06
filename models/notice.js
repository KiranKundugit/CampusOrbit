const mongoose = require('mongoose');

const NoticeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    displayType: { type: String, enum: ['ticker', 'board'], default: 'board' },
    createdBy: { type: String }, // Stores user email
    createdAt: { type: Date, default: Date.now }
});

const Notice = mongoose.model('Notice', NoticeSchema);
module.exports = Notice;