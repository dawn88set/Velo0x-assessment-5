const request = require('supertest');
const app = require('../app');

describe('app wiring', () => {
    it('GET / responds 200 with Success', async () => {
        const res = await request(app).get('/');

        expect(res.status).toBe(200);
        expect(res.text).toBe('Success');
    });

    it('returns a JSON 404 from the notFound handler for an unknown route', async () => {
        const res = await request(app).get('/api/does-not-exist');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ message: 'Route Not Found' });
    });

    it('parses a JSON body (express.json was commented out in the original)', async () => {
        // If the body parser were missing, req.body would be undefined and the
        // controller would answer "Provide all Credentials" for a populated body.
        const res = await request(app)
            .post('/api/auth/user/login')
            .send({ emailPhone: 'nobody@example.com', password: 'whatever' });

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid Credentials');
    });

    it('parses a urlencoded body', async () => {
        const res = await request(app)
            .post('/api/auth/user/login')
            .type('form')
            .send({ emailPhone: 'nobody@example.com', password: 'whatever' });

        expect(res.status).toBe(401);
    });

    it('rejects malformed JSON with a 400 rather than crashing', async () => {
        const res = await request(app)
            .post('/api/auth/user/login')
            .set('Content-Type', 'application/json')
            .send('{"emailPhone": ');

        expect(res.status).toBe(400);
    });
});
