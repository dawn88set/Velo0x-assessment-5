const helpers = require('../providers/helper');
const { getBucket } = require('../providers/gridfs');
const propertyType = require('../models/propertyTypes');
const Property = require('../models/property');
const status = require('../constants/httpStatus');
const { PROPERTY } = require('../constants/messages');
const { PROPERTY_IMAGE_PATH } = require('../constants/domain');

// Mongoose 7 removed callback support from queries, so every handler here is
// promise-based. Validation/cast failures are surfaced as 400s.

const POPULATE_REFS = [
    { path: 'city', select: 'name' },
    { path: 'state', select: 'name' },
    { path: 'type', select: 'title' },
];

module.exports = {
    propertyTypeList: async (req, res, next) => {
        try {
            const result = await propertyType.find({ is_active: true });
            res.status(status.OK).json(result);
        } catch (err) {
            next(err);
        }
    },

    addPropertyType: async (req, res, next) => {
        try {
            const proptyp = new propertyType({
                title: req.body.title,
                type: req.body.type,
                createdOn: Date.now(),
            });

            const result = await proptyp.save();
            res.status(status.CREATED).json({
                message: PROPERTY.TYPE_CREATED,
                id: result._id,
            });
        } catch (err) {
            next(err);
        }
    },

    addNewProperty: async (req, res, next) => {
        try {
            const imgs = (req.files || [])
                .map((file) => file.filename)
                .filter(Boolean);

            const payload = { ...req.body };

            payload.slug = await helpers.slugGenerator(payload.title, 'title', 'property');
            payload.type = payload.Proptype;
            payload.cornrPlot = Boolean(payload.cornrPlot);
            payload.images = imgs;
            payload.imgPath = PROPERTY_IMAGE_PATH;

            if (!payload.isSociety) {
                payload.flatNo = '';
                payload.societyName = '';
            }

            const result = await new Property(payload).save();

            res.status(status.CREATED).json({
                result,
                message: PROPERTY.CREATED,
            });
        } catch (err) {
            next(err);
        }
    },

    getUserList: async (req, res, next) => {
        try {
            const result = await Property
                .find({ isActive: true, userId: req.params.userId })
                .populate(POPULATE_REFS);
            res.status(status.OK).json(result);
        } catch (err) {
            next(err);
        }
    },

    getFullList: async (req, res, next) => {
        try {
            const result = await Property
                .find({ isActive: true })
                .populate(POPULATE_REFS)
                .populate('userId', 'fname lname');
            res.status(status.OK).json(result);
        } catch (err) {
            next(err);
        }
    },

    getSingleProperty: async (req, res, next) => {
        try {
            const result = await Property
                .findOne({ slug: req.params.propertySlug })
                .populate(POPULATE_REFS);

            // A missing property is a 404, not the blanket 400 the original returned.
            if (!result) {
                return res.status(status.NOT_FOUND).json({ message: PROPERTY.NOT_FOUND });
            }

            let files = [];
            const bucket = getBucket();
            if (bucket && result.images && result.images.length) {
                files = await bucket.find({ filename: { $in: result.images } }).toArray();
            }

            res.status(status.OK).json({ result, files });
        } catch (err) {
            next(err);
        }
    },

    markAsSold: async (req, res, next) => {
        try {
            // Was `Property.update(...)` + `result.nModified`. `update()` was removed in
            // Mongoose 7 and `nModified` was renamed `modifiedCount` in Mongoose 6, so
            // this endpoint could never succeed.
            const result = await Property.updateOne(
                { slug: req.params.propertySlug },
                { status: req.body.status, updatedOn: Date.now() },
                { runValidators: true },
            );

            if (result.matchedCount === 0) {
                return res.status(status.NOT_FOUND).json({ message: PROPERTY.NOT_FOUND });
            }

            res.status(status.OK).json({
                result,
                message: PROPERTY.UPDATED,
            });
        } catch (err) {
            next(err);
        }
    },

    filterProperties: async (req, res, next) => {
        try {
            const query = {};
            const csv = (value) => value.split(',').map((v) => v.trim()).filter(Boolean);

            if (req.query.propertyFor) query.propertyFor = { $in: csv(req.query.propertyFor) };
            if (req.query.type) query.type = { $in: csv(req.query.type) };
            if (req.query.city) query.city = { $in: csv(req.query.city) };
            if (req.query.userId) query.userId = req.query.userId;
            if (req.query.notUserId) query.userId = { $ne: req.query.notUserId };
            if (req.query.status) query.status = { $in: csv(req.query.status) };

            const result = await Property
                .find(query)
                .populate(POPULATE_REFS)
                .populate('userId', 'fname lname');

            res.status(status.OK).json(result);
        } catch (err) {
            next(err);
        }
    },

    showGFSImage: async (req, res, next) => {
        try {
            const bucket = getBucket();
            if (!bucket) {
                return res.status(status.SERVICE_UNAVAILABLE).json({ message: PROPERTY.STORAGE_UNAVAILABLE });
            }

            const [file] = await bucket.find({ filename: req.params.filename }).toArray();

            if (!file) {
                return res.status(status.NOT_FOUND).json({ message: PROPERTY.FILE_NOT_FOUND });
            }

            if (file.contentType !== 'image/jpeg' && file.contentType !== 'image/png') {
                return res.status(status.UNSUPPORTED_MEDIA_TYPE).json({ message: PROPERTY.NOT_AN_IMAGE });
            }

            res.set('Content-Type', file.contentType);
            bucket.openDownloadStreamByName(file.filename)
                .on('error', next)
                .pipe(res);
        } catch (err) {
            next(err);
        }
    },
};
