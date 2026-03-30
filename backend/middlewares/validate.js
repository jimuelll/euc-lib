const validate = (validator) => async (req, res, next) => {
  try {
    await validator(req);
    next();
  } catch (err) {
    res.status(err.status ?? 400).json({ message: err.message ?? "Invalid request" });
  }
};

const createValidationError = (message, status = 400) =>
  Object.assign(new Error(message), { status });

module.exports = { validate, createValidationError };
