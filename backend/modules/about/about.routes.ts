import express = require("express");
import controller = require("./about.controller");

const router = express.Router();
// GET /api/about (edited through the publishing module)
router.get("/", controller.getAbout);

export = router;
