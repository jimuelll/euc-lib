const qr = require("qrcode");
const service = require("./catalog.service");

const getSchema = async (req, res) => {
  try {
    const fields = await service.getSchema();
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

    const oldFields     = await service.getSchema();
    const newKeys       = new Set(fields.map((f) => f.key));
    const removedFields = oldFields.filter((f) => !f.locked && !newKeys.has(f.key));

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
    const { query } = req.query;
    if (!query?.trim()) {
      return res.status(400).json({ message: "Search query is required" });
    }
    const books = await service.searchBooks(query.trim(), !!req.publicCatalogue);
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
    await service.deleteBook(req.params.id);
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
};