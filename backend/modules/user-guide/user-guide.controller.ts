import type { Request, RequestHandler, Response } from "express";
import service = require("./user-guide.service");

const { logError } = require("../../logger") as { logError: (...values: unknown[]) => void };

type AuthenticatedRequest = Request & { user: { id: number; role: string } };
type RequestError = Error & { status?: number };
type GuideHandler = (req: Request, res: Response) => Promise<unknown> | unknown;

const respond = (handler: GuideHandler): RequestHandler => async (req, res) => {
  try {
    const result = await handler(req, res);
    if (!res.headersSent) res.json({ success: true, data: result });
  } catch (error: unknown) {
    logError("[user-guide]", error);
    const requestError = error as RequestError;
    res.status(requestError?.status || 500).json({ success: false, message: requestError?.message || "User guide request failed." });
  }
};

const listPublished = respond((req) => service.listPublished((req as AuthenticatedRequest).user.role));
const listForAdmin = respond(() => service.listForAdmin());
const createDraft = respond(async (req, res) => {
  const user = req as AuthenticatedRequest;
  const item = await service.createDraft(req.body, user.user.id);
  res.status(201).json({ success: true, data: item });
});
const updateDraft = respond((req) => {
  const user = req as AuthenticatedRequest;
  return service.updateDraft(Number(req.params.id), req.body, user.user.id);
});
const publish = respond((req) => {
  const user = req as AuthenticatedRequest;
  return service.publish(Number(req.params.id), user.user.id);
});
const unpublish = respond((req) => {
  const user = req as AuthenticatedRequest;
  return service.unpublish(Number(req.params.id), user.user.id);
});
const archive = respond(async (req, res) => {
  const user = req as AuthenticatedRequest;
  await service.archive(Number(req.params.id), user.user.id);
  res.json({ success: true, message: "Guide module archived." });
});
const reorder = respond(async (req, res) => {
  const user = req as AuthenticatedRequest;
  await service.reorder(req.body?.ids, user.user.id);
  res.json({ success: true, message: "Guide order updated." });
});

export = { listPublished, listForAdmin, createDraft, updateDraft, publish, unpublish, archive, reorder };
