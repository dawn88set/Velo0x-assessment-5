const status = require('../constants/httpStatus');
const { GENERIC } = require('../constants/messages');

/** Mongo's duplicate-key error code. */
const DUPLICATE_KEY = 11000;

/**
 * 404 handler. Mounted after all routes, so reaching it means nothing matched.
 */
const notFound = (req, res, next) => {
  const err = new Error(GENERIC.ROUTE_NOT_FOUND);
  err.status = status.NOT_FOUND;
  next(err);
};

/**
 * Central Express error handler. Must keep the four-argument signature —
 * Express uses arity to distinguish error middleware from ordinary middleware.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const rawStatus = err.status || err.statusCode || status.INTERNAL_SERVER_ERROR;

  // A duplicate key is the client asking for something that already exists.
  if (err.code === DUPLICATE_KEY) {
    const field = Object.keys(err.keyPattern || {})[0];
    return res.status(status.CONFLICT).json({
      message: field ? GENERIC.duplicateField(field) : GENERIC.ALREADY_EXISTS,
    });
  }

  // Mongoose validation / cast errors mean the client sent something wrong,
  // so they are 400s rather than 500s.
  const isClientError =
    err.name === 'ValidationError' || err.name === 'CastError' || rawStatus < status.INTERNAL_SERVER_ERROR;

  // A ValidationError/CastError carries no status of its own, so it arrives as
  // 500 and must be mapped down. An explicit 404 keeps its own status.
  const responseStatus = isClientError && rawStatus >= status.INTERNAL_SERVER_ERROR
    ? status.BAD_REQUEST
    : rawStatus;

  // Only genuine server faults are logged, and only their message is exposed.
  if (!isClientError) console.error(err);

  return res.status(responseStatus).json({
    message: isClientError ? err.message : GENERIC.INTERNAL_ERROR,
  });
};

module.exports = { notFound, errorHandler };
