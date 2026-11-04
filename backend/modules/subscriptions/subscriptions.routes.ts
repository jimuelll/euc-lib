import express = require("express");
import controller = require("./subscriptions.controller");
import auth = require("../auth/auth.middleware");

const router = express.Router();
const { authMiddleware } = auth;

// Subscriptions are edited through the publishing module; this router only serves the active list.
router.get("/subscriptions", authMiddleware(), controller.getPublicSubscriptions);

export = router;
