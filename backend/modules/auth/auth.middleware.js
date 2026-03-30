const { verifyAccessToken } = require("./jwt.util");

function authMiddleware(roles = []) {
  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: "Login required to use this feature" });
      }

      const token = authHeader.split(" ")[1];
      const payload = verifyAccessToken(token);

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
  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return next();

      const token = authHeader.split(" ")[1];
      if (!token) return next();

      req.user = verifyAccessToken(token);
    } catch {
      req.user = undefined;
    }

    next();
  };
}

module.exports = { authMiddleware, optionalAuthMiddleware };
