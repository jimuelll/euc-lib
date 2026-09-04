const express = require("express");
const controller = require("./librarySettings.controller");
const { authMiddleware } = require("../auth/auth.middleware");

const router = express.Router();
const adminOnly = authMiddleware(["admin", "super_admin"]);

router.get("/library-settings", adminOnly, controller.getLibrarySettings);
router.put("/library-settings", adminOnly, controller.updateLibrarySettings);
router.post("/library-holidays", adminOnly, controller.createHoliday);
router.put("/library-holidays/:holidayId", adminOnly, controller.updateHoliday);
router.delete("/library-holidays/:holidayId", adminOnly, controller.deleteHoliday);
router.get("/academic-programs", authMiddleware(["staff", "admin", "super_admin"]), controller.listAcademicPrograms);
router.post("/academic-programs", adminOnly, controller.createAcademicProgram);
router.put("/academic-programs/:programId", adminOnly, controller.updateAcademicProgram);
router.delete("/academic-programs/:programId", adminOnly, controller.deleteAcademicProgram);
router.get("/academic-terms", authMiddleware(["staff", "admin", "super_admin"]), controller.listAcademicTerms);
router.post("/academic-terms", adminOnly, controller.createAcademicTerm);
router.post("/academic-terms/:termId/current", adminOnly, controller.setCurrentAcademicTerm);

module.exports = router;
