const {
  createUser,
  deleteUser,
  restoreUser,
  updateUser,
  searchUsers,
  queryToolsSearch,
} = require("./admin.service");
const { logError } = require("../../logger");
const qr = require("qrcode");
const repository = require("./admin.repository");

// CREATE
async function handleCreateUser(req, res) {
  try {
    const result = await createUser(req.body, req.user.role, req.user.id);
    res.locals.auditEnqueued = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status ?? 400).json({ message: err.message, ...(err.outstandingAmount !== undefined ? { outstandingAmount: err.outstandingAmount, affectedLoans: err.affectedLoans } : {}) });
  }
}

// DELETE
async function handleDeleteUser(req, res) {
  try {
    const { student_employee_id } = req.params;
    const result = await deleteUser(student_employee_id, req.user.role, req.user.id);
    res.locals.auditEnqueued = true;
    res.json(result);
  } catch (err) {
    res.status(err.status ?? 400).json({ message: err.message, ...(err.outstandingAmount !== undefined ? { outstandingAmount: err.outstandingAmount, affectedLoans: err.affectedLoans } : {}) });
  }
}

// RESTORE
async function handleRestoreUser(req, res) {
  try {
    const { student_employee_id } = req.params;
    const result = await restoreUser(student_employee_id, req.user.role, req.user.id);
    res.locals.auditEnqueued = true;
    res.json(result);
  } catch (err) {
    res.status(err.status ?? 400).json({ message: err.message });
  }
}

// UPDATE
async function handleUpdateUser(req, res) {
  try {
    const { student_employee_id } = req.params;
    const result = await updateUser(student_employee_id, req.body, req.user.role, req.user.id);
    res.locals.auditEnqueued = true;
    res.json(result);
  } catch (err) {
    res.status(err.status ?? 400).json({ message: err.message, ...(err.outstandingAmount !== undefined ? { outstandingAmount: err.outstandingAmount, affectedLoans: err.affectedLoans } : {}) });
  }
}

// SEARCH
async function handleSearchUsers(req, res) {
  try {
    const result = await searchUsers(req.query, req.user.role);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function handleQueryToolsSearch(req, res) {
  try {
    const result = await queryToolsSearch(req.query.q, req.user.role);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// GET /admin/users/:student_employee_id/barcode-png
async function handleGetBarcodePng(req, res) {
  try {
    const user = await repository.findActiveUserBarcode(req.params.student_employee_id);
    if (!user?.barcode) {
      return res.status(404).json({ message: "User or barcode not found" });
    }

    const png = await qr.toBuffer(user.barcode, {
      type: "png",
      width: 300,
      margin: 2,
      errorCorrectionLevel: "M",
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(png);
  } catch (err) {
    logError("[admin] getBarcodePng:", err);
    res.status(500).json({ message: "Failed to generate QR code" });
  }
}

module.exports = {
  handleCreateUser,
  handleDeleteUser,
  handleRestoreUser,
  handleUpdateUser,
  handleSearchUsers,
  handleQueryToolsSearch,
  handleGetBarcodePng,
};
