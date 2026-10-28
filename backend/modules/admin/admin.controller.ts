import type { Request, RequestHandler, Response } from "express";
import service = require("./admin.service");
import repository = require("./admin.repository");
import type { UserSearchQuery } from "./admin.types";
const { logError } = require("../../logger") as { logError: (...values: unknown[]) => void };
const qr = require("qrcode") as { toBuffer: (value: string, options: { type: "png"; width: number; margin: number; errorCorrectionLevel: "M" }) => Promise<Buffer> };
type AuthenticatedRequest = Request & { user: { id: number; role: string } };
type AdminServiceError = Error & { status?: number; outstandingAmount?: number; affectedLoans?: number; fieldErrors?: Record<string,string> };
const sendMutationError = (res: Response, error: unknown): void => {
  const requestError = error as AdminServiceError;
  res.status(requestError?.status ?? 400).json({
    message: requestError?.message,
    ...(requestError?.fieldErrors ? {fieldErrors:requestError.fieldErrors} : {}),
    ...(requestError?.outstandingAmount !== undefined ? { outstandingAmount: requestError.outstandingAmount, affectedLoans: requestError.affectedLoans } : {}),
  });
};
const handleCreateUser: RequestHandler = async (req, res) => {
  try {
    const user = req as AuthenticatedRequest;
    const result = await service.createUser(req.body, user.user.role, user.user.id);
    res.locals.auditEnqueued = true;
    res.status(201).json(result);
  } catch (error: unknown) { sendMutationError(res, error); }
};
const handleDeleteUser: RequestHandler = async (req, res) => {
  try {
    const user = req as AuthenticatedRequest;
    const result = await service.deleteUser(String(req.params.student_employee_id), user.user.role, user.user.id, String(req.body?.reason || ""));
    res.locals.auditEnqueued = true;
    res.json(result);
  } catch (error: unknown) { sendMutationError(res, error); }
};
const handleRestoreUser: RequestHandler = async (req, res) => {
  try {
    const user = req as AuthenticatedRequest;
    const result = await service.restoreUser(String(req.params.student_employee_id), user.user.role, user.user.id);
    res.locals.auditEnqueued = true;
    res.json(result);
  } catch (error: unknown) {
    const requestError = error as AdminServiceError;
    res.status(requestError?.status ?? 400).json({ message: requestError?.message });
  }
};
const handleUpdateUser: RequestHandler = async (req, res) => {
  try {
    const user = req as AuthenticatedRequest;
    const result = await service.updateUser(String(req.params.student_employee_id), req.body, user.user.role, user.user.id);
    res.locals.auditEnqueued = true;
    res.json(result);
  } catch (error: unknown) { sendMutationError(res, error); }
};
const handleSearchUsers: RequestHandler = async (req, res) => {
  try {
    const user = req as AuthenticatedRequest;
    const result = await service.searchUsers(req.query as unknown as UserSearchQuery, user.user.role);
    res.json(result);
  } catch (error: unknown) {
    const requestError = error as Error;
    res.status(400).json({ message: requestError?.message });
  }
};
const handleQueryToolsSearch: RequestHandler = async (req, res) => {
  try {
    const user = req as AuthenticatedRequest;
    const result = await service.queryToolsSearch(String(req.query.q || ""), user.user.role);
    res.json(result);
  } catch (error: unknown) {
    const requestError = error as Error;
    res.status(400).json({ message: requestError?.message });
  }
};
const handleGetBarcodePng: RequestHandler = async (req, res) => {
  try {
    const user = await repository.findActiveUserBarcode(String(req.params.student_employee_id));
    if (!user?.barcode) return void res.status(404).json({ message: "User or barcode not found" });
    const png = await qr.toBuffer(user.barcode, { type: "png", width: 300, margin: 2, errorCorrectionLevel: "M" });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(png);
  } catch (error: unknown) {
    logError("[admin] getBarcodePng:", error);
    res.status(500).json({ message: "Failed to generate QR code" });
  }
};
const handleAvailability: RequestHandler = async (req,res) => {
  try { const actor=(req as AuthenticatedRequest).user; res.set('Cache-Control','no-store'); res.json(await service.checkAvailability(req.body,actor.role,actor.id)); }
  catch(error) { sendMutationError(res,error); }
};
const handleAccountEmailStatus: RequestHandler = async (req,res) => {
  try { const actor=(req as AuthenticatedRequest).user; res.set('Cache-Control','no-store'); res.json(await service.getAccountEmailStatus(String(req.params.student_employee_id),actor.role,actor.id)); }
  catch(error) { sendMutationError(res,error); }
};
const handleResetOperationsPassword: RequestHandler = async (req, res) => {
  try {
    const actor = (req as AuthenticatedRequest).user;
    const result = await service.resetOperationsPassword(String(req.params.student_employee_id), req.body?.password, actor.role, actor.id);
    res.locals.auditEnqueued = true;
    res.set("Cache-Control", "no-store").json(result);
  } catch (error) { sendMutationError(res, error); }
};
export = { handleResetOperationsPassword, handleAvailability, handleAccountEmailStatus, handleCreateUser, handleDeleteUser, handleRestoreUser, handleUpdateUser, handleSearchUsers, handleQueryToolsSearch, handleGetBarcodePng };
