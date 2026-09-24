const express    = require("express");
const router     = express.Router();
const controller = require("./catalog.controller");
const {
  requireSuperAdminRole,
  requireCatalogRole,
  validateSchemaPayload,
  validateBookId,
  validateBarcode,
  validateBookTypeId,
  validateCreateBookPayload,
  validateUpdateBookPayload,
} = require("./catalog.middleware");

const validateCopyIdParam = (req, res, next) => {
  const copyId = Number(req.params.copyId);
  if (!Number.isSafeInteger(copyId) || copyId < 1) return res.status(400).json({ message: "Invalid copy ID" });
  req.params.copyId = copyId;
  next();
};

router.get   ("/catalog-schema", requireCatalogRole,                       controller.getSchema);
router.get   ("/catalog-settings", requireCatalogRole, controller.getCatalogSettings);
router.put   ("/catalog-settings", requireSuperAdminRole, controller.updateCatalogSettings);
router.get   ("/book-types", requireCatalogRole, controller.getBookTypes);
router.post  ("/book-types", requireSuperAdminRole, controller.createBookType);
router.put   ("/book-types/:id", requireSuperAdminRole, controller.updateBookType);
router.delete("/book-types/:id", requireSuperAdminRole, validateBookTypeId, controller.deleteBookType);
router.put   ("/catalog-schema", requireSuperAdminRole, validateSchemaPayload, controller.updateSchema);

router.get   ("/books",          requireCatalogRole,                       controller.getBooks);
router.get   ("/books/isbn/:isbn", requireCatalogRole, controller.lookupIsbn);
router.post  ("/books",          requireCatalogRole, validateCreateBookPayload,           controller.createBook);
router.put   ("/books/:id",      requireCatalogRole, validateBookId, validateUpdateBookPayload, controller.updateBook);
router.delete("/books/:id",      requireCatalogRole, validateBookId,        controller.deleteBook);

router.get   ("/books/:id/copies",           requireCatalogRole, validateBookId,  controller.getBookCopies);
router.get   ("/books/:id/holdings",          requireCatalogRole, validateBookId, controller.getBookHoldings);
router.get   ("/holdings",                    requireCatalogRole, controller.getHoldings);
router.put   ("/copies/:copyId/holding",      requireCatalogRole, validateCopyIdParam, controller.updateHolding);
router.post  ("/copies/:copyId/holding/void-accession", requireSuperAdminRole, validateCopyIdParam, controller.voidAccession);
router.post  ("/copies/:copyId/retire", requireCatalogRole, validateCopyIdParam, controller.retireCopy);
router.post  ("/copies/:copyId/restore", requireCatalogRole, validateCopyIdParam, controller.restoreCopy);

// Barcode image + copy lookup (used at the desk / scanner)
router.get   ("/copies/:barcode/barcode-png", requireCatalogRole, validateBarcode, controller.getBarcodePng);
router.get   ("/copies/:barcode",             requireCatalogRole, validateBarcode, controller.getCopyByBarcode);
router.patch ("/copies/:copyId", requireCatalogRole, validateCopyIdParam, controller.updateCopyCondition);

router.get("/catalogue/search", (req, res, next) => {
  req.publicCatalogue = true;
  next();
}, controller.getBooks);

router.post("/books/:id/restore", requireCatalogRole, validateBookId, controller.restoreBook);

module.exports = router;
