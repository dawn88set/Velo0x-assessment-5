const request = require('supertest');

const app = require('../app');
const Property = require('../models/property');
const PropertyType = require('../models/propertyTypes');
const { PROPERTY } = require('../constants/messages');
const {
    createState,
    createCity,
    createPropertyType,
    createUser,
    createProperty,
    buildPropertyPayload,
} = require('./helpers/factories');
const { PROPERTY_STATUS, PROPERTY_FOR, PROPERTY_CATEGORY } = require('../constants/domain');

/** Body for POST /api/property/new, wired to real reference documents. */
async function newPropertyBody(overrides = {}) {
    const [user, city, state, type] = await Promise.all([
        createUser(), createCity(), createState(), createPropertyType(),
    ]);
    return buildPropertyPayload({
        userId: user._id.toString(),
        city: city._id.toString(),
        state: state._id.toString(),
        Proptype: type._id.toString(), // the controller maps Proptype -> type
        ...overrides,
    });
}

describe('Property types', () => {
    it('GET /api/property/type returns an empty list initially', async () => {
        const res = await request(app).get('/api/property/type');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('POST /api/property/type creates a type', async () => {
        const res = await request(app)
            .post('/api/property/type')
            .send({ title: 'Villa', type: PROPERTY_CATEGORY.RESIDENTIAL });

        expect(res.status).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(await PropertyType.countDocuments()).toBe(1);
    });

    it('rejects a type outside the schema enum with 400', async () => {
        const res = await request(app)
            .post('/api/property/type')
            .send({ title: 'Spaceship', type: 'orbital' });

        expect(res.status).toBe(400);
        expect(await PropertyType.countDocuments()).toBe(0);
    });

    it('excludes inactive types from the list', async () => {
        await createPropertyType({ title: 'Live' });
        await createPropertyType({ title: 'Retired', is_active: false });

        const res = await request(app).get('/api/property/type');

        expect(res.body.map((t) => t.title)).toEqual(['Live']);
    });
});

describe('POST /api/property/new', () => {
    it('creates a property and generates a slug from the title', async () => {
        const body = await newPropertyBody({ title: 'Luxury Villa' });

        const res = await request(app).post('/api/property/new').send(body);

        expect(res.status).toBe(201);
        expect(res.body.message).toBe(PROPERTY.CREATED);
        expect(res.body.result.slug).toBe('luxury-villa');
    });

    it('increments the slug when the title collides', async () => {
        const first = await newPropertyBody({ title: 'Luxury Villa' });
        const second = await newPropertyBody({ title: 'Luxury Villa' });
        const third = await newPropertyBody({ title: 'Luxury Villa' });

        const a = await request(app).post('/api/property/new').send(first);
        const b = await request(app).post('/api/property/new').send(second);
        const c = await request(app).post('/api/property/new').send(third);

        expect(a.body.result.slug).toBe('luxury-villa');
        expect(b.body.result.slug).toBe('luxury-villa-1');
        expect(c.body.result.slug).toBe('luxury-villa-2');
    });

    it('strips punctuation the slug generator is meant to remove', async () => {
        const body = await newPropertyBody({ title: 'Grand, "Sunny" Home!' });

        const res = await request(app).post('/api/property/new').send(body);

        expect(res.body.result.slug).toBe('grand-sunny-home');
    });

    it('rejects a payload missing required fields with 400', async () => {
        const body = await newPropertyBody({ locality: undefined, address: undefined });

        const res = await request(app).post('/api/property/new').send(body);

        expect(res.status).toBe(400);
        expect(await Property.countDocuments()).toBe(0);
    });

    it('blanks society fields when isSociety is falsy', async () => {
        const body = await newPropertyBody({ societyName: 'Palm Grove', flatNo: 'A-1' });

        const res = await request(app).post('/api/property/new').send(body);

        expect(res.status).toBe(201);
        expect(res.body.result.societyName).toBe('');
        expect(res.body.result.flatNo).toBe('');
    });

    it('defaults status to available and isActive to true', async () => {
        const body = await newPropertyBody();

        const res = await request(app).post('/api/property/new').send(body);

        expect(res.body.result.status).toBe(PROPERTY_STATUS.AVAILABLE);
        expect(res.body.result.isActive).toBe(true);
    });
});

describe('GET /api/property/list', () => {
    it('returns active properties with city, state and type populated', async () => {
        const state = await createState({ name: 'Kerala' });
        const city = await createCity({ name: 'Kochi', state_id: state._id });
        const type = await createPropertyType({ title: 'Villa' });
        await createProperty({ city: city._id, state: state._id, type: type._id });

        const res = await request(app).get('/api/property/list/');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].city.name).toBe('Kochi');
        expect(res.body[0].state.name).toBe('Kerala');
        expect(res.body[0].type.title).toBe('Villa');
    });

    it('excludes inactive properties', async () => {
        await createProperty({ title: 'Listed' });
        await createProperty({ title: 'Withdrawn', isActive: false });

        const res = await request(app).get('/api/property/list/');

        expect(res.body.map((p) => p.title)).toEqual(['Listed']);
    });

    it('GET /list/:userId scopes results to one owner', async () => {
        const [owner, other] = await Promise.all([createUser(), createUser()]);
        await createProperty({ userId: owner._id, title: 'Mine' });
        await createProperty({ userId: other._id, title: 'Theirs' });

        const res = await request(app).get(`/api/property/list/${owner._id}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Mine');
    });
});

describe('GET /api/property/single/:propertySlug', () => {
    it('returns the property with references populated', async () => {
        const state = await createState({ name: 'Goa' });
        await createProperty({ slug: 'beach-house', state: state._id });

        const res = await request(app).get('/api/property/single/beach-house');

        expect(res.status).toBe(200);
        expect(res.body.result.slug).toBe('beach-house');
        expect(res.body.result.state.name).toBe('Goa');
        expect(res.body.files).toEqual([]);
    });

    it('returns 404 for an unknown slug', async () => {
        // The original threw 'Something Went Wrong' and answered 400 here.
        const res = await request(app).get('/api/property/single/no-such-property');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe(PROPERTY.NOT_FOUND);
    });
});

describe('POST /api/property/markAsSold/:propertySlug', () => {
    it('updates the status (regression: update()/nModified made this always fail)', async () => {
        await createProperty({ slug: 'sold-me', status: PROPERTY_STATUS.AVAILABLE });

        const res = await request(app)
            .post('/api/property/markAsSold/sold-me')
            .send({ status: PROPERTY_STATUS.SOLD });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe(PROPERTY.UPDATED);

        const stored = await Property.findOne({ slug: 'sold-me' });
        expect(stored.status).toBe(PROPERTY_STATUS.SOLD);
    });

    it('returns 404 when the slug matches nothing', async () => {
        const res = await request(app)
            .post('/api/property/markAsSold/not-a-property')
            .send({ status: PROPERTY_STATUS.SOLD });

        expect(res.status).toBe(404);
    });

    it('rejects a status outside the schema enum', async () => {
        await createProperty({ slug: 'enum-check' });

        const res = await request(app)
            .post('/api/property/markAsSold/enum-check')
            .send({ status: 'teleported' });

        expect(res.status).toBe(400);
        const stored = await Property.findOne({ slug: 'enum-check' });
        expect(stored.status).toBe(PROPERTY_STATUS.AVAILABLE);
    });
});

describe('GET /api/property/filter', () => {
    it('filters by propertyFor', async () => {
        await createProperty({ title: 'For Sale', propertyFor: PROPERTY_FOR.SELL });
        await createProperty({ title: 'For Rent', propertyFor: PROPERTY_FOR.RENT });

        const res = await request(app).get('/api/property/filter?propertyFor=rent');

        expect(res.status).toBe(200);
        expect(res.body.map((p) => p.title)).toEqual(['For Rent']);
    });

    it('accepts a comma-separated list as an $in query', async () => {
        await createProperty({ title: 'Sale', propertyFor: PROPERTY_FOR.SELL });
        await createProperty({ title: 'Rent', propertyFor: PROPERTY_FOR.RENT });

        const res = await request(app).get('/api/property/filter?propertyFor=sell,rent');

        expect(res.body).toHaveLength(2);
    });

    it('filters by city', async () => {
        const [cityA, cityB] = await Promise.all([createCity(), createCity()]);
        await createProperty({ title: 'In A', city: cityA._id });
        await createProperty({ title: 'In B', city: cityB._id });

        const res = await request(app).get(`/api/property/filter?city=${cityA._id}`);

        expect(res.body.map((p) => p.title)).toEqual(['In A']);
    });

    it('filters by status', async () => {
        await createProperty({ title: 'Available', status: PROPERTY_STATUS.AVAILABLE });
        await createProperty({ title: 'Sold', status: PROPERTY_STATUS.SOLD });

        const res = await request(app).get('/api/property/filter?status=sold');

        expect(res.body.map((p) => p.title)).toEqual(['Sold']);
    });

    it('notUserId excludes one owner', async () => {
        const [me, someoneElse] = await Promise.all([createUser(), createUser()]);
        await createProperty({ userId: me._id, title: 'Mine' });
        await createProperty({ userId: someoneElse._id, title: 'Theirs' });

        const res = await request(app).get(`/api/property/filter?notUserId=${me._id}`);

        expect(res.body.map((p) => p.title)).toEqual(['Theirs']);
    });

    it('returns everything when no filter is supplied', async () => {
        await createProperty();
        await createProperty();

        const res = await request(app).get('/api/property/filter');

        expect(res.body).toHaveLength(2);
    });
});

describe('GET /api/property/showGFSImage/:filename', () => {
    it('404s for a filename that is not in GridFS', async () => {
        const res = await request(app).get('/api/property/showGFSImage/missing.png');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe(PROPERTY.FILE_NOT_FOUND);
    });
});
