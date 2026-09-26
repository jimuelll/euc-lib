import type { Request, RequestHandler } from "express";

type Validator = (req: Request) => unknown | Promise<unknown>;
type ValidationError = Error & { status?: number; field?: string | null };

const validate = (validator: Validator): RequestHandler => async (req, res, next) => {
  try {
    await validator(req);
    next();
  } catch (err) {
    const error = err as ValidationError;
    const field = error.field || String(error.message || "").match(/Field "([a-z0-9_]+)"/i)?.[1];
    res.status(error.status ?? 400).json({
      message: error.message ?? "Invalid request",
      ...(field ? { fields: { [field]: error.message ?? "Invalid value" } } : {}),
    });
  }
};

const createValidationError = (message: string, status = 400, field: string | null = null) =>
  Object.assign(new Error(message), { status, ...(field ? { field } : {}) });

export = { validate, createValidationError };
