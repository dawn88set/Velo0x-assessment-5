const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = require('../app');
const User = require('../models/users');
const { secretKey } = require('../config/config');
const { buildRegistrationPayload } = require('./helpers/factories');
const { AUTH } = require('../constants/messages');

const register = (overrides) =>
    request(app).post('/api/auth/user/register').send(buildRegistrationPayload(overrides));

const login = (body) => request(app).post('/api/auth/user/login').send(body);

describe('POST /api/auth/user/register', () => {
    it('creates a user and returns its id', async () => {
        const res = await register();

        expect(res.status).toBe(201);
        expect(res.body.message).toBe(AUTH.REGISTERED);
        expect(res.body.id).toBeDefined();

        const stored = await User.findById(res.body.id);
        expect(stored.email).toBe('grace@example.com');
    });

    it('persists the surname (regression: the original read req.body.lName)', async () => {
        // `lname` is required by the schema, so the casing typo in the original
        // meant every single registration failed validation.
        const res = await register({ lname: 'Hopper' });

        const stored = await User.findById(res.body.id);
        expect(stored.lname).toBe('Hopper');
    });

    it('stores a bcrypt hash, never the plaintext password', async () => {
        const res = await register({ password: 'sup3r-s3cret' });

        const stored = await User.findById(res.body.id);
        expect(stored.password).not.toBe('sup3r-s3cret');
        expect(stored.password).toMatch(/^\$2[aby]\$/);
        await expect(bcrypt.compare('sup3r-s3cret', stored.password)).resolves.toBe(true);
    });

    it('rejects a missing required field with 400', async () => {
        const res = await register({ email: undefined });

        expect(res.status).toBe(400);
        expect(await User.countDocuments()).toBe(0);
    });

    it('rejects a missing password with 400 before hashing', async () => {
        const res = await register({ password: undefined });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(AUTH.MISSING_PASSWORD);
    });

    it('rejects a duplicate email with 409', async () => {
        await register();
        const res = await register({ phoneNo: '9111111111' });

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(AUTH.ALREADY_EXISTS);
        expect(await User.countDocuments()).toBe(1);
    });
});

describe('POST /api/auth/user/login', () => {
    const PASSWORD = 'sup3r-s3cret';

    beforeEach(async () => {
        await register({ password: PASSWORD });
    });

    it('returns a signed JWT carrying the user identity', async () => {
        const res = await login({ emailPhone: 'grace@example.com', password: PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe(AUTH.LOGIN_SUCCESS);

        const decoded = jwt.verify(res.body.token, secretKey);
        expect(decoded.user.email).toBe('grace@example.com');
        expect(decoded.user.fname).toBe('Grace');
        expect(decoded.user.isAdmin).toBe(false);
        expect(decoded.exp).toBeDefined(); // token must expire
    });

    it('never puts the password hash in the token', async () => {
        const res = await login({ emailPhone: 'grace@example.com', password: PASSWORD });

        const decoded = jwt.verify(res.body.token, secretKey);
        expect(decoded.user.password).toBeUndefined();
    });

    it('logs in by phone number (the isNaN branch)', async () => {
        const res = await login({ emailPhone: '9998887777', password: PASSWORD });

        expect(res.status).toBe(200);
        expect(jwt.verify(res.body.token, secretKey).user.email).toBe('grace@example.com');
    });

    it('rejects a wrong password with 401', async () => {
        const res = await login({ emailPhone: 'grace@example.com', password: 'wrong' });

        expect(res.status).toBe(401);
        expect(res.body.token).toBeUndefined();
    });

    it('gives an identical response for an unknown user and a wrong password', async () => {
        // The original answered "Invalid Credentials1" vs "Invalid Credentials2",
        // which let an attacker enumerate registered accounts.
        const unknown = await login({ emailPhone: 'nobody@example.com', password: PASSWORD });
        const wrongPass = await login({ emailPhone: 'grace@example.com', password: 'wrong' });

        expect(unknown.status).toBe(wrongPass.status);
        expect(unknown.body).toEqual(wrongPass.body);
    });

    it('rejects missing credentials with 400', async () => {
        await expect(login({}).then((r) => r.status)).resolves.toBe(400);
        await expect(login({ emailPhone: 'grace@example.com' }).then((r) => r.status)).resolves.toBe(400);
        await expect(login({ password: PASSWORD }).then((r) => r.status)).resolves.toBe(400);
    });

    it('does not throw when no body is sent at all', async () => {
        const res = await request(app).post('/api/auth/user/login');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(AUTH.MISSING_CREDENTIALS);
    });
});

describe('GET /api/auth/admin/userList', () => {
    it('lists users without their password hashes', async () => {
        await register();

        const res = await request(app).get('/api/auth/admin/userList');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].email).toBe('grace@example.com');
        expect(res.body.data[0].password).toBeUndefined();
    });

    it('returns an empty list when there are no users', async () => {
        const res = await request(app).get('/api/auth/admin/userList');

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
    });
});

describe('PUT /api/auth/admin/changePass', () => {
    it('replaces the password so the old one stops working', async () => {
        const created = await register({ password: 'old-password' });

        const res = await request(app)
            .put('/api/auth/admin/changePass')
            .send({ _id: created.body.id, password: 'new-password' });

        expect(res.status).toBe(200);

        await expect(
            login({ emailPhone: 'grace@example.com', password: 'new-password' }).then((r) => r.status),
        ).resolves.toBe(200);
        await expect(
            login({ emailPhone: 'grace@example.com', password: 'old-password' }).then((r) => r.status),
        ).resolves.toBe(401);
    });

    it('stores the new password hashed', async () => {
        const created = await register();

        await request(app)
            .put('/api/auth/admin/changePass')
            .send({ _id: created.body.id, password: 'new-password' });

        const stored = await User.findById(created.body.id);
        expect(stored.password).not.toBe('new-password');
        expect(stored.password).toMatch(/^\$2[aby]\$/);
    });

    it('returns 400 for a malformed id and 404 for an unknown one', async () => {
        const malformed = await request(app)
            .put('/api/auth/admin/changePass')
            .send({ _id: 'not-an-object-id', password: 'x' });
        expect(malformed.status).toBe(400);

        const unknown = await request(app)
            .put('/api/auth/admin/changePass')
            .send({ _id: '507f1f77bcf86cd799439011', password: 'x' });
        expect(unknown.status).toBe(404);
    });

    it('returns 400 when id or password is missing', async () => {
        const res = await request(app).put('/api/auth/admin/changePass').send({});

        expect(res.status).toBe(400);
    });
});
