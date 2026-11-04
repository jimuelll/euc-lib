import express = require("express");
import auth = require("../auth/auth.middleware");
import controller = require("./events.controller");

const router = express.Router();
const { authMiddleware } = auth;

router.get("/", controller.listEvents);
router.post("/", authMiddleware(["admin", "super_admin"]), controller.createEvent);

export = router;
