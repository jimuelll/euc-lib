const { verifyAccessToken } = require("./jwt.util");
const { isAccessTokenCurrent } = require("./authSession.service");

function authMiddleware(roles = []) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: "Login required to use this feature" });
      }

      const token = authHeader.split(" ")[1];
      const payload = verifyAccessToken(token);
      if (!(await isAccessTokenCurrent(payload))) {
        return res.status(401).json({ message: "Your session ended because the system was restored. Please log in again." });
      }

      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      req.user = payload;
      next();
    } catch (err) {
      return res.status(401).json({ message: "Your session is invalid. Please log in again." });
    }
  };
}

function optionalAuthMiddleware() {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return next();

      const token = authHeader.split(" ")[1];
      if (!token) return next();

      const payload = verifyAccessToken(token);
      req.user = (await isAccessTokenCurrent(payload)) ? payload : undefined;
    } catch {
      req.user = undefined;
    }

    next();
  };
}

module.exports = { authMiddleware, optionalAuthMiddleware };
