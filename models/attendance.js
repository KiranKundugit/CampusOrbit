const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    userRefId: { type: String, required: true },
    userRole: { type: String, required: true },
    course: { type: String, default: 'N/A' },
    date: { type: String, required: true }, // Format: "YYYY-MM-DD"
    status: { type: String, required: true, enum: ['Present', 'Absent'] }
});
const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;