const mongoose = require('mongoose');

// Connect to your database
mongoose.connect('mongodb://127.0.0.1:27017/smartcampus')
    .then(async () => {
        console.log("Connected to MongoDB!");

        // Tell the script what a User looks like
        const userSchema = new mongoose.Schema({
            role: String, username: String, password: String, 
            name: String, marks: { math: Number, science: Number }, 
            attendance: Number, fees: String
        });
        const User = mongoose.model('User', userSchema);

        // Create the new student data
        const newStudent = new User({
            role: 'student',
            username: 'student2',  // The new login username
            password: '123',       // The new login password
            name: 'Rahul Kumar',
            marks: { math: 0, science: 0 },
            attendance: 100,
            fees: 'Pending'
        });

        // Save it permanently to the hard drive
        await newStudent.save();
        console.log("Success! New student added to the database.");
        
        // Disconnect
        process.exit();
    })
    .catch(err => console.error(err));