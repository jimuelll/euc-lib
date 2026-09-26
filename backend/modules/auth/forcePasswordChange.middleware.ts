import type { Request, RequestHandler } from "express";

type AuthenticatedRequest = Request & {
  user?: { must_change_password?: boolean };
};

const forcePasswordChange: RequestHandler = async (req, res, next) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (user.must_change_password) {
    res.status(403).json({
      message: "Password must be changed before using the system",
      mustChangePassword: true,
    });
    return;
  }

  next();
};

export = { forcePasswordChange };
