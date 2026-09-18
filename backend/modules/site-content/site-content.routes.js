const router = require("express").Router();
const { authMiddleware } = require("../auth/auth.middleware");
const controller = require("./site-content.controller");
router.get("/", controller.getSiteContent);
router.put("/", authMiddleware(["admin", "super_admin"]), controller.updateSiteContent);
module.exports = router;
