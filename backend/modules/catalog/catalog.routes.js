const express    = require("express");
const router     = express.Router();
const controller = require("./catalog.controller");
const {
  requireSuperAdminRole,
  requireCatalogRole,
  validateSchemaPayload,
  validateBookId,
  validateBarcode,
  validateCreateBookPayload,
  validateUpdateBookPayload,
} = require("./catalog.middleware");

router.get   ("/catalog-schema",                                          controller.getSchema);
router.get   ("/book-types", requireCatalogRole, controller.getBookTypes);
router.post  ("/book-types", requireSuperAdminRole, controller.createBookType);
router.put   ("/book-types/:id", requireSuperAdminRole, controller.updateBookType);
router.put   ("/catalog-schema", requireSuperAdminRole, validateSchemaPayload, controller.updateSchema);

router.get   ("/books",                                                   controller.getBooks);
router.get   ("/books/isbn/:isbn", requireCatalogRole, controller.lookupIsbn);
router.post  ("/books",          requireCatalogRole, validateCreateBookPayload,           controller.createBook);
router.put   ("/books/:id",      requireCatalogRole, validateBookId, validateUpdateBookPayload, controller.updateBook);
router.delete("/books/:id",      requireCatalogRole, validateBookId,        controller.deleteBook);

router.get   ("/books/:id/copies",           requireCatalogRole, validateBookId,  controller.getBookCopies);

// Barcode image + copy lookup (used at the desk / scanner)
router.get   ("/copies/:barcode/barcode-png", requireCatalogRole, validateBarcode, controller.getBarcodePng);
router.get   ("/copies/:barcode",             requireCatalogRole, validateBarcode, controller.getCopyByBarcode);
router.patch ("/copies/:copyId", requireCatalogRole, controller.updateCopyCondition);

router.get("/catalogue/search", (req, res, next) => {
  req.publicCatalogue = true;
  next();
}, controller.getBooks);

router.post("/books/:id/restore", requireCatalogRole, validateBookId, controller.restoreBook);

module.exports = router;
