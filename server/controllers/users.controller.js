const mongoose = require('mongoose');

const users = require('../models/users');
const status = require('../constants/httpStatus');
const { USER } = require('../constants/messages');

module.exports = {
    getUserDetails: async (req, res, next) => {
        try {
            // A malformed id used to throw an unhandled CastError; a missing user
            // used to return 200 with an empty body. Both are answered properly now.
            if (!mongoose.isValidObjectId(req.params.userId)) {
                return res.status(status.BAD_REQUEST).json({ message: USER.INVALID_ID });
            }

            const result = await users
                .findById(req.params.userId)
                .select('-password') // never ship the password hash to a client
                .populate('city', 'name')
                .populate('state', 'name');

            if (!result) {
                return res.status(status.NOT_FOUND).json({ message: USER.NOT_FOUND });
            }

            return res.status(status.OK).json(result);
        } catch (err) {
            return next(err);
        }
    },
};
