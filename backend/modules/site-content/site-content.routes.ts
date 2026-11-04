import express = require("express");
import controller = require("./site-content.controller");

const router = express.Router();

router.get("/", controller.getSiteContent);

export = router;
