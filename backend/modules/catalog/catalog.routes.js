const express    = require("express");
const router     = express.Router();
const controller = require("./catalog.controller");
const {
  requireAdminRole,
  validateSchemaPayload,
  validateBookId,
  validateBarcode,
} = require("./catalog.middleware");

router.get   ("/catalog-schema",                                          controller.getSchema);
router.put   ("/catalog-schema", requireAdminRole, validateSchemaPayload, controller.updateSchema);

router.get   ("/books",                                                   controller.getBooks);
router.post  ("/books",          requireAdminRole,                        controller.createBook);
router.put   ("/books/:id",      requireAdminRole, validateBookId,        controller.updateBook);
router.delete("/books/:id",      requireAdminRole, validateBookId,        controller.deleteBook);

router.get   ("/books/:id/copies",           requireAdminRole, validateBookId,  controller.getBookCopies);

// Barcode image + copy lookup (used at the desk / scanner)
router.get   ("/copies/:barcode/barcode-png", requireAdminRole, validateBarcode, controller.getBarcodePng);
router.get   ("/copies/:barcode",             requireAdminRole, validateBarcode, controller.getCopyByBarcode);

router.get("/catalogue/search", (req, res, next) => {
  req.publicCatalogue = true;
  next();
}, controller.getBooks);

router.post("/books/:id/restore", requireAdminRole, validateBookId, controller.restoreBook);

module.exports = router;