const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const http = require('http');
const bodyParser = require('body-parser');
const config = require('./config/config');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const corsOptions = {
    origin: 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
};

app.use(express.static(path.join(__dirname, 'uploads')));

app.use(cors(corsOptions));

// Routing
const users = require('./routes/users');
const auth = require('./routes/auth');
const common = require('./routes/common');
const property = require('./routes/property');
const email = require('./routes/email');

// Connect with DB
// const DB_URL = process.env.MLAB_DB_URL || config.localDB

// mongoose.connect(DB_URL)
//     .then(() => console.log("MongoDB connected"))
//     .catch(err => console.error("MongoDB connection error: ", err));

// configure app to use bodyParser()
// this will let us get the data from a POST
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json());
// use morgan to log requests to the console
// app.use(morgan('dev'));

//CORS
// app.use(function (req, res, next) {
//   res.header('Access-Control-Allow-Methods', 'GET,POST,PUT'); //,DELETE,OPTIONS
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// });

app.get('/', (req, res) => {res.status(200).send('Success');});

// Routes
app.use('/api/user', users);
app.use('/api/auth', auth);
app.use('/api/common', common);
app.use('/api/property', property);
app.use('/api/email', email);


const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});