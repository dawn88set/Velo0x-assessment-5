const State = require('../../models/state');
const City = require('../../models/city');
const PropertyType = require('../../models/propertyTypes');
const Property = require('../../models/property');
const User = require('../../models/users');
const { PROPERTY_FOR, PROPERTY_CATEGORY } = require('../../constants/domain');

/**
 * Builders for the reference documents most route tests need. Each accepts an
 * override object so a test can vary only the field it cares about.
 *
 * `state.name`, `city.name`, `users.email` and `users.phoneNo` all carry unique
 * indexes, so defaults are suffixed from a counter. Otherwise calling a factory
 * twice in one test would fail on a duplicate key rather than on the thing under
 * test. The counter resets per file, and setup.js empties the DB between tests.
 */
let seq = 0;
const next = () => ++seq;

const createState = (overrides = {}) =>
    State.create({ name: `State ${next()}`, ...overrides });

const createCity = async (overrides = {}) => {
    const stateId = overrides.state_id || (await createState())._id;
    return City.create({ name: `City ${next()}`, ...overrides, state_id: stateId });
};

const createPropertyType = (overrides = {}) =>
    PropertyType.create({ title: 'Apartment', type: PROPERTY_CATEGORY.RESIDENTIAL, ...overrides });

const createUser = (overrides = {}) => {
    const n = next();
    return User.create({
        fname: 'Ada',
        lname: 'Lovelace',
        email: `user${n}@example.com`,
        phoneNo: `98765${String(n).padStart(5, '0')}`,
        password: 'hashed-password-placeholder',
        ...overrides,
    });
};

/** A complete, schema-valid property body. Every `required` field is populated. */
const buildPropertyPayload = (overrides = {}) => ({
    title: 'Luxury Villa',
    propertyFor: PROPERTY_FOR.SELL,
    locality: 'Indiranagar',
    length: 40,
    breadth: 60,
    address: '12 MG Road',
    email: 'seller@example.com',
    phoneNo: '9876543210',
    pincode: '560001',
    price: 9500000,
    ...overrides,
});

/** Inserts a property directly, creating any missing references. */
const createProperty = async (overrides = {}) => {
    const userId = overrides.userId || (await createUser())._id;
    const city = overrides.city || (await createCity())._id;
    const state = overrides.state || (await createState())._id;
    const type = overrides.type || (await createPropertyType())._id;

    return Property.create({
        ...buildPropertyPayload(),
        slug: `luxury-villa-${next()}`,
        ...overrides,
        userId,
        city,
        state,
        type,
    });
};

/** Body for POST /api/auth/user/register. */
const buildRegistrationPayload = (overrides = {}) => ({
    fname: 'Grace',
    lname: 'Hopper',
    email: 'grace@example.com',
    phoneNo: '9998887777',
    password: 'sup3r-s3cret',
    pincode: 560001,
    ...overrides,
});

module.exports = {
    createState,
    createCity,
    createPropertyType,
    createUser,
    createProperty,
    buildPropertyPayload,
    buildRegistrationPayload,
};
