const request = require('supertest');

const app = require('../app');
const City = require('../models/city');
const { createState, createCity, createUser } = require('./helpers/factories');

describe('States', () => {
    it('GET /api/common/state returns an empty array when there are none', async () => {
        const res = await request(app).get('/api/common/state');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('POST /api/common/state creates a state that then appears in the list', async () => {
        const created = await request(app).post('/api/common/state').send({ name: 'Kerala' });
        expect(created.status).toBe(201);

        const res = await request(app).get('/api/common/state');
        expect(res.body).toHaveLength(1);
        expect(res.body[0].name).toBe('Kerala');
        expect(res.body[0].is_active).toBe(true);
    });

    it('excludes inactive states from the list', async () => {
        await createState({ name: 'Active State' });
        await createState({ name: 'Retired State', is_active: false });

        const res = await request(app).get('/api/common/state');

        expect(res.body).toHaveLength(1);
        expect(res.body[0].name).toBe('Active State');
    });

    it('rejects a duplicate state name with 409, sending exactly one response', async () => {
        await request(app).post('/api/common/state').send({ name: 'Goa' });
        const res = await request(app).post('/api/common/state').send({ name: 'Goa' });

        // The original had no `else` on the error branch, so this path used to
        // send a response twice and throw ERR_HTTP_HEADERS_SENT.
        expect(res.status).toBe(409);
        expect(res.body.message).toBe('name already exists');
    });
});

describe('Cities', () => {
    it('POST /api/common/cities creates a city under a state', async () => {
        const state = await createState();

        const created = await request(app)
            .post('/api/common/cities')
            .send({ name: 'Kochi', state_id: state._id.toString() });

        expect(created.status).toBe(201);
        expect(created.body.message).toBe('City added successfully');
        expect(await City.countDocuments()).toBe(1);
    });

    it('GET /api/common/cities populates the parent state name', async () => {
        const state = await createState({ name: 'Tamil Nadu' });
        await createCity({ name: 'Chennai', state_id: state._id });

        const res = await request(app).get('/api/common/cities');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].state_id.name).toBe('Tamil Nadu');
    });

    it('excludes inactive cities', async () => {
        await createCity({ name: 'Live City' });
        await createCity({ name: 'Dead City', is_active: false });

        const res = await request(app).get('/api/common/cities');

        expect(res.body.map((c) => c.name)).toEqual(['Live City']);
    });

    it('GET /api/common/cities/:state_id returns only that state\'s cities', async () => {
        const [stateA, stateB] = await Promise.all([createState(), createState()]);
        await createCity({ name: 'In A', state_id: stateA._id });
        await createCity({ name: 'In B', state_id: stateB._id });

        const res = await request(app).get(`/api/common/cities/${stateA._id}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].name).toBe('In A');
    });

    it('GET /api/common/cities/:state_id rejects a malformed id with 400, not a 500', async () => {
        const res = await request(app).get('/api/common/cities/not-an-object-id');

        expect(res.status).toBe(400);
    });

    it('DELETE /api/common/city/:cityId removes the city', async () => {
        const city = await createCity();

        const res = await request(app).delete(`/api/common/city/${city._id}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('City removed successfully');
        expect(await City.countDocuments()).toBe(0);
    });

    it('DELETE returns 404 for a city that does not exist', async () => {
        // `Model.remove()` was removed in Mongoose 7; this route used to throw.
        const res = await request(app).delete('/api/common/city/507f1f77bcf86cd799439011');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('City not found');
    });

    it('DELETE returns 400 for a malformed id', async () => {
        const res = await request(app).delete('/api/common/city/nonsense');

        expect(res.status).toBe(400);
    });
});

describe('GET /api/common/checkemail-availability/email/:email', () => {
    it('reports true when the email is already registered', async () => {
        await createUser({ email: 'taken@example.com' });

        const res = await request(app)
            .get('/api/common/checkemail-availability/email/taken@example.com');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ response: true });
    });

    it('reports false when the email is free', async () => {
        const res = await request(app)
            .get('/api/common/checkemail-availability/email/free@example.com');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ response: false });
    });

    it('is exact, not a prefix match', async () => {
        await createUser({ email: 'someone@example.com' });

        const res = await request(app)
            .get('/api/common/checkemail-availability/email/some@example.com');

        expect(res.body).toEqual({ response: false });
    });
});
