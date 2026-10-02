import type { Request, RequestHandler } from "express";

const { ipKeyGenerator, rateLimit } = require("express-rate-limit") as {
  ipKeyGenerator: (ip: string, ipv6Subnet?: number | false) => string;
  rateLimit: (options: Record<string, unknown>) => RequestHandler & { resetKey: (key: string) => void };
};

const rateLimitExposedHeaders = ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset", "RateLimit-Policy", "Retry-After"];

type RateLimitUserRequest = Request & {
  user?: { id?: number };
  rateLimitUserId?: number;
  rateLimit?: { resetTime?: Date };
};

type PolicyName =
  | "api"
  | "login"
  | "passwordChange"
  | "refreshIp"
  | "refreshAccount"
  | "bulletinPost"
  | "bulletinComment"
  | "bulletinLike"
  | "visit"
  | "adminNotification"
  | "publicCatalogue"
  | "authenticatedCatalogue"
  | "studentTransaction"
  | "deskTransaction"
  | "attendance"
  | "aiReport"
  | "isbnLookup"
  | "imageUpload"
  | "embeddingBackfill"
  | "reportExport"
  | "backup";

type Policy = { windowMs: number; limit: number; key: "ip" | "account" | "refreshAccount" };

// Every policy receives its own express-rate-limit memory store. Keep these
// values in sync with the API protection table in the README.
const policies: Record<PolicyName, Policy> = {
  api: { windowMs: 60_000, limit: 1_500, key: "ip" },
  login: { windowMs: 15 * 60_000, limit: 5, key: "ip" },
  passwordChange: { windowMs: 15 * 60_000, limit: 5, key: "account" },
  refreshIp: { windowMs: 60_000, limit: 300, key: "ip" },
  refreshAccount: { windowMs: 60_000, limit: 30, key: "refreshAccount" },
  bulletinPost: { windowMs: 10 * 60_000, limit: 10, key: "account" },
  bulletinComment: { windowMs: 5 * 60_000, limit: 20, key: "account" },
  bulletinLike: { windowMs: 60_000, limit: 60, key: "account" },
  visit: { windowMs: 60_000, limit: 120, key: "ip" },
  adminNotification: { windowMs: 10 * 60_000, limit: 20, key: "account" },
  publicCatalogue: { windowMs: 60_000, limit: 300, key: "ip" },
  authenticatedCatalogue: { windowMs: 60_000, limit: 120, key: "account" },
  studentTransaction: { windowMs: 60_000, limit: 30, key: "account" },
  deskTransaction: { windowMs: 60_000, limit: 120, key: "account" },
  attendance: { windowMs: 60_000, limit: 120, key: "account" },
  aiReport: { windowMs: 10 * 60_000, limit: 10, key: "account" },
  isbnLookup: { windowMs: 60_000, limit: 60, key: "account" },
  imageUpload: { windowMs: 10 * 60_000, limit: 30, key: "account" },
  embeddingBackfill: { windowMs: 15 * 60_000, limit: 10, key: "account" },
  reportExport: { windowMs: 10 * 60_000, limit: 30, key: "account" },
  backup: { windowMs: 15 * 60_000, limit: 20, key: "account" },
};

const accountKey = (req: Request): string => {
  const id = (req as RateLimitUserRequest).user?.id;
  if (!Number.isSafeInteger(id) || Number(id) < 1) {
    throw new Error("An authenticated account is required for this rate limit");
  }
  return `account:${id}`;
};

const refreshAccountKey = (req: Request): string => {
  const id = (req as RateLimitUserRequest).rateLimitUserId;
  if (!Number.isSafeInteger(id) || Number(id) < 1) {
    throw new Error("A verified refresh account is required for this rate limit");
  }
  return `account:${id}`;
};

function createLimiter(
  name: PolicyName,
  overrides: Partial<Pick<Policy, "windowMs" | "limit">> = {},
): RequestHandler & { resetKey: (key: string) => void } {
  const policy = { ...policies[name], ...overrides };
  return rateLimit({
    windowMs: policy.windowMs,
    limit: policy.limit,
    keyGenerator: (req: Request) => {
      if (policy.key === "ip") return ipKeyGenerator(req.ip || "127.0.0.1", 56);
      if (policy.key === "refreshAccount") return refreshAccountKey(req);
      return accountKey(req);
    },
    skip: (req: Request) => req.method === "OPTIONS"
      || (name === "refreshAccount" && !(req as RateLimitUserRequest).rateLimitUserId),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: import("express").Response) => {
      const resetTime = (req as RateLimitUserRequest).rateLimit?.resetTime;
      const retryAfterSeconds = Math.max(1, Math.ceil(((resetTime?.getTime() ?? Date.now() + policy.windowMs) - Date.now()) / 1_000));
      res.status(429).json({
        message: name === "login" ? "Too many login attempts. Try again later." : "Too many requests. Try again later.",
        code: "RATE_LIMITED",
        retryAfterSeconds,
      });
    },
  });
}

const limiters = Object.fromEntries(
  (Object.keys(policies) as PolicyName[]).map((name) => [name, createLimiter(name)]),
) as Record<PolicyName, RequestHandler & { resetKey: (key: string) => void }>;

const loginLimiter = limiters.login;

export = { policies, createLimiter, limiters, loginLimiter, rateLimitExposedHeaders };
