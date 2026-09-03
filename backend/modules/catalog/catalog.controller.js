const qr = require("qrcode");
const service = require("./catalog.service");

const comparableSchema = (fields) => fields
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
  }))
  .sort((a, b) => a.key.localeCompare(b.key));

const getSchema = async (req, res) => {
  try {
    const canIncludeArchived = req.user && ["admin", "super_admin"].includes(req.user.role);
    const includeArchived = canIncludeArchived && req.query.includeArchived === "true";
    const fields = await service.getSchema({ includeArchived });
    res.json(fields);
  } catch (err) {
    console.error("[catalog] getSchema:", err);
    res.status(500).json({ message: "Failed to fetch schema" });
  }
};

const updateSchema = async (req, res) => {
  try {
    const { fields, baseFields } = req.body;
    const oldFields = await service.getSchema({ includeArchived: true });
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

    for (const f of fields) {
      await service.addColumnIfMissing(f.key, f.type);
    }

    const newKeys       = new Set(fields.map((f) => f.key));
    const removedFields = oldFields.filter((f) => !f.archived && !f.locked && !newKeys.has(f.key));

    for (const f of removedFields) {
      await service.dropColumnIfExists(f.key);
    }

    await service.upsertSchema(fields);
    res.json({ message: "Schema updated successfully" });
  } catch (err) {
    console.error("[catalog] updateSchema:", err);
    res.status(500).json({ message: "Failed to update schema" });
  }
};

const getBooks = async (req, res) => {
  try {
    const query = String(req.query.query ?? "").trim();
    if (!req.publicCatalogue && req.query.page !== undefined) {
      return res.json(await service.searchBooksPage({
        query,
        showArchived: req.query.archived === "true",
        materialType: String(req.query.materialType ?? "all"),
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
  } catch (err) {
    console.error("[catalog] getBooks:", err);
    res.status(500).json({ message: "Failed to fetch books" });
  }
};

const lookupIsbn = async (req, res) => {
  try { res.json(await service.lookupIsbn(req.params.isbn)); }
  catch (err) { res.status(err.status ?? 500).json({ message: err.message ?? "ISBN lookup failed" }); }
};

const getPublicSchema = async (_req, res) => {
  try {
    const fields = await service.getSchema();
    res.json(fields.filter((field) => field.public));
  } catch (err) {
    console.error("[catalog] getPublicSchema:", err);
    res.status(500).json({ message: "Failed to fetch public catalogue schema" });
  }
};

const createBook = async (req, res) => {
  try {
    const id = await service.createBook(req.body, req.user.student_employee_id);
    res.status(201).json({ message: "Book added successfully", id });
  } catch (err) {
    console.error("[catalog] createBook:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to create book" });
  }
};

const updateBook = async (req, res) => {
  try {
    await service.updateBook(req.params.id, req.body);
    res.json({ message: "Book updated successfully" });
  } catch (err) {
    console.error("[catalog] updateBook:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to update book" });
  }
};

const deleteBook = async (req, res) => {
  try {
    await service.deleteBook(req.params.id, req.user.id);
    res.json({ message: "Book deleted successfully" });
  } catch (err) {
    console.error("[catalog] deleteBook:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to delete book" });
  }
};

const getBookCopies = async (req, res) => {
  try {
    const copies = await service.getBookCopies(req.params.id);
    res.json(copies);
  } catch (err) {
    console.error("[catalog] getBookCopies:", err);
    res.status(500).json({ message: "Failed to fetch book copies" });
  }
};

/**
 * GET /copies/:barcode/barcode-png
 * Returns a CODE128 barcode as a PNG image — pipe directly to <img src="...">
 */
const getBarcodePng = async (req, res) => {
  try {
    const png = await qr.toBuffer(req.params.barcode, {
      type: "png",
      width: 300,        // explicit pixel size instead of scale
      margin: 2,         // quiet zone around the QR
      errorCorrectionLevel: "M",  // H = more robust but denser, L = smaller
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(png);
  } catch (err) {
    console.error("[catalog] getBarcodePng:", err);
    res.status(500).json({ message: "Failed to generate QR code" });
  }
};

/**
 * GET /copies/:barcode
 * Looks up a physical copy by barcode — used after a ZXing scan at the desk.
 * Returns copy details + parent book info.
 */
const getCopyByBarcode = async (req, res) => {
  try {
    const copy = await service.getCopyByBarcode(req.params.barcode);
    if (!copy) return res.status(404).json({ message: "Copy not found" });
    res.json(copy);
  } catch (err) {
    console.error("[catalog] getCopyByBarcode:", err);
    res.status(500).json({ message: "Failed to look up copy" });
  }
};

const restoreBook = async (req, res) => {
  try {
    const result = await service.restoreBook(req.params.id);
    res.json(result);
  } catch (err) {
    console.error("[catalog] restoreBook:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to restore book" });
  }
};

const getBookTypes = async (_req, res) => { try { res.json(await service.getBookTypes()); } catch { res.status(500).json({ message: "Failed to fetch book types" }); } };
const createBookType = async (req, res) => { try { res.status(201).json(await service.createBookType({ name: req.body?.name, defaultBorrowDays: req.body?.default_borrow_days, finePerHour: req.body?.fine_per_hour, fineInterval: req.body?.fine_interval, initialFine: req.body?.initial_fine })); } catch (err) { res.status(err.status ?? 500).json({ message: err.message ?? "Failed to create book type" }); } };
const updateBookType = async (req, res) => { try { res.json(await service.updateBookType(Number(req.params.id), { name: req.body?.name, defaultBorrowDays: req.body?.default_borrow_days, finePerHour: req.body?.fine_per_hour, fineInterval: req.body?.fine_interval, initialFine: req.body?.initial_fine })); } catch (err) { res.status(err.status ?? 500).json({ message: err.message ?? "Failed to update book type" }); } };
const updateCopyCondition = async (req, res) => { try { await service.updateCopyCondition(Number(req.params.copyId), req.body?.condition, req.body?.notes); res.json({ message: "Copy condition updated" }); } catch (err) { res.status(err.status ?? 500).json({ message: err.message ?? "Failed to update copy" }); } };

module.exports = {
  getSchema,
  getPublicSchema,
  updateSchema,
  getBooks,
  lookupIsbn,
  createBook,
  updateBook,
  deleteBook,
  getBookCopies,
  getBarcodePng,
  getCopyByBarcode,
  restoreBook,
  getBookTypes,
  createBookType,
  updateBookType,
  updateCopyCondition,
};
