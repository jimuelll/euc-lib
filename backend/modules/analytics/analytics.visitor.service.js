const { randomUUID } = require("crypto");
const repository = require("./analytics.repository");

function toSafePath(value) {
  if (!value || typeof value !== "string") return "/";
  return value.slice(0, 255);
}

function newVisitorId() {
  return `visitor_${randomUUID()}`;
}


async function logSiteVisit({ visitorId, userId = null, path = "/", ipAddress = null, userAgent = null }) {
  const safePath = toSafePath(path);
  await repository.recordSiteVisit({
    visitorId,
    userId,
    path: safePath,
    ipAddress,
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
  });
}


module.exports = { logSiteVisit, newVisitorId };
