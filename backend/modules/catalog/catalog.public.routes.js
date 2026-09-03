const express = require("express");
const controller = require("./catalog.controller");

const router = express.Router();

// These routes intentionally expose only fields marked public by the catalog
// schema. Administrative catalog routes remain mounted separately at /api/admin.
router.get("/catalogue/schema", controller.getPublicSchema);
router.get("/catalogue/search", (req, _res, next) => {
  req.publicCatalogue = true;
  next();
}, controller.getBooks);

module.exports = router;
