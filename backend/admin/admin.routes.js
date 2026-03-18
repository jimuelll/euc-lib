const express = require("express");
const {
  handleCreateUser,
  handleDeleteUser,
  handleUpdateUser,
  handleSearchUsers,
} = require("./admin.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const router = express.Router();

// Protect routes: admin or super_admin
router.use(authMiddleware(["admin", "super_admin"]));

// Create a new user
router.post("/users", handleCreateUser);

// Delete a user
router.delete("/users/:student_employee_id", handleDeleteUser);

// Update a user
router.put("/users/:student_employee_id", handleUpdateUser);

// Search users (query params: student_employee_id, name, role)
router.get("/users", handleSearchUsers);

module.exports = router;