/**
 * Every message this API sends back to a client.
 *
 * These live here because the test suites assert on them. When the text was
 * inlined in the controllers, each message existed twice: once in the handler,
 * once as a re-typed string in the matching test. Changing the wording meant
 * hunting for the copy in the spec file, and a mismatch only showed up as a
 * confusing test failure. Now both sides import the same value.
 */
module.exports = {
    AUTH: {
        // Deliberately identical for "no such user" and "wrong password": telling
        // the two apart lets an attacker enumerate registered accounts.
        INVALID_CREDENTIALS: 'Invalid Credentials',
        MISSING_CREDENTIALS: 'Provide all Credentials',
        MISSING_PASSWORD: 'Password is required',
        LOGIN_SUCCESS: 'Login Successful',
        REGISTERED: 'User Added Successfully',
        ALREADY_EXISTS: 'User already exists',
        PASSWORD_CHANGED: 'Password Changed Successfully',
        MISSING_ID_OR_PASSWORD: 'Provide user id and password',
    },

    USER: {
        NOT_FOUND: 'User not found',
        INVALID_ID: 'Invalid user id',
        LIST_SUCCESS: 'Success',
    },

    PROPERTY: {
        NOT_FOUND: 'Property not found',
        CREATED: 'Your property has been successfully posted',
        UPDATED: 'Property has been updated Successfully',
        TYPE_CREATED: 'Property type added successfully',
        FILE_NOT_FOUND: 'No file exists',
        NOT_AN_IMAGE: 'Not an image',
        STORAGE_UNAVAILABLE: 'File storage unavailable',
    },

    COMMON: {
        STATE_CREATED: 'State added successfully',
        CITY_CREATED: 'City added successfully',
        CITY_REMOVED: 'City removed successfully',
        CITY_NOT_FOUND: 'City not found',
        INVALID_CITY_ID: 'Invalid city id',
        INVALID_STATE_ID: 'Invalid state id',
    },

    EMAIL: {
        SENT: 'Email sent successfully',
        MISSING_API_KEY: 'Sendgrid API key not found',
        MISSING_TEMPLATE: 'Sendgrid template not found',
        SEND_FAILED: 'Failed to send email',
        /** `toEmail is missing`, `name is missing`, ... */
        missingKey: (key) => `${key} is missing`,
    },

    GENERIC: {
        ROUTE_NOT_FOUND: 'Route Not Found',
        INTERNAL_ERROR: 'Internal Server Error',
        ALREADY_EXISTS: 'Already exists',
        /** Duplicate key on a unique index, e.g. `email already exists`. */
        duplicateField: (field) => `${field} already exists`,
    },
};
