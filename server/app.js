const express = require('express');
const path = require('path');
const cors = require('cors');

const { notFound, errorHandler } = require('./middleware/errorHandler');

// Routers
const users = require('./routes/users');
const auth = require('./routes/auth');
const common = require('./routes/common');
const property = require('./routes/property');
const email = require('./routes/email');

const app = express();

const corsOptions = {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Body parsers. These were commented out in the original, which meant every
// POST/PUT handler read `req.body` as undefined.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => { res.status(200).send('Success'); });

// Routes
app.use('/api/user', users);
app.use('/api/auth', auth);
app.use('/api/common', common);
app.use('/api/property', property);
app.use('/api/email', email);

// Must be last: 404 -> central error handler.
app.use(notFound);
app.use(errorHandler);

// Exported without listening so tests can drive it with supertest.
// The listening entrypoint is server/index.js.
module.exports = app;
