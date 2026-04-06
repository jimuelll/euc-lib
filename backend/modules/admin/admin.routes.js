const express = require("express");
const {
  handleCreateUser,
  handleDeleteUser,
  handleUpdateUser,
  handleSearchUsers,
  handleRestoreUser,
  handleQueryToolsSearch,
  handleBulkDeactivateStudentLikeUsers,
} = require("./admin.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const router = express.Router();

const adminOnly = authMiddleware(["admin", "super_admin"]);
const userCreateRoles = authMiddleware(["staff", "admin", "super_admin"]);
const userSearchRoles = authMiddleware(["staff", "admin", "super_admin"]);

router.post("/users", userCreateRoles, handleCreateUser);
router.delete("/users/:student_employee_id", adminOnly, handleDeleteUser);
router.put("/users/:student_employee_id", adminOnly, handleUpdateUser);
router.post("/users/bulk-deactivate-student-like", adminOnly, handleBulkDeactivateStudentLikeUsers);
router.get("/users", userSearchRoles, handleSearchUsers);
router.patch("/users/:student_employee_id/restore", adminOnly, handleRestoreUser);
router.get("/query-tools", userSearchRoles, handleQueryToolsSearch);

module.exports = router;
