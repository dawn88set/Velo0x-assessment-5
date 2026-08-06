/**
 * 404 handler. Mounted after all routes, so reaching it means nothing matched.
 */
const notFound = (req, res, next) => {
  const err = new Error('Route Not Found');
  err.status = 404;
  next(err);
};

/**
 * Central Express error handler. Must keep the four-argument signature —
 * Express uses arity to distinguish error middleware from ordinary middleware.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  // Mongoose validation / cast errors are client errors, not server errors.
  const isClientError =
    err.name === 'ValidationError' || err.name === 'CastError' || status < 500;

  const message = isClientError ? err.message : 'Internal Server Error';

  if (status >= 500) {
    console.error(err);
  }

  res.status(isClientError && status >= 500 ? 400 : status).json({ message });
};

module.exports = { notFound, errorHandler };
