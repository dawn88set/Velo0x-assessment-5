const mongoose = require('mongoose');
const users = require('../models/users');

module.exports = {
    getUserDetails: async (req, res, next) => {
        try {
            // A malformed id used to throw an unhandled CastError; a missing user used
            // to return 200 with an empty body. Both are answered properly now.
            if (!mongoose.isValidObjectId(req.params.userId)) {
                return res.status(400).json({ message: 'Invalid user id' });
            }

            const result = await users
                .findById(req.params.userId)
                .select('-password') // never ship the password hash to a client
                .populate('city', 'name')
                .populate('state', 'name');

            if (!result) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.status(200).json(result);
        } catch (err) {
            next(err);
        }
    },
};
