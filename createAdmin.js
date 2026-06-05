const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// THE BLOCK-BUSTER CONNECTION STRING
mongoose.connect('mongodb://admin:smartcampus2026@ac-qgovwo3-shard-00-00.gfpyqk8.mongodb.net:27017,ac-qgovwo3-shard-00-01.gfpyqk8.mongodb.net:27017,ac-qgovwo3-shard-00-02.gfpyqk8.mongodb.net:27017/smartcampus?ssl=true&replicaSet=atlas-ojmqog-shard-0&authSource=admin&appName=Cluster0', {
    family: 4, // Forces standard IPv4
    serverSelectionTimeoutMS: 5000
})
    .then(() => console.log('Successfully connected to MongoDB Cloud!'))
    .catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
    role: String, username: String, password: String, name: String, recoveryPin: String,
    marks: { math: Number, science: Number }, attendance: Number, fees: String
});

const User = mongoose.model('User', userSchema);

async function createMasterAdmin() {
    try {
        const existingAdmin = await User.findOne({ username: 'admin' });
        if (existingAdmin) {
            console.log("Admin account already exists in the cloud!");
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash('123', 10);
        const adminUser = new User({
            role: 'admin',
            name: 'Master Administrator',
            username: 'admin',
            password: hashedPassword,
            recoveryPin: '9999'
        });

        await adminUser.save();
        console.log("Success! Secure Admin account created in the cloud database.");
        process.exit(0);
    } catch (error) {
        console.error("Error creating admin:", error);
        process.exit(1);
    }
}

createMasterAdmin();