const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// SendGrid must never be reached from a test. Mocked globally rather than
// per-file so a new suite can't accidentally make a real API call.
jest.mock('@sendgrid/mail', () => ({
    setApiKey: jest.fn(),
    send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

// Each test starts from an empty database. Deleting documents is much faster
// than dropping collections, which would also drop the unique indexes the
// registration tests rely on.
afterEach(async () => {
    const { collections } = mongoose.connection;
    await Promise.all(
        Object.values(collections).map((collection) => collection.deleteMany({})),
    );
    jest.clearAllMocks();
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});
