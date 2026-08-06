const helpers = require('../providers/helper');
const Property = require('../models/property');
const { createProperty } = require('./helpers/factories');

describe('isKeyMissing', () => {
    const required = ['toEmail', 'fromEmail', 'message'];

    it('returns false when every key is present', () => {
        expect(helpers.isKeyMissing(
            { toEmail: 'a@b.c', fromEmail: 'd@e.f', message: 'hi' },
            required,
        )).toBe(false);
    });

    it('returns the first missing key, in the order given', () => {
        expect(helpers.isKeyMissing({ message: 'hi' }, required)).toBe('toEmail');
        expect(helpers.isKeyMissing({ toEmail: 'a@b.c', message: 'hi' }, required)).toBe('fromEmail');
    });

    it('treats empty strings as missing', () => {
        expect(helpers.isKeyMissing({ toEmail: '', fromEmail: 'd@e.f', message: 'hi' }, required))
            .toBe('toEmail');
    });

    it('is safe with no arguments', () => {
        expect(helpers.isKeyMissing()).toBe(false);
        expect(helpers.isKeyMissing({}, [])).toBe(false);
    });

    it('does not leak `element` into the global scope', () => {
        // The original used `for (element of ...)` with no declaration.
        helpers.isKeyMissing({}, required);
        expect(global.element).toBeUndefined();
    });
});

describe('slugGenerator', () => {
    it('lowercases and hyphenates the title', async () => {
        await expect(helpers.slugGenerator('Luxury Beach Villa', 'title', 'property'))
            .resolves.toBe('luxury-beach-villa');
    });

    it('strips the punctuation set the implementation targets', async () => {
        await expect(helpers.slugGenerator('Grand, "Sunny" Home! $500 @Now 100% &More^*', 'title', 'property'))
            .resolves.toBe('grand-sunny-home-500-now-100-more');
    });

    it('trims surrounding whitespace', async () => {
        await expect(helpers.slugGenerator('   Spaced Out   ', 'title', 'property'))
            .resolves.toBe('spaced-out');
    });

    it('falls back to a default title when none is given', async () => {
        await expect(helpers.slugGenerator('', 'title', 'property')).resolves.toBe('property-listing');
        await expect(helpers.slugGenerator(undefined, 'title', 'property')).resolves.toBe('property-listing');
        await expect(helpers.slugGenerator(null, 'title', 'property')).resolves.toBe('property-listing');
    });

    it('appends an incrementing suffix when the slug is taken', async () => {
        await createProperty({ slug: 'luxury-villa' });
        await expect(helpers.slugGenerator('Luxury Villa', 'title', 'property'))
            .resolves.toBe('luxury-villa-1');

        await createProperty({ slug: 'luxury-villa-1' });
        await expect(helpers.slugGenerator('Luxury Villa', 'title', 'property'))
            .resolves.toBe('luxury-villa-2');
    });

    it('leaves gaps alone rather than reusing a freed suffix', async () => {
        // -1 is taken but -2 is not, so the next free suffix is -2.
        await createProperty({ slug: 'gap-test' });
        await createProperty({ slug: 'gap-test-1' });

        await expect(helpers.slugGenerator('Gap Test', 'title', 'property'))
            .resolves.toBe('gap-test-2');
    });

    it('produces a slug that is actually free', async () => {
        await createProperty({ slug: 'unique-check' });

        const slug = await helpers.slugGenerator('Unique Check', 'title', 'property');

        expect(await Property.findOne({ slug })).toBeNull();
    });
});
