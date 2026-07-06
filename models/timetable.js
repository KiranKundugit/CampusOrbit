const mongoose = require('mongoose');
const timetableSchema = new mongoose.Schema({
    roleTarget: { type: String, required: true, enum: ['student', 'faculty'] }, 
    day: { type: String, required: true }, 
    time: { type: String, required: true }, 
    subject: { type: String, required: true },
    room: { type: String, required: true },
    course: { type: String, required: true },
    facultyId: { type: String, required: true } 
});
const Timetable = mongoose.model('Timetable', timetableSchema);

module.exports = Timetable;