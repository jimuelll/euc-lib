const express = require("express");
const {
  handleCreateUser,
  handleDeleteUser,
  handleUpdateUser,
  handleSearchUsers,
} = require("./admin.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const router = express.Router();

const adminOnly = authMiddleware(["admin", "super_admin"]);

router.post  ("/users",                     adminOnly, handleCreateUser);
router.delete("/users/:student_employee_id", adminOnly, handleDeleteUser);
router.put   ("/users/:student_employee_id", adminOnly, handleUpdateUser);
router.get   ("/users",                     adminOnly, handleSearchUsers);

module.exports = router;