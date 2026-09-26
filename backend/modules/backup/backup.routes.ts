const express = require("express");
const { authMiddleware } = require("../auth/auth.middleware");
const controller = require("./backup.controller");

const router = express.Router();
const superAdminOnly = authMiddleware(["super_admin"]);
router.get("/backup/export", superAdminOnly, controller.exportBackup);
router.get("/backup/snapshots", superAdminOnly, controller.listSavedSnapshots);
router.get("/backup/status", superAdminOnly, controller.backupStatus);
router.post("/backup/compatibility", superAdminOnly, controller.checkCompatibility);
router.get("/backup/snapshots/:id/compatibility", superAdminOnly, controller.checkSavedCompatibility);
router.post("/backup/snapshots", superAdminOnly, controller.saveSnapshot);
router.get("/backup/snapshots/:id/download", superAdminOnly, controller.downloadSnapshot);
router.post("/backup/snapshots/:id/restore", superAdminOnly, controller.restoreSavedSnapshot);
router.post("/backup/restore", superAdminOnly, controller.restoreUploadedSnapshot);

module.exports = router;
