import type { CookieOptions, Request, Response } from "express";

interface AnalyticsRequest extends Request {
  user?: { id: number };
}

const {
  getAuditLog,
  getAuditLogMeta,
  getDashboardOverview,
  logSiteVisit,
  newVisitorId,
} = require("./analytics.service");
const { createAiAnalyticsReport } = require("./aiReport.service");
const { logError } = require("../../logger");

const VISITOR_COOKIE = "siteVisitorId";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function getVisitorCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

async function handleTrackVisit(req: AnalyticsRequest, res: Response) {
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
  } catch (err: any) {
    logError("[analytics] trackVisit:", err);
    res.status(500).json({ message: "Failed to track visit" });
  }
}

async function handleGetDashboardOverview(req: AnalyticsRequest, res: Response) {
  try {
    const result = await getDashboardOverview({ range: req.query.range as string | undefined,dateFrom:req.query.dateFrom as string|undefined,dateTo:req.query.dateTo as string|undefined,allTime:req.query.allTime==='true',actorId:req.user?.id });
    res.json(result);
  } catch (err: any) {
    logError("[analytics] getDashboardOverview:", err);
    res.status(err.status||500).json({ message: err.status?err.message:"Failed to load dashboard data" });
  }
}

async function handleCreateAiAnalyticsReport(req: AnalyticsRequest, res: Response) {
  try {
    const result = await createAiAnalyticsReport(req.body || {}, req.user?.id);
    res.json(result);
  } catch (err: any) {
    // Coded errors carry user-facing guidance; details only ever hold dates.
    if (err.status && (err.status < 500 || err.status === 503)) {
      return res.status(err.status).json({ message: err.message, ...(err.code ? { code: err.code } : {}), ...(err.details ? { details: err.details } : {}) });
    }
    logError("[analytics] create AI report:", err);
    res.status(500).json({ message: "Failed to generate the AI report" });
  }
}

async function handleGetAuditLog(req: AnalyticsRequest, res: Response) {
  try {
    const result = await getAuditLog({
      limit: req.query.limit,
      page: req.query.page,
      category: req.query.category,
      action: req.query.action,
      query: req.query.query,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,actor:req.query.actor,record:req.query.record,important:req.query.important,security:req.query.security,event:req.query.event,quick:req.query.quick,showRoutineAuth:req.query.showRoutineAuth,currentActorId:req.user?.id,
    });
    res.json(result);
  } catch (err: any) {
    logError("[analytics] getAuditLog:", err);
    res.status(err.status||500).json({ message: err.status?err.message:"Failed to load audit log" });
  }
}

async function handleGetAuditLogMeta(req: AnalyticsRequest, res: Response) {
  try {
    const result = await getAuditLogMeta();
    res.json(result);
  } catch (err: any) {
    logError("[analytics] getAuditLogMeta:", err);
    res.status(500).json({ message: "Failed to load audit metadata" });
  }
}

export = {
  handleGetAuditLog,
  handleGetAuditLogMeta,
  handleGetDashboardOverview,
  handleCreateAiAnalyticsReport,
  handleTrackVisit,
};
