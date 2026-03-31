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

module.exports = router;
