const qr = require("qrcode");
const service = require("./catalog.service");

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
    const { fields } = req.body;

    for (const f of fields) {
      await service.addColumnIfMissing(f.key, f.type);
    }

    const oldFields     = await service.getSchema({ includeArchived: true });
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
    const books = await service.searchBooks(
      query,
      !!req.publicCatalogue,
      !req.publicCatalogue && req.query.archived === "true"
    );
    res.json(books);
  } catch (err) {
    console.error("[catalog] getBooks:", err);
    res.status(500).json({ message: "Failed to fetch books" });
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

module.exports = {
  getSchema,
  updateSchema,
  getBooks,
  createBook,
  updateBook,
  deleteBook,
  getBookCopies,
  getBarcodePng,
  getCopyByBarcode,
  restoreBook,
};
