const DEVICE_TYPES = new Set(["desktop", "mobile", "tablet", "unknown"]);

function getDeviceType(userAgent) {
  if (!userAgent || typeof userAgent !== "string") return "unknown";

  const value = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(value)) return "tablet";
  if (/mobi|iphone|ipod|android|iemobile|opera mini|windows phone/.test(value)) return "mobile";
  return "desktop";
}

function getAuthAuditContext(req) {
  return { deviceType: getDeviceType(req.get("user-agent")) };
}

function normalizeDeviceType(value) {
  return DEVICE_TYPES.has(value) ? value : "unknown";
}

module.exports = { getAuthAuditContext, getDeviceType, normalizeDeviceType };
