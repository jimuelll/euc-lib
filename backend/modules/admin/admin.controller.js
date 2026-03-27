const { createUser, deleteUser, updateUser, searchUsers } = require("./admin.service");
const qr = require("qrcode");
const db = require("../../db");

// CREATE
async function handleCreateUser(req, res) {
  try {
    const result = await createUser(req.body, req.user.role);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// DELETE
async function handleDeleteUser(req, res) {
  try {
    const { student_employee_id } = req.params;
    const result = await deleteUser(student_employee_id, req.user.role);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// UPDATE
async function handleUpdateUser(req, res) {
  try {
    const { student_employee_id } = req.params;
    const result = await updateUser(student_employee_id, req.body, req.user.role);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// SEARCH
async function handleSearchUsers(req, res) {
  try {
    const result = await searchUsers(req.query);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// GET /admin/users/:student_employee_id/barcode-png
async function handleGetBarcodePng(req, res) {
  try {
    const [[user]] = await db.query(
      "SELECT barcode FROM users WHERE student_employee_id = ?",
      [req.params.student_employee_id]
    );
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
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(png);
  } catch (err) {
    console.error("[admin] getBarcodePng:", err);
    res.status(500).json({ message: "Failed to generate QR code" });
  }
}

module.exports = {
  handleCreateUser,
  handleDeleteUser,
  handleUpdateUser,
  handleSearchUsers,
  handleGetBarcodePng,
};