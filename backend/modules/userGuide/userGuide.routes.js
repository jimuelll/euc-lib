const router = require("express").Router();
const controller = require("./userGuide.controller");

// These routes are mounted after the application's global authentication
// middleware, so only the role check belongs here.
const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: "Forbidden" });
  next();
};

const guideReader = requireRole(["staff", "admin", "super_admin"]);
const guideEditor = requireRole(["admin", "super_admin"]);

router.get("/user-guide", guideReader, controller.listPublished);
router.get("/admin/user-guide", guideEditor, controller.listForAdmin);
router.post("/admin/user-guide", guideEditor, controller.createDraft);
router.patch("/admin/user-guide/reorder", guideEditor, controller.reorder);
router.put("/admin/user-guide/:id", guideEditor, controller.updateDraft);
router.post("/admin/user-guide/:id/publish", guideEditor, controller.publish);
router.post("/admin/user-guide/:id/unpublish", guideEditor, controller.unpublish);
router.delete("/admin/user-guide/:id", guideEditor, controller.archive);

module.exports = router;
