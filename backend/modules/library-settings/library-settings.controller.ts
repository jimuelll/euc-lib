import type { Request, RequestHandler, Response } from "express";
import service = require("./library-settings.service");
import type { RecordStatus } from "./library-settings.types";

const { logError } = require("../../logger") as { logError: (...values: unknown[]) => void };

type RequestError = { status?: number; message?: string };
type AuthenticatedRequest = Request & { user?: { id: number } };

const userId = (req: Request): number | undefined => (req as AuthenticatedRequest).user?.id;
const routeId = (value: string | string[]): number => Number.parseInt(String(value), 10);
const sendError = (res: Response, error: unknown, fallback: string): void => {
  const requestError = error as RequestError;
  res.status(requestError?.status ?? 500).json({ message: requestError?.message ?? fallback });
};
const recordStatus = (value: unknown): RecordStatus =>
  value === "archived" || value === "all" ? value : "active";

const getLibrarySettings: RequestHandler = async (req, res) => {
  try {
    const [settings, holidays] = await Promise.all([
      service.getSettings(),
      service.listHolidays({
        status: req.query?.holidays === "all" ? "all" : req.query?.holidays === "archived" ? "archived" : "active",
      }),
    ]);
    res.json({ settings, holidays });
  } catch (error: unknown) {
    logError("[library-settings] getLibrarySettings:", error);
    res.status(500).json({ message: "Failed to fetch library settings" });
  }
};

const updateLibrarySettings: RequestHandler = async (req, res) => {
  try {
    const settings = await service.updateSettings(
      { overdueFinePerHour: req.body?.overdue_fine_per_hour },
      userId(req),
    );
    res.locals.auditEnqueued = true;
    res.json({ message: "Library settings updated successfully", settings });
  } catch (error: unknown) {
    logError("[library-settings] updateLibrarySettings:", error);
    sendError(res, error, "Failed to update settings");
  }
};

const createHoliday: RequestHandler = async (req, res) => {
  try {
    const holiday = await service.createHoliday({
      name: req.body?.name,
      holidayDate: req.body?.holiday_date,
      description: req.body?.description,
    }, userId(req));
    res.locals.auditEnqueued = true;
    res.status(201).json({ message: "Holiday added successfully", holiday });
  } catch (error: unknown) {
    logError("[library-settings] createHoliday:", error);
    sendError(res, error, "Failed to create holiday");
  }
};

const updateHoliday: RequestHandler = async (req, res) => {
  try {
    const holidayId = routeId(req.params.holidayId);
    const holiday = await service.updateHoliday(holidayId, {
      name: req.body?.name,
      holidayDate: req.body?.holiday_date,
      description: req.body?.description,
    }, userId(req));
    res.locals.auditEnqueued = true;
    res.json({ message: "Holiday updated successfully", holiday });
  } catch (error: unknown) {
    logError("[library-settings] updateHoliday:", error);
    sendError(res, error, "Failed to update holiday");
  }
};

const deleteHoliday: RequestHandler = async (req, res) => {
  try {
    const holidayId = routeId(req.params.holidayId);
    const result = await service.deleteHoliday(holidayId, userId(req));
    res.locals.auditEnqueued = true;
    res.json({ ...result, message: "Holiday archived. Its saved due dates remain unchanged." });
  } catch (error: unknown) {
    logError("[library-settings] deleteHoliday:", error);
    sendError(res, error, "Failed to remove holiday");
  }
};

const restoreHoliday: RequestHandler = async (req, res) => {
  try {
    const result = await service.restoreHoliday(routeId(req.params.holidayId), userId(req));
    res.locals.auditEnqueued = true;
    res.json({ ...result, message: "Holiday restored" });
  } catch (error: unknown) {
    sendError(res, error, "Failed to restore holiday");
  }
};

const listAcademicPrograms: RequestHandler = async (req, res) => {
  try {
    const programs = await service.listAcademicPrograms({ status: recordStatus(req.query?.status) });
    res.json({ programs });
  } catch (error: unknown) {
    logError("[library-settings] listAcademicPrograms:", error);
    res.status(500).json({ message: "Failed to fetch programs / courses" });
  }
};

const createAcademicProgram: RequestHandler = async (req, res) => {
  try {
    const program = await service.createAcademicProgram({ name: req.body?.name }, userId(req));
    res.locals.auditEnqueued = true;
    res.status(201).json({ message: "Program / course added", program });
  } catch (error: unknown) {
    logError("[library-settings] createAcademicProgram:", error);
    sendError(res, error, "Failed to add program / course");
  }
};

const updateAcademicProgram: RequestHandler = async (req, res) => {
  try {
    const program = await service.updateAcademicProgram(
      routeId(req.params.programId), { name: req.body?.name }, userId(req),
    );
    res.locals.auditEnqueued = true;
    res.json({ message: "Program / course updated", program });
  } catch (error: unknown) {
    logError("[library-settings] updateAcademicProgram:", error);
    sendError(res, error, "Failed to update program / course");
  }
};

const deleteAcademicProgram: RequestHandler = async (req, res) => {
  try {
    const result = await service.deleteAcademicProgram(routeId(req.params.programId), userId(req));
    res.locals.auditEnqueued = true;
    res.locals.auditDetails = { affectedCount: result.reference_count, action: result.action };
    res.json({
      ...result,
      message: result.action === "deleted"
        ? "Unused program / course permanently deleted"
        : "Program / course archived because records still reference it",
    });
  } catch (error: unknown) {
    logError("[library-settings] deleteAcademicProgram:", error);
    sendError(res, error, "Failed to remove program / course");
  }
};

const restoreAcademicProgram: RequestHandler = async (req, res) => {
  try {
    const result = await service.restoreAcademicProgram(routeId(req.params.programId), userId(req));
    res.locals.auditEnqueued = true;
    res.json({ ...result, message: "Program / course restored" });
  } catch (error: unknown) {
    sendError(res, error, "Failed to restore program / course");
  }
};

const listDepartments: RequestHandler = async (req, res) => {
  try {
    const departments = await service.listDepartments({ status: recordStatus(req.query?.status) });
    res.json({ departments });
  } catch {
    res.status(500).json({ message: "Failed to fetch departments" });
  }
};

const createDepartment: RequestHandler = async (req, res) => {
  try {
    const department = await service.createDepartment({ name: req.body?.name }, userId(req));
    res.locals.auditEnqueued = true;
    res.status(201).json({ message: "Department added", department });
  } catch (error: unknown) {
    sendError(res, error, "Failed to add department");
  }
};

const updateDepartment: RequestHandler = async (req, res) => {
  try {
    const department = await service.updateDepartment(
      routeId(req.params.departmentId), { name: req.body?.name }, userId(req),
    );
    res.locals.auditEnqueued = true;
    res.json({ message: "Department updated", department });
  } catch (error: unknown) {
    sendError(res, error, "Failed to update department");
  }
};

const deleteDepartment: RequestHandler = async (req, res) => {
  try {
    const result = await service.deleteDepartment(routeId(req.params.departmentId), userId(req));
    res.locals.auditEnqueued = true;
    res.json({
      ...result,
      message: result.action === "deleted"
        ? "Unused department permanently deleted"
        : "Department archived because employee records still reference it",
    });
  } catch (error: unknown) {
    sendError(res, error, "Failed to remove department");
  }
};

const restoreDepartment: RequestHandler = async (req, res) => {
  try {
    const result = await service.restoreDepartment(routeId(req.params.departmentId), userId(req));
    res.locals.auditEnqueued = true;
    res.json({ ...result, message: "Department restored" });
  } catch (error: unknown) {
    sendError(res, error, "Failed to restore department");
  }
};

const listAcademicTerms: RequestHandler = async (_req, res) => {
  try {
    res.json({ terms: await service.listAcademicTerms() });
  } catch {
    res.status(500).json({ message: "Failed to fetch academic terms" });
  }
};

const createAcademicTerm: RequestHandler = async (req, res) => {
  try {
    const term = await service.createAcademicTerm({
      name: req.body?.name,
      startsOn: req.body?.starts_on,
      endsOn: req.body?.ends_on,
      isCurrent: Boolean(req.body?.is_current),
    }, userId(req));
    res.locals.auditEnqueued = true;
    res.status(201).json({ message: "Academic term added", term });
  } catch (error: unknown) {
    sendError(res, error, "Failed to add academic term");
  }
};

const updateAcademicTerm: RequestHandler = async (req, res) => {
  try {
    const term = await service.updateAcademicTerm(routeId(req.params.termId), {
      name: req.body?.name,
      startsOn: req.body?.starts_on,
      endsOn: req.body?.ends_on,
      isCurrent: Boolean(req.body?.is_current),
    }, userId(req));
    res.locals.auditEnqueued = true;
    res.json({ message: "Academic term updated", term });
  } catch (error: unknown) {
    sendError(res, error, "Failed to update academic term");
  }
};

const deleteAcademicTerm: RequestHandler = async (req, res) => {
  try {
    await service.deleteAcademicTerm(routeId(req.params.termId), userId(req));
    res.locals.auditEnqueued = true;
    res.json({ message: "Academic term deleted" });
  } catch (error: unknown) {
    sendError(res, error, "Failed to delete academic term");
  }
};

const setCurrentAcademicTerm: RequestHandler = async (req, res) => {
  try {
    await service.setCurrentAcademicTerm(routeId(req.params.termId), userId(req));
    res.locals.auditEnqueued = true;
    res.json({ message: "Current academic term updated" });
  } catch (error: unknown) {
    sendError(res, error, "Failed to update academic term");
  }
};

export = {
  getLibrarySettings,
  updateLibrarySettings,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  restoreHoliday,
  listAcademicPrograms,
  createAcademicProgram,
  updateAcademicProgram,
  deleteAcademicProgram,
  restoreAcademicProgram,
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  restoreDepartment,
  listAcademicTerms,
  createAcademicTerm,
  updateAcademicTerm,
  deleteAcademicTerm,
  setCurrentAcademicTerm,
};
