import type { Request, RequestHandler, Response } from "express";
import service = require("./recommendations.service");

type AuthenticatedRequest = Request & { user: { id: number } };
type RequestError = Error & { status?: number };

const sendError = (res: Response, error: unknown, fallback: string): void => {
  const requestError = error as RequestError;
  res.status(requestError?.status || 500).json({ message: requestError?.message || fallback });
};

const forBook: RequestHandler = async (req, res) => {
  try { res.json(await service.recommendationsForSeed(Number(req.params.bookId))); }
  catch (error: unknown) { sendError(res, error, "Failed to fetch recommendations"); }
};

const mine: RequestHandler = async (req, res) => {
  try {
    const user = req as AuthenticatedRequest;
    res.json(await service.personalized(user.user.id, String(req.query.materialType || "book")));
  } catch (error: unknown) { sendError(res, error, "Failed to fetch recommendations"); }
};

const dismiss: RequestHandler = async (req, res) => {
  try {
    const user = req as AuthenticatedRequest;
    await service.dismiss(user.user.id, Number(req.params.bookId));
    res.status(204).end();
  } catch (error: unknown) { sendError(res, error, "Failed to dismiss recommendation"); }
};

const backfill: RequestHandler = async (req, res) => {
  try {
    const result = await service.startBackfill(req.body,(req as AuthenticatedRequest).user.id);
    res.locals.auditEnqueued=true;
    res.status(202).json(result);
  } catch (error: unknown) { sendError(res, error, "Embedding backfill failed"); }
};

const backfillProgress: RequestHandler = async (_req, res) => {
  try { const result=await service.restoredBackfillProgress();const last=await require('./recommendations.run-log').latestRun();res.json({...result,...(last?.runId===result.runId?{actorName:last.actorName,auditEventId:last.auditEventId}:{})}); }
  catch (error: unknown) { sendError(res, error, "Failed to fetch embedding progress"); }
};

const status: RequestHandler = async (_req, res) => {
  try { res.json({...await service.embeddingStatus(),providers:service.providerConfiguration(),lastBackfill:await service.restoredBackfillProgress(),updatedAt:new Date().toISOString()}); }
  catch (error: unknown) { sendError(res, error, "Failed to fetch embedding status"); }
};

const metadataBooks: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(req.query.limit) || 25)));
    res.json(await service.listMetadataBooks({ query: String(req.query.q || "").slice(0, 160), needsAttention: req.query.needsAttention === "true",synopsis:String(req.query.synopsis||'all'),embedding:String(req.query.embedding||'all'),details:String(req.query.details||'all'),sort:String(req.query.sort||'attention'), page, limit }));
  } catch (error: unknown) { sendError(res, error, "Failed to find books"); }
};

const getBookMetadata: RequestHandler = async (req, res) => {
  try { res.json(await service.getManualMetadata(Number(req.params.bookId))); }
  catch (error: unknown) { sendError(res, error, "Failed to load book details"); }
};

const saveBookMetadata: RequestHandler = async (req, res) => {
  try { res.json(await service.saveManualMetadata(Number(req.params.bookId), req.body,(req as AuthenticatedRequest).user.id)); }
  catch (error: unknown) { sendError(res, error, "Failed to save book details"); }
};

const preview:RequestHandler=async(req,res)=>{try{res.json(await service.previewBackfill(req.body));}catch(error){sendError(res,error,'Could not preview backfill');}};
const cancel:RequestHandler=async(_req,res)=>{try{res.json(service.cancelBackfill());}catch(error){sendError(res,error,'Could not cancel backfill');}};
export = { forBook, mine, dismiss, backfill, backfillProgress, status, metadataBooks, getBookMetadata, saveBookMetadata,preview,cancel };
