const request = require('supertest');

const app = require('../app');
const { createUser, createCity, createState } = require('./helpers/factories');

describe('GET /api/user/:userId', () => {
    it('returns the user with city and state populated', async () => {
        const state = await createState({ name: 'Maharashtra' });
        const city = await createCity({ name: 'Pune', state_id: state._id });
        const user = await createUser({ city: city._id, state: state._id });

        const res = await request(app).get(`/api/user/${user._id}`);

        expect(res.status).toBe(200);
        expect(res.body.fname).toBe('Ada');
        expect(res.body.city.name).toBe('Pune');
        expect(res.body.state.name).toBe('Maharashtra');
    });

    it('never exposes the password hash', async () => {
        const user = await createUser();

        const res = await request(app).get(`/api/user/${user._id}`);

        expect(res.status).toBe(200);
        expect(res.body.password).toBeUndefined();
    });

    it('returns 404 for a well-formed id that matches nothing', async () => {
        // The original returned 200 with an empty body here.
        const res = await request(app).get('/api/user/507f1f77bcf86cd799439011');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('User not found');
    });

    it('returns 400 for a malformed id rather than throwing a CastError', async () => {
        const res = await request(app).get('/api/user/not-a-valid-id');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid user id');
    });
});
