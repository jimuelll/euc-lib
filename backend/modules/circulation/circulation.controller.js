const service = require("./circulation.service");

const lookupUser = async (req, res) => {
  try {
    const { student_employee_id } = req.query;
    if (!student_employee_id?.trim()) {
      return res.status(400).json({ message: "student_employee_id is required" });
    }

    const result = await service.lookupUser(student_employee_id);
    res.json(result);
  } catch (err) {
    console.error("[circulation] lookupUser:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to look up user" });
  }
};

const lookupBook = async (req, res) => {
  try {
    const { isbn } = req.query;
    if (!isbn?.trim()) {
      return res.status(400).json({ message: "ISBN is required" });
    }

    const book = await service.lookupBook(isbn);
    res.json(book);
  } catch (err) {
    console.error("[circulation] lookupBook:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to look up book" });
  }
};

const processBorrow = async (req, res) => {
  try {
    const { userId, bookId, dueDate } = req.body;
    if (!userId || !bookId || !dueDate) {
      return res.status(400).json({ message: "userId, bookId, and dueDate are required" });
    }

    const result = await service.processBorrow({
      userId,
      bookId,
      dueDate,
      issuedBy: req.user.id,
    });
    res.status(201).json(result);
  } catch (err) {
    console.error("[circulation] processBorrow:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to process borrow" });
  }
};

const processReturn = async (req, res) => {
  try {
    const { borrowingId } = req.body;
    if (!borrowingId) {
      return res.status(400).json({ message: "borrowingId is required" });
    }

    await service.processReturn(borrowingId);
    res.json({ message: "Book returned successfully" });
  } catch (err) {
    console.error("[circulation] processReturn:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to process return" });
  }
};

const processRenew = async (req, res) => {
  try {
    const { borrowingId, dueDate } = req.body;
    if (!borrowingId || !dueDate) {
      return res.status(400).json({ message: "borrowingId and dueDate are required" });
    }

    const result = await service.processRenew({ borrowingId, dueDate });
    res.json(result);
  } catch (err) {
    console.error("[circulation] processRenew:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to process renewal" });
  }
};

const getCirculationLog = async (req, res) => {
  try {
    const status = req.query.status || "";
    const search = req.query.search || "";
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await service.getCirculationLog({ status, search, page, limit });
    res.json(result);
  } catch (err) {
    console.error("[circulation] getCirculationLog:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to fetch circulation log" });
  }
};

module.exports = { lookupUser, lookupBook, processBorrow, processReturn, processRenew, getCirculationLog };
