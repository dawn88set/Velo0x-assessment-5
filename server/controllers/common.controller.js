const mongoose = require('mongoose');
const state_model = require('../models/state');
const city_model = require('../models/city');
const users = require('../models/users');
const status = require('../constants/httpStatus');
const { COMMON } = require('../constants/messages');

// The original handlers used the Mongoose callback API (removed in Mongoose 7) and,
// on the error path, called res.status(400).send(err) *without* an `else` — so the
// success response was sent too, throwing ERR_HTTP_HEADERS_SENT. Both are fixed by
// moving to async/await with a single response per path.

module.exports = {
    // STATES
    getStateList: async (req, res, next) => {
        try {
            const data = await state_model.find({ is_active: true });
            res.status(status.OK).json(data);
        } catch (err) {
            next(err);
        }
    },

    addState: async (req, res, next) => {
        try {
            const state = new state_model({ name: req.body.name });
            await state.save();
            res.status(status.CREATED).json({ message: COMMON.STATE_CREATED });
        } catch (err) {
            next(err);
        }
    },

    // CITIES
    getAllCities: async (req, res, next) => {
        try {
            const data = await city_model
                .find({ is_active: true })
                .populate('state_id', 'name');
            res.status(status.OK).json(data);
        } catch (err) {
            next(err);
        }
    },

    getCityList: async (req, res, next) => {
        try {
            if (!mongoose.isValidObjectId(req.params.state_id)) {
                return res.status(status.BAD_REQUEST).json({ message: COMMON.INVALID_STATE_ID });
            }

            const data = await city_model
                .find({ state_id: req.params.state_id, is_active: true })
                .populate('state_id', 'name');
            res.status(status.OK).json(data);
        } catch (err) {
            next(err);
        }
    },

    addCity: async (req, res, next) => {
        try {
            const city = new city_model(req.body);
            await city.save();
            res.status(status.CREATED).json({ message: COMMON.CITY_CREATED });
        } catch (err) {
            next(err);
        }
    },

    removeCity: async (req, res, next) => {
        try {
            if (!mongoose.isValidObjectId(req.params.cityId)) {
                return res.status(status.BAD_REQUEST).json({ message: COMMON.INVALID_CITY_ID });
            }

            // `Model.remove()` was removed in Mongoose 7.
            const result = await city_model.deleteOne({ _id: req.params.cityId });

            if (result.deletedCount === 0) {
                return res.status(status.NOT_FOUND).json({ message: COMMON.CITY_NOT_FOUND });
            }

            res.status(status.OK).json({ message: COMMON.CITY_REMOVED, data: result });
        } catch (err) {
            next(err);
        }
    },

    // checkemailAvailability
    checkemailAvailability: async (req, res, next) => {
        try {
            const existing = await users.exists({ email: req.params.email });
            res.status(status.OK).json({ response: Boolean(existing) });
        } catch (err) {
            next(err);
        }
    },
};
