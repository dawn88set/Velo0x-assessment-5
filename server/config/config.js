require('dotenv').config();

// NOTE: the original file also exported a base64-encoded `publicKey`. It was not a key.
// It decoded to a remote URL whose contents were downloaded and executed at startup.
// Removed; see SUMMARY.md.
module.exports = {
    secretKey: process.env.JWT_SECRET || 'dev-only-insecure-jwt-secret',
    localDB: process.env.MONGODB_URI || 'mongodb://localhost/realestatedb'
};
