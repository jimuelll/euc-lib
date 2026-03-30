const {
  getDashboardOverview,
  logSiteVisit,
  newVisitorId,
} = require("./analytics.service");

const VISITOR_COOKIE = "siteVisitorId";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getVisitorCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

async function handleTrackVisit(req, res) {
  try {
    const visitorId = req.cookies?.[VISITOR_COOKIE] || newVisitorId();
    if (!req.cookies?.[VISITOR_COOKIE]) {
      res.cookie(VISITOR_COOKIE, visitorId, getVisitorCookieOptions());
    }

    await logSiteVisit({
      visitorId,
      userId: req.user?.id ?? null,
      path: req.body?.path || req.originalUrl || "/",
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || null,
    });

    res.status(204).send();
  } catch (err) {
    console.error("[analytics] trackVisit:", err);
    res.status(500).json({ message: "Failed to track visit" });
  }
}

async function handleGetDashboardOverview(req, res) {
  try {
    const result = await getDashboardOverview({
      limit: req.query.limit,
      page: req.query.page,
      category: req.query.category,
      action: req.query.action,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });
    res.json(result);
  } catch (err) {
    console.error("[analytics] getDashboardOverview:", err);
    res.status(500).json({ message: "Failed to load dashboard data" });
  }
}

module.exports = {
  handleGetDashboardOverview,
  handleTrackVisit,
};
