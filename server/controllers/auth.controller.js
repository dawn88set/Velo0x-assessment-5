const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const userM = require('../models/users');
const { secretKey } = require('../config/config');
const status = require('../constants/httpStatus');
const { AUTH, USER } = require('../constants/messages');

const SALT_ROUNDS = 10;
const TOKEN_TTL = '1d';
const DUPLICATE_KEY = 11000;

module.exports = {
    userLogin: async (req, res, next) => {
        try {
            const { emailPhone, password } = req.body || {};

            // The original read req.body.emailPhone directly, which throws when no
            // body was sent (and the body parser was disabled, so that was every
            // request).
            if (!emailPhone || !password) {
                return res.status(status.BAD_REQUEST).json({ message: AUTH.MISSING_CREDENTIALS });
            }

            const loginType = isNaN(emailPhone) ? 'email' : 'phoneNo';
            const user = await userM.findOne({ [loginType]: emailPhone });

            const passMatch = user ? await bcrypt.compare(password, user.password) : false;

            // One response for both failures — see AUTH.INVALID_CREDENTIALS.
            if (!user || !passMatch) {
                return res.status(status.UNAUTHORIZED).json({ message: AUTH.INVALID_CREDENTIALS });
            }

            const jwtData = {
                _id: user._id,
                fname: user.fname,
                lname: user.lname,
                email: user.email,
                isAdmin: user.isAdmin,
            };

            const token = jwt.sign({ user: jwtData }, secretKey, { expiresIn: TOKEN_TTL });

            return res.status(status.OK).json({ message: AUTH.LOGIN_SUCCESS, token });
        } catch (err) {
            return next(err);
        }
    },

    userRegistration: async (req, res, next) => {
        try {
            const { password } = req.body || {};

            if (!password) {
                return res.status(status.BAD_REQUEST).json({ message: AUTH.MISSING_PASSWORD });
            }

            const hash = await bcrypt.hash(password, SALT_ROUNDS);

            // `users = new userM()` in the original was missing `var` — an implicit
            // global shared across concurrent requests.
            const user = new userM({
                fname: req.body.fname,
                // Was `req.body.lName`. `lname` is required by the schema, so with
                // that casing typo every registration failed validation.
                lname: req.body.lname,
                email: req.body.email,
                phoneNo: req.body.phoneNo,
                state: req.body.state,
                city: req.body.city,
                pincode: req.body.pincode,
                userType: req.body.user_type,
                password: hash,
                createdOn: new Date(),
            });

            const data = await user.save();

            return res.status(status.CREATED).json({ message: AUTH.REGISTERED, id: data._id });
        } catch (err) {
            if (err.code === DUPLICATE_KEY) {
                return res.status(status.CONFLICT).json({ message: AUTH.ALREADY_EXISTS });
            }
            return next(err);
        }
    },

    userList: async (req, res, next) => {
        try {
            const data = await userM.find().select('-password');
            return res.status(status.OK).json({ message: USER.LIST_SUCCESS, data });
        } catch (err) {
            return next(err);
        }
    },

    changePass: async (req, res, next) => {
        try {
            const { _id, password } = req.body || {};

            if (!_id || !password) {
                return res.status(status.BAD_REQUEST).json({ message: AUTH.MISSING_ID_OR_PASSWORD });
            }

            if (!mongoose.isValidObjectId(_id)) {
                return res.status(status.BAD_REQUEST).json({ message: USER.INVALID_ID });
            }

            const hash = await bcrypt.hash(password, SALT_ROUNDS);
            const result = await userM.updateOne({ _id }, { password: hash });

            if (result.matchedCount === 0) {
                return res.status(status.NOT_FOUND).json({ message: USER.NOT_FOUND });
            }

            return res.status(status.OK).json({ message: AUTH.PASSWORD_CHANGED, id: _id });
        } catch (err) {
            return next(err);
        }
    },
};
