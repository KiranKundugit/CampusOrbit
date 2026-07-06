const express = require('express');
const mongoose = require('mongoose');
const path = require("path");
const Notice = require('./models/notice');
const User = require('./models/user');
const Timetable = require('./models/timetable');
const Attendance = require('./models/attendance');
const Item = require('./models/items');
const session = require('express-session');
const Note = require('./models/note');


const app = express();
const PORT = 8080;


// Configuration for cookie tracking state session engine
app.use(session({
    secret: 'super_secure_campus_portal_key_2026', // Secret signature key
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 2, // Session expires automatically after 2 Hours
        secure: false
    }
}));

// Authentication Middleware
function isLoggedIn(req, res, next) {
    if (req.session.user) {
        return next();
    }
    return res.redirect("/login");
}


app.set("view engine", "ejs");
app.set("views", path.join(__dirname,"views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
main().then(() => console.log("Success!")).catch(err => console.log(err));
async function main() {
   await mongoose.connect("mongodb://127.0.0.1:27017/campus");
}


// Auth Routes
app.get('/signup', (req, res) => res.render('signup', { message: null, error: null }));
app.get('/login', (req, res) => res.render('login', { message: null, error: null }));

app.post('/signup', async (req, res) => {
    try {
        const { universityId, email, password } = req.body;
        const userRosterProfile = await User.findOne({ universityId });
        if (!userRosterProfile || userRosterProfile.email !== email || userRosterProfile.isRegistered) {
            return res.render('signup', { error: 'Invalid configuration or credentials.', message: null });
        }
        userRosterProfile.password = password;
        userRosterProfile.isRegistered = true;
        await userRosterProfile.save();
        res.render('login', { message: `Account verified successfully as a ${userRosterProfile.role}!`, error: null });
    } catch (error) { res.status(500).send(error.message); }
});

app.post('/login', async (req, res) => {
    try {
        const { universityId, password } = req.body;
        const user = await User.findOne({ universityId });

        if (!user)
            return res.render('login', {
                error: 'Invalid ID / Password.',
                message: null
            });

        if (user.password !== password || !user.isRegistered) {
            return res.render('login', {
                error: 'Invalid credentials or non-activated account.',
                message: null
            });
        }

        // Save logged-in user in session
        req.session.user = {
            universityId: user.universityId,
            email: user.email,
            role: user.role
        };

        // Redirect according to role
        if (user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        }

        if (user.role === 'student') {
            return res.redirect('/student/profile');
        }

        if (user.role === 'faculty') {
            return res.redirect('/faculty/profile');
        }

    } catch (error) {
        res.status(500).send(error.message);
    }
});


// DESTROY SESSION UPON LOGOUT TRIGGER
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        res.redirect('/');
    });
});


app.get('/', async (req, res) => {
    try {
        const tickerNotices = await Notice.find({ displayType: 'ticker' }).sort({ createdAt: -1 });
        const boardNotices = await Notice.find({ displayType: 'board' }).sort({ createdAt: -1 });

        // Pass the session user object (it will be undefined if no one is logged in)
        res.render('Home', { 
            tickerNotices, 
            boardNotices, 
            user: req.session.user || null 
        });
    } catch (e) {
        res.status(500).send("Error rendering home: " + e.message);
    }
});


// Display Notice Form
app.get('/campus/create-notice', isLoggedIn, (req, res) => {
    if (req.session.user.role === 'admin' || req.session.user.role === 'faculty') {
        return res.render('create-notice', { user: req.session.user });
    }
    res.status(403).send("Unauthorized allocation parameters.");
});

// Process Form Submissions
app.post('/campus/save-notice', isLoggedIn, async (req, res) => {
    try {
        const { title, description, displayType } = req.body;
        
        // IF THE OPERATOR IS CREATING A TICKER, DELETE ALL OLD TICKERS FIRST
        if (displayType === 'ticker') {
            await Notice.deleteMany({ displayType: 'ticker' });
        }
        
        await Notice.create({
            title,
            description,
            displayType,
            createdBy: req.session.user.email
        });

        res.redirect('/');
    } catch (e) {
        res.status(500).send("Error saving notice: " + e.message);
    }
});


app.get('/campus/delete-notice/:id', isLoggedIn, async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);
        
        if (!notice) {
            return res.status(404).send("Target announcement record not found.");
        }

        // SECURITY: Faculty can only drop entries they created themselves
        if (req.session.user.role === 'faculty' && notice.createdBy !== req.session.user.email) {
            return res.status(403).send("Action Denied: You do not possess structural ownership over this notice record.");
        }

        // Remove the document directly from MongoDB
        await Notice.findByIdAndDelete(req.params.id);

        // Instantly bounce them back to the home page to reflect the update
        res.redirect('/');
    } catch (error) {
        res.status(500).send("Error executing document removal query: " + error.message);
    }
});


// RENDER THE DIGITAL NOTES COMPONENT REPOSITORY
app.get('/campus/notes', isLoggedIn, async (req, res) => {
    try {
        const semesterFilter = req.query.semester;
        let query = {};

        if (semesterFilter && semesterFilter !== 'all') {
            query.semester = semesterFilter;
        }

        const notes = await Note.find(query).sort({ createdAt: -1 });
        res.render('notes-vault', { notes, currentSemester: semesterFilter || 'all', user: req.session.user });
    } catch (e) {
        res.status(500).send("Error compiling notes repository: " + e.message);
    }
});

// POST: SUBMIT NEW DOCUMENT REFERENCE ENTRY
app.post('/campus/notes/upload', isLoggedIn, async (req, res) => {
    try {
        const { title, subject, semester, documentUrl } = req.body;

        await Note.create({
            title,
            subject,
            semester,
            documentUrl,
            uploadedBy: req.session.user.email
        });

        res.redirect('/campus/notes');
    } catch (e) {
        res.status(500).send("Error saving document to database matrix: " + e.message);
    }
});

// GET: DELETE ACTION CONTROL TO REMOVE MATERIAL LINK
app.get('/campus/notes/delete/:id', isLoggedIn, async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) return res.status(404).send("Document not found.");

        // Admins or the original uploader can delete
        if (req.session.user.role !== 'admin' && note.uploadedBy !== req.session.user.email) {
            return res.status(403).send("Unauthorized allocation removal attempt.");
        }

        await Note.findByIdAndDelete(req.params.id);
        res.redirect('/campus/notes');
    } catch (e) {
        res.status(500).send(e.message);
    }
});


// MARKETPLACE BAZAAR HUB
app.get('/campus/marketplace', isLoggedIn, async (req, res) => {
    try {
        const filterType = req.query.filter; // 'sell' or 'rent'
        let query = {};
        
        if (filterType === 'sell' || filterType === 'rent') {
            query.purpose = filterType;
        }

        const items = await Item.find(query).sort({ createdAt: -1 });
        res.render('marketplace', { items, currentFilter: filterType || 'all', user: req.session.user });
    } catch (e) {
        res.status(500).send("Error reading marketplace cluster: " + e.message);
    }
});

// LIVE SUBMIT NEW ITEM TRANSACTION
app.post('/campus/marketplace/list', async (req, res) => {
    try {

        const { title, description, price, pay, purpose, timePeriod } = req.body;
        
        await Item.create({
            title,
            description,
            price: Number(price),
            purpose,
            timePeriod: purpose === 'rent' ? timePeriod : 'Permanent',
            pay,
            contactEmail: req.session.user.email
        });

        res.redirect('/campus/marketplace');
    } catch (e) {
        res.status(500).send("Error compiling listing matrix: " + e.message);
    }
});

// REMOVE AN ITEM LISTING DIRECTLY
app.get('/campus/marketplace/delete/:id', isLoggedIn, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).send("Item record missing.");

        // Verification safety boundaries
        if (req.session.user.role !== 'admin' && item.contactEmail !== req.session.user.email) {
            return res.status(403).send("Unauthorized ownership disposal attempt.");
        }

        await Item.findByIdAndDelete(req.params.id);
        res.redirect('/campus/marketplace');
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// STUDENT PROFILE 
app.get('/student/profile', isLoggedIn, async (req, res) => {
    try {
        const studentUser = await User.findOne({
    email: req.session.user.email
});
        if (!studentUser) {
            return res.status(404).send("Student profile not found.");
        }
        res.render('student-profile', { email: studentUser.email, student: studentUser });
    } catch (error) {
        res.status(500).send("Error loading student profile: " + error.message);
    }
});

// FACULTY PROFILE
app.get('/faculty/profile', isLoggedIn, async (req, res) => {
    try {
        const facultyUser = await User.findOne({ email: req.session.user.email });
        if (!facultyUser) {
            return res.status(404).send("Faculty profile not found.");
        }
        res.render('faculty-profile', { email: facultyUser.email, faculty: facultyUser });
    } catch (error) {
        res.status(500).send("Error loading faculty profile: " + error.message);
    }
});

// ADMIN DASHBOARD
app.get('/admin/dashboard', isLoggedIn, async (req, res) => {
    const users = await User.find({});
    res.render('admin-dashboard', { users, message: null, error: null });
});

// Timetable
app.get('/admin/timetable', isLoggedIn, async (req, res) => {
    const schedule = await Timetable.find({});
    const facultyList = await User.find({ role: 'faculty' });
    res.render('admin-timetable', { schedule, facultyList, message: null, error: null });
});

// ADMIN TIMETABLE UPDATION
app.post('/admin/timetable/update', isLoggedIn, async (req, res) => {
    try {
        const { roleTarget, day, time, subject, room, course, facultyId } = req.body;
        await Timetable.findOneAndUpdate({ roleTarget, day, time, course }, { subject, room, facultyId }, { upsert: true });
        res.redirect(`/admin/timetable`);
    } catch (error) { res.status(500).send(error.message); }
});

// ADMIN DASHBOARD UPDATIONS
app.post('/admin/add', async (req, res) => {
    try {
        const { universityId, email, role, course } = req.body;
        if (await User.findOne({ universityId })) return res.redirect('/admin/dashboard');
        await new User({ universityId, email, role, course: role === 'student' ? course : 'N/A' }).save();
        res.redirect('/admin/dashboard');
    } catch (error) { res.status(500).send(error.message); }
});

app.post('/admin/update', isLoggedIn, async (req, res) => {
    try {
        const { universityId, email, role, course } = req.body;
        await User.findOneAndUpdate(
            { universityId }, 
            { email, role, course } 
        );
        res.redirect('/admin/dashboard');
    } catch (error) { res.status(500).send(error.message); }
});

app.post('/admin/delete/:id', isLoggedIn, async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard');
});


// DELETE A SPECIFIC SCHEDULE ROW ENTIRELY
app.post('/admin/timetable/delete/:id', isLoggedIn, async (req, res) => {
    try {
        await Timetable.findByIdAndDelete(req.params.id);
        res.redirect('/admin/timetable');
    } catch (error) { 
        res.status(500).send("Error dropping timetable slot: " + error.message); 
    }
});


app.get('/student/timetable', isLoggedIn, async (req, res) => {
    try {
        // Finding the logged-in student using the email from the query string
        const studentUser = await User.findOne({ email: req.session.user.email });
        
        if (!studentUser) {
            return res.render('student-timetable', { email: "Guest", schedule: [] });
        }

        // Fetch ONLY the timetable slots where the course matches this student's specific course
        const schedule = await Timetable.find({ 
            roleTarget: 'student', 
            course: studentUser.course  // Matches 'B.Tech', 'BCA', etc.
        });

        // Render the page and pass down the specific schedule rows
        res.render('student-timetable', { 
            email: studentUser.email, 
            schedule: schedule 
        });
    } catch (error) { 
        res.status(500).send("Error rendering student timetable: " + error.message); 
    }
});

app.get('/faculty/timetable', isLoggedIn, async (req, res) => {
    try {
        // Find the logged-in faculty member using their email
        const facultyUser = await User.findOne({ email: req.session.user.email });
        
        if (!facultyUser) {
            return res.render('faculty-timetable', { email: "Guest", facultySchedule: [] });
        }

        // Fetch ONLY the slots where the admin assigned this professor's University ID
        const facultySchedule = await Timetable.find({ 
            facultyId: facultyUser.universityId  // Matches 'FAC2001', etc.
        });

        // Render the faculty view with their custom schedule slots
        res.render('faculty-timetable', { 
            email: facultyUser.email, 
            facultySchedule: facultySchedule 
        });
    } catch (error) { 
        res.status(500).send("Error rendering faculty timetable: " + error.message); 
    }
});

// ATTENDANCE LOGIC

// Helper function to calculate total days in a month string (YYYY-MM)
function getDaysInMonth(yearMonthStr) {
    if (!yearMonthStr) return 30;
    const [year, month] = yearMonthStr.split('-');
    return new Date(year, month, 0).getDate();
}

// STUDENT ATTENDANCE
app.get('/student/attendance', isLoggedIn, async (req, res) => {
    try {
        const student = await User.findOne({ email: req.session.user.email });
        if (!student) return res.send("Profile Mismatch.");

        const targetMonth = req.query.month || new Date().toISOString().slice(0, 7); // Default: "YYYY-MM"
        const totalDays = getDaysInMonth(targetMonth);

        // Fetch logs for this month
        const logs = await Attendance.find({
            userRefId: student.universityId,
            date: { $regex: new RegExp("^" + targetMonth) }
        });

        // Convert logs array to a fast lookup map: { "05": "Present" }
        const statusMap = {};
        logs.forEach(l => {
            const dayStr = l.date.split('-')[2];
            statusMap[dayStr] = l.status;
        });

        const presentCount = logs.filter(l => l.status === 'Present').length;
        const rate = logs.length > 0 ? Math.round((presentCount / totalDays) * 100) : 0;

        res.render('student-attendance', { 
            email: student.email, 
            student, 
            targetMonth, 
            totalDays, 
            statusMap, 
            rate 
        });
    } catch (e) { res.status(500).send(e.message); }
});

// FACULTY ATTENDANCE
app.get('/faculty/attendance', isLoggedIn, async (req, res) => {
    try {
        const faculty = await User.findOne({ email: req.session.user.email });
        if (!faculty) return res.send("Profile Mismatch.");

        const targetMonth = req.query.month || new Date().toISOString().slice(0, 7);
        const targetCourse = req.query.course || 'B.Tech';
        const totalDays = getDaysInMonth(targetMonth);

        // Fetch target scope records
        const students = await User.find({ role: 'student', course: targetCourse });
        const studentLogs = await Attendance.find({ userRole: 'student', course: targetCourse, date: { $regex: new RegExp("^" + targetMonth) } });
        const selfLogs = await Attendance.find({ userRefId: faculty.universityId, date: { $regex: new RegExp("^" + targetMonth) } });

        // Map data layers for quick lookups
        const globalStatusMap = {}; // Format: { "STU1001-05": "Present" }
        studentLogs.forEach(l => {
            const dayStr = l.date.split('-')[2];
            globalStatusMap[`${l.userRefId}-${dayStr}`] = l.status;
        });

        const selfStatusMap = {};
        selfLogs.forEach(l => {
            const dayStr = l.date.split('-')[2];
            selfStatusMap[dayStr] = l.status;
        });

        const fPres = selfLogs.filter(l => l.status === 'Present').length;
        const sPres = studentLogs.filter(l => l.status === 'Present').length;

        res.render('faculty-attendance', {
            email: faculty.email,
            faculty,
            students,
            targetMonth,
            targetCourse,
            totalDays,
            globalStatusMap,
            selfStatusMap,
            facRate: selfLogs.length > 0 ? Math.round((fPres / selfLogs.length) * 100) : 0,
            stuRate: studentLogs.length > 0 ? Math.round((sPres / studentLogs.length) * 100) : 0
        });
    } catch (e) { res.status(500).send(e.message); }
});

// ADMIN ATTENDANCE
app.get('/admin/attendance', isLoggedIn, async (req, res) => {
    try {
        const targetMonth = req.query.month || new Date().toISOString().slice(0, 7);
        const targetCourse = req.query.course || 'B.Tech';
        const totalDays = getDaysInMonth(targetMonth);

        const students = await User.find({ role: 'student', course: targetCourse });
        const faculty = await User.find({ role: 'faculty' });
        
        const allLogs = await Attendance.find({ date: { $regex: new RegExp("^" + targetMonth) } });

        const globalStatusMap = {};
        allLogs.forEach(l => {
            const dayStr = l.date.split('-')[2];
            globalStatusMap[`${l.userRefId}-${dayStr}`] = l.status;
        });

        const sLogs = allLogs.filter(l => l.userRole === 'student' && l.course === targetCourse);
        const fLogs = allLogs.filter(l => l.userRole === 'faculty');
        const sPres = sLogs.filter(l => l.status === 'Present').length;
        const fPres = fLogs.filter(l => l.status === 'Present').length;
        
        res.render('admin-attendance', {
            targetMonth,
            targetCourse,
            totalDays,
            students,
            faculty,
            globalStatusMap,
            stuRate: sLogs.length > 0 ? Math.round((sPres / sLogs.length) * 100) : 0,
            facRate: fLogs.length > 0 ? Math.round((fPres / fLogs.length) * 100) : 0
            
        });
    } catch (e) { res.status(500).send(e.message); }
});

// ATTENDANCE SAVE OPERATION ROUTE
app.post('/attendance/matrix/save', isLoggedIn, async (req, res) => {
    try {
        const { targetMonth, userRole, course, attendanceData, redirectUrl } = req.body;
        // parsedData array structure will be passed via frontend JSON parsing inside forms
        const updates = JSON.parse(attendanceData);

        for (let record of updates) {
            const dayFormatted = record.day.toString().padStart(2, '0');
            const exactDate = `${targetMonth}-${dayFormatted}`;
            
            await Attendance.findOneAndUpdate(
                { userRefId: record.userRefId, date: exactDate },
                {
                    userRole: record.userRole,
                    course: record.course || course,
                    status: record.status
                },
                { upsert: true }
            );
        }
        res.redirect(redirectUrl);
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(PORT, () => console.log(`Portal online: http://localhost:${PORT}/login`));