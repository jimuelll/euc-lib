const express = require("express");
const controller = require("./library-settings.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const router = express.Router();
const adminOnly = authMiddleware(["admin", "super_admin"]);

router.get("/library-settings", adminOnly, controller.getLibrarySettings);
router.put("/library-settings", adminOnly, controller.updateLibrarySettings);
router.post("/library-holidays", adminOnly, controller.createHoliday);
router.put("/library-holidays/:holidayId", adminOnly, controller.updateHoliday);
router.delete("/library-holidays/:holidayId", adminOnly, controller.deleteHoliday);
router.post("/library-holidays/:holidayId/restore", adminOnly, controller.restoreHoliday);
router.get("/academic-programs", authMiddleware(["staff", "admin", "super_admin"]), controller.listAcademicPrograms);
router.post("/academic-programs", adminOnly, controller.createAcademicProgram);
router.put("/academic-programs/:programId", adminOnly, controller.updateAcademicProgram);
router.delete("/academic-programs/:programId", adminOnly, controller.deleteAcademicProgram);
router.post("/academic-programs/:programId/restore", adminOnly, controller.restoreAcademicProgram);
router.get("/departments", authMiddleware(["staff", "admin", "super_admin"]), controller.listDepartments);
router.post("/departments", adminOnly, controller.createDepartment);
router.put("/departments/:departmentId", adminOnly, controller.updateDepartment);
router.delete("/departments/:departmentId", adminOnly, controller.deleteDepartment);
router.post("/departments/:departmentId/restore", adminOnly, controller.restoreDepartment);
router.get("/academic-terms", authMiddleware(["staff", "admin", "super_admin"]), controller.listAcademicTerms);
router.post("/academic-terms", adminOnly, controller.createAcademicTerm);
router.put("/academic-terms/:termId", adminOnly, controller.updateAcademicTerm);
router.delete("/academic-terms/:termId", adminOnly, controller.deleteAcademicTerm);
router.post("/academic-terms/:termId/current", adminOnly, controller.setCurrentAcademicTerm);

module.exports = router;
