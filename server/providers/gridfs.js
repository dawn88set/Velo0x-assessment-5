const mongoose = require('mongoose');

const { IMAGE_BUCKET } = require('../constants/domain');

let bucket = null;

/**
 * Lazily returns a GridFSBucket for property images, or null when there is no
 * database connection yet.
 *
 * The original code used `new mongoose.mongo.GridFsStorage(...)` (routes/property.js)
 * and `gridfs-stream` (property.controller.js). `GridFsStorage` does not exist on the
 * mongo driver at all, and `gridfs-stream` targets driver 2.x, so both throw under
 * Mongoose 8. `GridFSBucket` is the supported replacement.
 */
function getBucket() {
    if (bucket) return bucket;

    const conn = mongoose.connection;
    // 1 === connected
    if (conn.readyState !== 1 || !conn.db) return null;

    bucket = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: IMAGE_BUCKET });
    return bucket;
}

// Drop the cached bucket when the connection goes away, otherwise it would keep
// pointing at a closed db handle (this matters for the test suite, which spins the
// connection up and down).
mongoose.connection.on('disconnected', () => { bucket = null; });

module.exports = { getBucket };
