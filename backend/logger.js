function logError(context, error, ...details) {
  const status = Number(error?.status);
  if (process.env.NODE_ENV === "production" && status >= 400 && status < 500) return;
  console.error(context, error, ...details);
}

function logDevelopment(...values) {
  if (process.env.NODE_ENV !== "production") console.log(...values);
}

module.exports = { logError, logDevelopment };
