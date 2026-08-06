var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const { PROPERTY_CATEGORY } = require('../constants/domain');

const propertyTypesSchema = new Schema({
    title: {
        type: String
    },
    type: {
        type: String,
        required: true,
        enum: Object.values(PROPERTY_CATEGORY)
    },
    is_active: {
        type: Boolean,
        default: true
    },
    updatedOn: {
        type: Date,
        default: Date.now
    },
    createdOn: {
        type: Date
    }
});

module.exports = mongoose.model('propertyTypes', propertyTypesSchema);
