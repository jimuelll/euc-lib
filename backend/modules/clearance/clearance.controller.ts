import type { Request, RequestHandler, Response } from "express";
import service = require("./clearance.service");

const { logError } = require("../../logger") as { logError: (...values: unknown[]) => void };

type AuthenticatedRequest = Request & { user: { id: number } };
type RequestError = Error & { status?: number; clearance?: unknown };
type ClearanceHandler = (req: Request) => Promise<unknown>;

const respond = (handler: ClearanceHandler): RequestHandler => async (req, res) => {
  try {
    const result = await handler(req);
    if (req.method !== "GET" && result && typeof result === "object") res.locals.auditEnqueued = true;
    res.json(result);
  } catch (error: unknown) {
    logError("[clearance]", error);
    const requestError = error as RequestError;
    res.status(requestError?.status || 500).json({ message: requestError?.message || "Clearance request failed", clearance: requestError?.clearance });
  }
};

const getProfile = respond((req) => service.getClearanceProfile(String(req.query.student_employee_id || "")));
const getQueue = respond((req) => service.getClearanceQueue({
  page: req.query.page === undefined ? undefined : Number(req.query.page),
  limit: req.query.limit === undefined ? undefined : Number(req.query.limit),
}));
const recordPayment = respond((req) => {
  const user = req as AuthenticatedRequest;
  return service.recordFullPayment({ studentEmployeeId: req.body?.student_employee_id, createdBy: user.user.id });
});
const adjustFine = respond((req) => {
  const user = req as AuthenticatedRequest;
  return service.adjustFine({ borrowingId: Number(req.params.borrowingId), amount: req.body?.amount, reason: req.body?.reason, createdBy: user.user.id });
});
const reverseTransaction = respond((req) => {
  const user = req as AuthenticatedRequest;
  return service.reverseTransaction({ transactionId: Number(req.params.transactionId), reason: req.body?.reason, createdBy: user.user.id });
});
const getReceipt = respond((req) => service.getReceipt(String(req.params.receiptNumber)));

export = { getProfile, getQueue, recordPayment, adjustFine, reverseTransaction, getReceipt };
