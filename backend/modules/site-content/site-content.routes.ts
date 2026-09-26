import express = require("express");
import auth = require("../auth/auth.middleware");
import controller = require("./site-content.controller");

const router = express.Router();
const { authMiddleware } = auth;

router.get("/", controller.getSiteContent);
router.put("/", authMiddleware(["admin", "super_admin"]), controller.updateSiteContent);

export = router;
