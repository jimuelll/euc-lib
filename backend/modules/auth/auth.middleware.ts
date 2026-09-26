import type { Request, RequestHandler } from "express";
import auth = require("./jwt.util");

interface AuthTokenPayload {
  id: number;
  role: string;
  iat?: number;
  must_change_password?: boolean;
  [claim: string]: unknown;
}
type AuthenticatedRequest = Request & { user?: AuthTokenPayload };

const { isAccessTokenCurrent, isUserAccessActive } = require("./authSession.service") as {
  isAccessTokenCurrent: (payload: AuthTokenPayload) => Promise<boolean>;
  isUserAccessActive: (userId: number) => Promise<boolean>;
};

function authMiddleware(roles: string[] = []): RequestHandler {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({ message: "Login required to use this feature" });
        return;
      }

      const token = authHeader.split(" ")[1];
      const payload = auth.verifyAccessToken(token) as AuthTokenPayload;
      if (!(await isAccessTokenCurrent(payload))) {
        res.status(401).json({ message: "Your session ended because the system was restored. Please log in again." });
        return;
      }
      if (!(await isUserAccessActive(payload.id))) {
        res.status(401).json({ message: "Your account is inactive. Please contact the library." });
        return;
      }

      if (roles.length && !roles.includes(payload.role)) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }

      (req as AuthenticatedRequest).user = payload;
      next();
    } catch {
      res.status(401).json({ message: "Your session is invalid. Please log in again." });
    }
  };
}

function optionalAuthMiddleware(): RequestHandler {
  return async (req, _res, next) => {
    const authenticatedRequest = req as AuthenticatedRequest;
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return next();

      const token = authHeader.split(" ")[1];
      if (!token) return next();

      const payload = auth.verifyAccessToken(token) as AuthTokenPayload;
      authenticatedRequest.user = (await isAccessTokenCurrent(payload)) && (await isUserAccessActive(payload.id))
        ? payload
        : undefined;
    } catch {
      authenticatedRequest.user = undefined;
    }

    next();
  };
}

export = { authMiddleware, optionalAuthMiddleware };
