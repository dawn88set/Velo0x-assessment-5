const request = require('supertest');
const sgMail = require('@sendgrid/mail'); // mocked globally in setup.js

const app = require('../app');
const { EMAIL } = require('../constants/messages');

const VALID_BODY = {
    toEmail: 'owner@example.com',
    fromEmail: 'noreply@example.com',
    name: 'Grace Hopper',
    email: 'grace@example.com',
    message: 'I would like to know more about this listing.',
};

const post = (body) => request(app).post('/api/email/github-pages').send(body);

describe('POST /api/email/github-pages', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV, SENDGRID_API_KEY: 'SG.test-key', SENDGRID_TEMPLATE_ID: 'd-template' };
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('sends the mail and reports success', async () => {
        const res = await post(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe(EMAIL.SENT);
        expect(sgMail.setApiKey).toHaveBeenCalledWith('SG.test-key');
        expect(sgMail.send).toHaveBeenCalledTimes(1);
    });

    it('maps the request body onto the SendGrid template payload', async () => {
        await post(VALID_BODY);

        expect(sgMail.send).toHaveBeenCalledWith({
            to: 'owner@example.com',
            from: 'noreply@example.com',
            template_id: 'd-template',
            dynamic_template_data: {
                name: 'Grace Hopper',
                email: 'grace@example.com',
                message: 'I would like to know more about this listing.',
            },
        });
    });

    it.each(['toEmail', 'fromEmail', 'name', 'email', 'message'])(
        'rejects a body missing %s with 400 and names the field',
        async (key) => {
            const res = await post({ ...VALID_BODY, [key]: undefined });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe(`${key} is missing`);
            expect(sgMail.send).not.toHaveBeenCalled();
        },
    );

    it('reports the first missing key when several are absent', async () => {
        const res = await post({ message: 'hello' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('toEmail is missing');
    });

    it('rejects when the SendGrid API key is not configured', async () => {
        delete process.env.SENDGRID_API_KEY;

        const res = await post(VALID_BODY);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(EMAIL.MISSING_API_KEY);
        expect(sgMail.send).not.toHaveBeenCalled();
    });

    it('rejects when the SendGrid template is not configured', async () => {
        delete process.env.SENDGRID_TEMPLATE_ID;

        const res = await post(VALID_BODY);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(EMAIL.MISSING_TEMPLATE);
    });

    it('surfaces a SendGrid failure as a message, not the raw error object', async () => {
        // The original did res.status(400).send(err), leaking the provider's
        // full error payload (including request headers) to the caller.
        sgMail.send.mockRejectedValueOnce(new Error('Unauthorized'));

        const res = await post(VALID_BODY);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'Unauthorized' });
    });
});
