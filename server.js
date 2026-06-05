const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');
const multer = require('multer'); 
const app = express();

const PORT = process.env.PORT || 3000;

// Set payload limits higher so large PDFs can be processed
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// THE BLOCK-BUSTER CONNECTION STRING
mongoose.connect('mongodb://admin:smartcampus2026@ac-qgovwo3-shard-00-00.gfpyqk8.mongodb.net:27017,ac-qgovwo3-shard-00-01.gfpyqk8.mongodb.net:27017,ac-qgovwo3-shard-00-02.gfpyqk8.mongodb.net:27017/smartcampus?ssl=true&replicaSet=atlas-ojmqog-shard-0&authSource=admin&appName=Cluster0', {
    family: 4, 
    serverSelectionTimeoutMS: 5000
})
.then(() => console.log('Successfully connected to MongoDB Cloud!'))
.catch(err => console.error('MongoDB connection error:', err));

// --- Database Blueprints (Schemas) ---
const userSchema = new mongoose.Schema({
    role: String, username: String, password: String, name: String, recoveryPin: String,
    marks: { math: Number, science: Number }, attendance: Number, fees: String
});
const eventSchema = new mongoose.Schema({ title: String, date: String });

// NEW: File Schema now stores the actual raw file data!
const fileSchema = new mongoose.Schema({
    title: String,
    filename: String,
    contentType: String, // e.g., 'application/pdf'
    fileData: String,    // The massive Base64 text string
    uploadedBy: String,
    uploadDate: String
});

const User = mongoose.model('User', userSchema);
const Event = mongoose.model('Event', eventSchema);
const CampusFile = mongoose.model('CampusFile', fileSchema);

// NEW: Setup Multer to store in server Memory instead of local Disk
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

// --- API Endpoints ---
app.post('/api/login', async (req, res) => {
    const { role, username, password } = req.body;
    try {
        const user = await User.findOne({ role: role, username: username });
        if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) res.json({ success: true, user: user });
        else res.status(401).json({ success: false, message: "Invalid credentials" });
    } catch (error) { res.status(500).json({ success: false, message: "Server error" }); }
});

app.post('/api/reset-password', async (req, res) => {
    const { role, username, recoveryPin, newPassword } = req.body;
    try {
        const user = await User.findOne({ role: role, username: username });
        if (!user) return res.status(404).json({ success: false, message: "Account not found." });
        if (user.recoveryPin !== recoveryPin) return res.status(403).json({ success: false, message: "ACCESS DENIED" });
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ success: true, message: "Password updated successfully!" });
    } catch (error) { res.status(500).json({ success: false, message: "Server error" }); }
});

app.post('/api/students', async (req, res) => {
    const { name, username, password, recoveryPin } = req.body;
    try {
        if (await User.findOne({ username })) return res.status(400).json({ success: false, message: "Username exists!" });
        const newStudent = new User({
            role: 'student', name, username, password: await bcrypt.hash(password, 10), recoveryPin,
            marks: { math: 0, science: 0 }, attendance: 0, fees: 'Pending'
        });
        await newStudent.save();
        res.json({ success: true, message: "Student created!" });
    } catch (error) { res.status(500).json({ success: false, message: "Server error" }); }
});

app.post('/api/teachers', async (req, res) => {
    const { name, username, password, recoveryPin } = req.body;
    try {
        if (await User.findOne({ username })) return res.status(400).json({ success: false, message: "Username exists!" });
        const newTeacher = new User({ role: 'teacher', name, username, password: await bcrypt.hash(password, 10), recoveryPin });
        await newTeacher.save();
        res.json({ success: true, message: "Teacher created!" });
    } catch (error) { res.status(500).json({ success: false, message: "Server error" }); }
});

app.get('/api/students', async (req, res) => { res.json(await User.find({ role: 'student' })); });
app.get('/api/teachers', async (req, res) => { res.json(await User.find({ role: 'teacher' })); });

app.put('/api/students/:id', async (req, res) => {
    await User.findByIdAndUpdate(req.params.id, req.body);
    res.json({ success: true, message: "Updated!" });
});

app.delete('/api/users/:id', async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted!" });
});

app.get('/api/events', async (req, res) => { res.json(await Event.find()); });

app.post('/api/events', async (req, res) => {
    await new Event({ title: req.body.title, date: req.body.date }).save();
    res.json({ success: true, message: "Event added!" });
});

// --- CLOUD LMS FILE STORAGE ROUTES ---

// 1. Upload to MongoDB
app.post('/api/upload', upload.single('studyMaterial'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file was received." });
        
        // Convert the physical file into a Base64 text string
        const base64String = req.file.buffer.toString('base64');

        const newFile = new CampusFile({
            title: req.body.title,
            filename: req.file.originalname,
            contentType: req.file.mimetype,
            fileData: base64String, // Save the massive string to the database!
            uploadedBy: req.body.uploaderName || "Unknown Teacher",
            uploadDate: new Date().toLocaleDateString()
        });
        
        await newFile.save();
        res.json({ success: true, message: "File securely uploaded to cloud database!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Database error: " + error.message });
    }
});

// 2. Fetch the list of files (Without the massive fileData, otherwise the app crashes)
app.get('/api/files', async (req, res) => {
    try { 
        // .select('-fileData') means "Give me everything EXCEPT the heavy file data"
        const files = await CampusFile.find().select('-fileData');
        res.json(files); 
    } 
    catch (error) { res.status(500).json({ message: "Server error fetching file list" }); }
});

// 3. Download the specific file directly from MongoDB
app.get('/api/download/:id', async (req, res) => {
    try {
        const file = await CampusFile.findById(req.params.id);
        if (!file) return res.status(404).send("File not found in database.");

        // Convert the Base64 text string BACK into a physical file
        const fileBuffer = Buffer.from(file.fileData, 'base64');

        // Tell the browser to download it
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.send(fileBuffer);
    } catch (error) {
        res.status(500).send("Server error generating file download.");
    }
});

app.delete('/api/files/:id', async (req, res) => {
    try {
        await CampusFile.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "File deleted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error deleting file." });
    }
});

app.listen(PORT, () => {
    console.log(`SmartCampus running at http://localhost:${PORT}`);
});