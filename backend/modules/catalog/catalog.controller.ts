import type { Request, Response } from "express";

const qr = require("qrcode");
const service = require("./catalog.service");
const holdingsService = require("./catalog.holdings.service");
const catalogSettingsService = require("./catalog.settings.service");
const copyStateService = require("./catalog.copy-state.service");
const { logError } = require("../../logger");

interface CatalogHttpRequest extends Request {
  publicCatalogue?: boolean;
  user?: { id: number; role: string; student_employee_id: string | number };
  file?: { buffer: Buffer; size: number; mimetype: string };
}

const comparableSchema = (fields: Array<Record<string, any>>) => fields
  .map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    options: typeof field.options === "string" ? JSON.parse(field.options || "null") : (field.options ?? null),
    required: Boolean(field.required),
    locked: Boolean(field.locked),
    public: Boolean(field.public),
    order: Number(field.order),
    archived: Boolean(field.archived),
    scope: field.scope || "shared",
  }))
  .sort((a, b) => a.key.localeCompare(b.key));

const getSchema = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const canIncludeArchived = req.user && ["admin", "super_admin"].includes(req.user.role);
    const includeArchived = canIncludeArchived && req.query.includeArchived === "true";
    const fields = await service.getSchema({ includeArchived });
    res.json(fields);
  } catch (err: any) {
    logError("[catalog] getSchema:", err);
    res.status(500).json({ message: "Failed to fetch schema" });
  }
};

const updateSchema = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const { fields, baseFields }: { fields: Array<Record<string, any>>; baseFields: Array<Record<string, any>> } = req.body;
    const oldFields: Array<Record<string, any>> = await service.getSchema({ includeArchived: true });
    if (!Array.isArray(baseFields)) {
      return res.status(400).json({ message: "The form schema is missing its revision. Refresh the page and try again." });
    }
    if (JSON.stringify(comparableSchema(baseFields)) !== JSON.stringify(comparableSchema(oldFields))) {
      return res.status(409).json({ message: "The form schema changed in another session. Refresh to review the latest fields before saving." });
    }
    const oldByKey = new Map(oldFields.map((field) => [field.key, field]));

    // SQL column types are deliberately immutable. Changing a UI type without
    // migrating the stored values creates a form that lies about its data.
    for (const field of fields) {
      const existing = oldByKey.get(field.key);
      if (existing && existing.type !== field.type) {
        return res.status(409).json({ message: `The type of "${field.label}" cannot be changed after the field is created. Add a replacement field and migrate records instead.` });
      }
    }

    // Builder definitions are stored in catalog_schema and values in JSON metadata.
    // Never mutate the books table as a side effect of a form edit.
    await service.upsertSchema(fields);
    res.json({ message: "Schema updated successfully" });
  } catch (err: any) {
    logError("[catalog] updateSchema:", err);
    res.status(500).json({ message: "Failed to update schema" });
  }
};

const getBooks = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const query = String(req.query.query ?? "").trim();
    if (req.publicCatalogue) {
      return res.json(await service.searchPublicCatalogue({
        query,
        title: String(req.query.title ?? "").trim(),
        author: String(req.query.author ?? "").trim(),
        isbn: String(req.query.isbn ?? "").trim(),
        format: String(req.query.format ?? req.query.materialType ?? "all"),
        availability: String(req.query.availability ?? "all"),
        category: String(req.query.category ?? ""),
        sort: String(req.query.sort ?? "relevance"),
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      }));
    }
    if (!req.publicCatalogue && req.query.page !== undefined) {
      return res.json(await service.searchBooksPage({
        query,
        status: ["active", "archived", "all"].includes(String(req.query.status))
          ? String(req.query.status)
          : (req.query.archived === "true" ? "archived" : "active"),
        materialType: String(req.query.materialType ?? "all"),
        policyStatus: String(req.query.policyStatus ?? "all"),
        page: Number(req.query.page),
        limit: Number(req.query.limit) || 25,
      }));
    }
    const books = await service.searchBooks(
      query,
      !!req.publicCatalogue,
      !req.publicCatalogue && req.query.archived === "true",
      req.publicCatalogue ? "all" : String(req.query.materialType ?? "all"),
      req.publicCatalogue ? req.query.page : null,
      req.publicCatalogue ? Number(req.query.limit) || 20 : undefined,
    );
    res.json(books);
  } catch (err: any) {
    logError("[catalog] getBooks:", err);
    res.status(500).json({ message: "Failed to fetch books" });
  }
};

const lookupIsbn = async (req: CatalogHttpRequest, res: Response) => {
  try { res.json(await service.lookupIsbn(req.params.isbn)); }
  catch (err: any) { res.status(err.status ?? 500).json({ message: err.message ?? "ISBN lookup failed" }); }
};

const getPublicSchema = async (_req: CatalogHttpRequest, res: Response) => {
  try {
    const fields = await service.getSchema();
    res.json((fields as Array<Record<string, any>>).filter((field: Record<string, any>) => field.public));
  } catch (err: any) {
    logError("[catalog] getPublicSchema:", err);
    res.status(500).json({ message: "Failed to fetch public catalogue schema" });
  }
};

const createBook = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const id = await service.createBook(req.body, req.user!.student_employee_id, req.user?.id);
    res.locals.auditEnqueued = true;
    res.status(201).json({ message: "Book added successfully", id });
  } catch (err: any) {
    logError("[catalog] createBook:", err);
    const duplicateIsbn = err?.code === "ER_DUP_ENTRY" && String(err.message).includes("uq_books_isbn");
    const isbnError = duplicateIsbn || (err?.status === 400 && /isbn/i.test(String(err.message)));
    const message = duplicateIsbn ? "This ISBN is already assigned to another book" : (err.message ?? "Failed to create book");
    res.status(duplicateIsbn ? 409 : (err.status ?? 500)).json({ message, ...(isbnError ? { fields: { isbn: message } } : {}) });
  }
};

const updateBook = async (req: CatalogHttpRequest, res: Response) => {
  try {
    await service.updateBook(Number(req.params.id), req.body, req.user?.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Book updated successfully" });
  } catch (err: any) {
    logError("[catalog] updateBook:", err);
    const duplicateIsbn = err?.code === "ER_DUP_ENTRY" && String(err.message).includes("uq_books_isbn");
    const isbnError = duplicateIsbn || (err?.status === 400 && /isbn/i.test(String(err.message)));
    const message = duplicateIsbn ? "This ISBN is already assigned to another book" : (err.message ?? "Failed to update book");
    res.status(duplicateIsbn ? 409 : (err.status ?? 500)).json({ message, ...(isbnError ? { fields: { isbn: message } } : {}) });
  }
};

const deleteBook = async (req: CatalogHttpRequest, res: Response) => {
  try {
    await service.deleteBook(Number(req.params.id), req.user!.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Book deleted successfully" });
  } catch (err: any) {
    logError("[catalog] deleteBook:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to delete book", ...(err.outstandingAmount !== undefined ? { outstandingAmount: err.outstandingAmount, affectedLoans: err.affectedLoans } : {}) });
  }
};

const getBookCopies = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const copies = await service.getBookCopies(Number(req.params.id));
    res.json(copies);
  } catch (err: any) {
    logError("[catalog] getBookCopies:", err);
    res.status(500).json({ message: "Failed to fetch book copies" });
  }
};

const uploadBookImage = async (req: CatalogHttpRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Choose an image to upload" });
    const result = await require("./catalog.image.service").uploadBookImage(Number(req.params.id), req.file, req.user?.id);
    res.locals.auditEnqueued = true;
    return res.json({ message: "Book image saved", ...result });
  } catch (err: any) {
    logError("[catalog] uploadBookImage:", err);
    return res.status(err.status ?? 500).json({ message: err.message ?? "Failed to upload book image" });
  }
};

const removeBookImage = async (req: CatalogHttpRequest, res: Response) => {
  try {
    await require("./catalog.image.service").removeBookImage(Number(req.params.id), req.user?.id);
    res.locals.auditEnqueued = true;
    return res.json({ message: "Book image removed", image_url: null, image_public_id: null });
  } catch (err: any) {
    logError("[catalog] removeBookImage:", err);
    return res.status(err.status ?? 500).json({ message: err.message ?? "Failed to remove book image" });
  }
};

const getBookHoldings = async (req: CatalogHttpRequest, res: Response) => {
  try { res.json(await holdingsService.getBookHoldings(Number(req.params.id))); }
  catch (err: any) { logError("[catalog] getBookHoldings:", err); res.status(500).json({ message: "Failed to fetch book holdings" }); }
};

const getHoldings = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const result = await holdingsService.searchHoldings({
      query: String(req.query.query ?? "").trim(),
      programId: req.query.programId ? Number(req.query.programId) : null,
      status: ["all", "available", "borrowed", "reserved", "inactive"].includes(String(req.query.status)) ? String(req.query.status) : "all",
      completion: ["all", "complete", "missing"].includes(String(req.query.completion)) ? String(req.query.completion) : "all",
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 25,
    });
    res.json({ ...result, pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / result.limit)) } });
  } catch (err: any) { logError("[catalog] getHoldings:", err); res.status(500).json({ message: "Failed to fetch holdings" }); }
};

const updateHolding = async (req: CatalogHttpRequest, res: Response) => {
  try {
    await holdingsService.updateHolding(Number.parseInt(String(req.params.copyId), 10), req.body, req.user?.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Holding saved successfully" });
  } catch (err: any) {
    logError("[catalog] updateHolding:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to save holding" });
  }
};

const voidAccession = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const result = await holdingsService.voidAccession(Number.parseInt(String(req.params.copyId), 10), req.body, req.user?.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Accession voided permanently. Add a new physical copy to register a corrected accession.", accessionNumber: result.accessionNumber });
  } catch (err: any) { res.status(err.status ?? 500).json({ message: err.message ?? "Failed to void accession" }); }
};

const retireCopy = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const result = await copyStateService.retireCopy(Number.parseInt(String(req.params.copyId), 10), req.user?.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Copy retired", copies: result.copies });
  } catch (err: any) { res.status(err.status ?? 500).json({ message: err.message ?? "Failed to retire copy" }); }
};

const restoreCopy = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const result = await copyStateService.restoreCopy(Number.parseInt(String(req.params.copyId), 10), req.user?.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Copy restored", copies: result.copies, lendingEligible: result.lendingEligible });
  } catch (err: any) { res.status(err.status ?? 500).json({ message: err.message ?? "Failed to restore copy" }); }
};

const getCatalogSettings = async (_req: CatalogHttpRequest, res: Response) => {
  try { res.json(await catalogSettingsService.getCatalogSettings()); }
  catch (err: any) { logError("[catalog] getCatalogSettings:", err); res.status(500).json({ message: "Failed to fetch catalog settings" }); }
};

const updateCatalogSettings = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const settings = await catalogSettingsService.updateCatalogSettings(req.body?.show_unheld_in_opac, req.user?.id);
    res.locals.auditEnqueued = true;
    res.json({ message: "Catalog settings updated", settings });
  } catch (err: any) { res.status(err.status ?? 500).json({ message: err.message ?? "Failed to update catalog settings" }); }
};

/**
 * GET /copies/:barcode/barcode-png
 * Returns a CODE128 barcode as a PNG image — pipe directly to <img src="...">
 */
const getBarcodePng = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const png = await qr.toBuffer(String(req.params.barcode), {
      type: "png",
      width: 300,        // explicit pixel size instead of scale
      margin: 2,         // quiet zone around the QR
      errorCorrectionLevel: "M",  // H = more robust but denser, L = smaller
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(png);
  } catch (err: any) {
    logError("[catalog] getBarcodePng:", err);
    res.status(500).json({ message: "Failed to generate QR code" });
  }
};

/**
 * GET /copies/:barcode
 * Looks up a physical copy by barcode — used after a ZXing scan at the desk.
 * Returns copy details + parent book info.
 */
const getCopyByBarcode = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const copy = await service.getCopyByBarcode(String(req.params.barcode));
    if (!copy) return res.status(404).json({ message: "Copy not found" });
    res.json(copy);
  } catch (err: any) {
    logError("[catalog] getCopyByBarcode:", err);
    res.status(500).json({ message: "Failed to look up copy" });
  }
};

const restoreBook = async (req: CatalogHttpRequest, res: Response) => {
  try {
    const result = await service.restoreBook(Number(req.params.id), req.user?.id);
    res.locals.auditEnqueued = true;
    res.json(result);
  } catch (err: any) {
    logError("[catalog] restoreBook:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to restore book" });
  }
};

const getBookTypes = async (_req: CatalogHttpRequest, res: Response) => { try { res.json(await service.getBookTypes()); } catch { res.status(500).json({ message: "Failed to fetch book types" }); } };
const createBookType = async (req: CatalogHttpRequest, res: Response) => { try { res.status(201).json(await service.createBookType({ name: req.body?.name, defaultBorrowDays: req.body?.default_borrow_days, durationMinutes: req.body?.loan_duration_minutes, durationUnit: req.body?.loan_duration_unit, finePerHour: req.body?.fine_per_hour, fineInterval: req.body?.fine_interval, initialFine: req.body?.initial_fine })); } catch (err: any) { res.status(err.status ?? 500).json({ message: err.message ?? "Failed to create book type" }); } };
const updateBookType = async (req: CatalogHttpRequest, res: Response) => { try { res.json(await service.updateBookType(Number(req.params.id), { name: req.body?.name, defaultBorrowDays: req.body?.default_borrow_days, durationMinutes: req.body?.loan_duration_minutes, durationUnit: req.body?.loan_duration_unit, finePerHour: req.body?.fine_per_hour, fineInterval: req.body?.fine_interval, initialFine: req.body?.initial_fine })); } catch (err: any) { res.status(err.status ?? 500).json({ message: err.message ?? "Failed to update book type" }); } };
const deleteBookType = async (req: CatalogHttpRequest, res: Response) => { try { const result = await service.deleteBookType(Number(req.params.id), req.user?.id); res.locals.auditEnqueued = true; res.json({ ...result, message: result.affected_books ? `Policy deleted. ${result.affected_books} ${result.affected_books === 1 ? "book now needs" : "books now need"} a loan policy.` : "Policy deleted." }); } catch (err: any) { res.status(err.status ?? 500).json({ message: err.message ?? "Failed to delete book type" }); } };
const updateCopyCondition = async (req: CatalogHttpRequest, res: Response) => { try { await service.updateCopyCondition(Number(req.params.copyId), req.body?.condition, req.body?.notes, req.user?.id); res.locals.auditEnqueued = true; res.json({ message: "Copy condition updated" }); } catch (err: any) { res.status(err.status ?? 500).json({ message: err.message ?? "Failed to update copy" }); } };

export = {
  getSchema,
  getPublicSchema,
  updateSchema,
  getBooks,
  lookupIsbn,
  createBook,
  updateBook,
  uploadBookImage,
  removeBookImage,
  deleteBook,
  getBookCopies,
  getBookHoldings,
  getHoldings,
  updateHolding,
  voidAccession,
  retireCopy,
  restoreCopy,
  getCatalogSettings,
  updateCatalogSettings,
  getBarcodePng,
  getCopyByBarcode,
  restoreBook,
  getBookTypes,
  createBookType,
  updateBookType,
  deleteBookType,
  updateCopyCondition,
};
