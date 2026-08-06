/**
 * Domain enums.
 *
 * The schemas derive their `enum` from these via `Object.values(...)`, and the
 * tests import them instead of re-typing `'sold'` / `'residential'`. Declaring
 * them once is what stops a schema and its tests drifting apart.
 */

const PROPERTY_STATUS = {
    AVAILABLE: 'available',
    SOLD: 'sold',
    RENTED: 'rented',
    EXPIRED: 'expired',
};

const PROPERTY_FOR = {
    SELL: 'sell',
    RENT: 'rent',
};

const PROPERTY_CATEGORY = {
    RESIDENTIAL: 'residential',
    COMMERCIAL: 'commercial',
    AGRICULTURAL: 'agricultural',
};

/** GridFS bucket holding property images. */
const IMAGE_BUCKET = 'imageMeta';

/** Value stored on `property.imgPath`. */
const PROPERTY_IMAGE_PATH = 'properties';

module.exports = {
    PROPERTY_STATUS,
    PROPERTY_FOR,
    PROPERTY_CATEGORY,
    IMAGE_BUCKET,
    PROPERTY_IMAGE_PATH,
};
