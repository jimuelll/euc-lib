const { randomUUID } = require("crypto");
const repository = require("./analytics.repository");

interface SiteVisitInput {
  visitorId: string;
  userId?: number | null;
  path?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function toSafePath(value: unknown): string {
  if (!value || typeof value !== "string") return "/";
  return value.slice(0, 255);
}

function newVisitorId(): string {
  return `visitor_${randomUUID()}`;
}


async function logSiteVisit({ visitorId, userId = null, path = "/", ipAddress = null, userAgent = null }: SiteVisitInput): Promise<void> {
  const safePath = toSafePath(path);
  await repository.recordSiteVisit({
    visitorId,
    userId,
    path: safePath,
    ipAddress,
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
  });
}


export = { logSiteVisit, newVisitorId };
