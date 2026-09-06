const validate = (validator) => async (req, res, next) => {
  try {
    await validator(req);
    next();
  } catch (err) {
    const field = err.field || String(err.message || "").match(/Field "([a-z0-9_]+)"/i)?.[1];
    res.status(err.status ?? 400).json({
      message: err.message ?? "Invalid request",
      ...(field ? { fields: { [field]: err.message ?? "Invalid value" } } : {}),
    });
  }
};

const createValidationError = (message, status = 400, field = null) =>
  Object.assign(new Error(message), { status, ...(field ? { field } : {}) });

module.exports = { validate, createValidationError };
