const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    universityId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, default: null },
    role: { type: String, required: true, enum: ['student', 'faculty', 'admin'] },
    isRegistered: { type: Boolean, default: false },
    course: { 
        type: String, 
        default: 'N/A', 
        enum: ['N/A', 'B.Tech', 'BCA', 'BA', 'B.COM', 'M.Tech', 'MCA', 'MA', 'MSC', 'BSC'] 
    }
});

const User = mongoose.model('User', userSchema);
module.exports = User;