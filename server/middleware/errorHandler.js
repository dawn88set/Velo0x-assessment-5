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
  const rawStatus = err.status || err.statusCode || 500;

  // A duplicate key is the client asking for something that already exists.
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return res.status(409).json({
      message: field ? `${field} already exists` : 'Already exists',
    });
  }

  // Mongoose validation / cast errors mean the client sent something wrong,
  // so they are 400s rather than 500s.
  const isClientError =
    err.name === 'ValidationError' || err.name === 'CastError' || rawStatus < 500;

  // A ValidationError/CastError carries no status of its own, so it arrives as
  // 500 and must be mapped down. An explicit 404 keeps its own status.
  const status = isClientError && rawStatus >= 500 ? 400 : rawStatus;

  // Only genuine server faults are logged, and only their message is exposed.
  if (!isClientError) console.error(err);

  return res.status(status).json({
    message: isClientError ? err.message : 'Internal Server Error',
  });
};

module.exports = { notFound, errorHandler };
