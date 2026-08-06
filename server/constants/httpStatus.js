/**
 * The HTTP status codes this API actually returns. Named so a handler reads as
 * intent (`CONFLICT`) rather than trivia the reader has to decode (`409`).
 */
module.exports = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNSUPPORTED_MEDIA_TYPE: 415,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};
