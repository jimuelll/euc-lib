const express    = require("express");
const router     = express.Router();
const controller = require("./catalog.controller");
const {
  requireAdminRole,
  validateSchemaPayload,
  validateBookId,
} = require("./catalog.middleware");

// Note: verifyToken removed — app.js already applies authMiddleware() globally

router.get   ("/catalog-schema",                                          controller.getSchema);
router.put   ("/catalog-schema", requireAdminRole, validateSchemaPayload, controller.updateSchema);

router.get   ("/books",                                                   controller.getBooks);
router.post  ("/books",          requireAdminRole,                        controller.createBook);
router.put   ("/books/:id",      requireAdminRole, validateBookId,        controller.updateBook);
router.delete("/books/:id",      requireAdminRole, validateBookId,        controller.deleteBook);

module.exports = router;