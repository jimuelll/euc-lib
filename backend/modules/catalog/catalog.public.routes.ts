import type { Request } from "express";

const express = require("express");
const controller = require("./catalog.controller");
const { limiters } = require("../../middlewares/rateLimiter");

const router = express.Router();

// These routes intentionally expose only fields marked public by the catalog
// schema. Administrative catalog routes remain mounted separately at /api/admin.
router.get("/catalogue/schema", limiters.publicCatalogue, controller.getPublicSchema);
router.get("/catalogue/search", limiters.publicCatalogue, (req: Request & { publicCatalogue?: boolean }, _res: unknown, next: () => void) => {
  req.publicCatalogue = true;
  next();
}, controller.getBooks);

module.exports = router;
