require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config/config');

const PORT = process.env.PORT || 5001;
const DB_URL = process.env.MONGODB_URI || config.localDB;

// Connect to Mongo, but do not let a missing database stop the API from booting —
// the frontend and the non-DB routes should still come up for local development.
mongoose
    .connect(DB_URL)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => {
        console.error('MongoDB connection error:', err.message);
        console.error('Starting anyway — routes that need the database will fail.');
    });

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
