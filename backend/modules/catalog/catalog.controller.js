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
    // req.publicCatalogue is set by the route when called from the public endpoint
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
    res.status(500).json({ message: "Failed to create book" });
  }
};

const updateBook = async (req, res) => {
  try {
    await service.updateBook(req.params.id, req.body);
    res.json({ message: "Book updated successfully" });
  } catch (err) {
    console.error("[catalog] updateBook:", err);
    res.status(500).json({ message: "Failed to update book" });
  }
};

const deleteBook = async (req, res) => {
  try {
    await service.deleteBook(req.params.id);
    res.json({ message: "Book deleted successfully" });
  } catch (err) {
    console.error("[catalog] deleteBook:", err);
    res.status(500).json({ message: "Failed to delete book" });
  }
};

module.exports = { getSchema, updateSchema, getBooks, createBook, updateBook, deleteBook };