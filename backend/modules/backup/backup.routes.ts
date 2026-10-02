const express = require("express");
const { authMiddleware } = require("../auth/auth.middleware");
const controller = require("./backup.controller");
const { limiters } = require("../../middlewares/rateLimiter");

const router = express.Router();
const superAdminOnly = authMiddleware(["super_admin"]);
router.get("/backup/export", superAdminOnly, limiters.backup, controller.exportBackup);
router.get("/backup/snapshots", superAdminOnly, controller.listSavedSnapshots);
router.get("/backup/status", superAdminOnly, controller.backupStatus);
router.post("/backup/compatibility", superAdminOnly, limiters.backup, controller.checkCompatibility);
router.get("/backup/snapshots/:id/compatibility", superAdminOnly, limiters.backup, controller.checkSavedCompatibility);
router.post("/backup/snapshots", superAdminOnly, limiters.backup, controller.saveSnapshot);
router.get("/backup/snapshots/:id/download", superAdminOnly, limiters.backup, controller.downloadSnapshot);
router.post("/backup/snapshots/:id/restore", superAdminOnly, limiters.backup, controller.restoreSavedSnapshot);
router.post("/backup/restore", superAdminOnly, limiters.backup, controller.restoreUploadedSnapshot);

module.exports = router;
