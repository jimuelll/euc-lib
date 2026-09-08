const router = require("express").Router();
const controller = require("./recommendations.controller");
const { requireSuperAdminRole } = require("../catalog/catalog.middleware");
router.get("/recommendations/me", controller.mine);
router.post("/recommendations/:bookId/dismiss", controller.dismiss);
router.get("/admin/recommendations/embeddings/status", requireSuperAdminRole, controller.status);
router.post("/admin/recommendations/embeddings/backfill", requireSuperAdminRole, controller.backfill);
router.get("/admin/recommendations/embeddings/backfill/progress", requireSuperAdminRole, controller.backfillProgress);
module.exports = router;
