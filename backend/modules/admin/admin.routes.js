const express = require("express");
const {
  handleCreateUser,
  handleDeleteUser,
  handleUpdateUser,
  handleSearchUsers,
  handleRestoreUser,
  handleQueryToolsSearch,
} = require("./admin.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const router = express.Router();

const adminOnly = authMiddleware(["admin", "super_admin"]);
const staffOrAbove = authMiddleware(["staff", "admin", "super_admin"]);

router.post("/users", staffOrAbove, handleCreateUser);
router.delete("/users/:student_employee_id", staffOrAbove, handleDeleteUser);
router.put("/users/:student_employee_id", staffOrAbove, handleUpdateUser);
router.get("/users", staffOrAbove, handleSearchUsers);
router.patch("/users/:student_employee_id/restore", staffOrAbove, handleRestoreUser);
router.get("/query-tools", staffOrAbove, handleQueryToolsSearch);

module.exports = router;
