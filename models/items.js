const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    purpose: { type: String, enum: ['sell', 'rent'], required: true }, // Filter flag
    timePeriod: { type: String, default: 'Permanent' }, // e.g., "Per Semester", "Per Week"
    contactEmail: { type: String, required: true },
    pay: {type: String, required: true},
    createdAt: { type: Date, default: Date.now }
});

const Item = mongoose.model('Item', ItemSchema);
module.exports = Item;