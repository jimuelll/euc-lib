const express    = require("express");
const router     = express.Router();
const controller = require("./catalog.controller");
const {
  requireAdminRole,
  validateSchemaPayload,
  validateBookId,
} = require("./catalog.middleware");

// Note: authMiddleware() is applied globally in app.js

router.get   ("/catalog-schema",                                          controller.getSchema);
router.put   ("/catalog-schema", requireAdminRole, validateSchemaPayload, controller.updateSchema);

// Admin book routes — full data
router.get   ("/books",                                                   controller.getBooks);
router.post  ("/books",          requireAdminRole,                        controller.createBook);
router.put   ("/books/:id",      requireAdminRole, validateBookId,        controller.updateBook);
router.delete("/books/:id",      requireAdminRole, validateBookId,        controller.deleteBook);

// Public catalogue search — only returns fields marked public: true in schema
router.get("/catalogue/search", (req, res, next) => {
  req.publicCatalogue = true;
  next();
}, controller.getBooks);

module.exports = router;