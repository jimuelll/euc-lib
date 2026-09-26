import type { Request, RequestHandler } from "express";

const router = require("express").Router();
const controller = require("./user-guide.controller");

// These routes are mounted after the application's global authentication
// middleware, so only the role check belongs here.
const requireRole = (roles: string[]): RequestHandler => (req, res, next) => {
  const user = (req as Request & { user?: { role: string } }).user;
  if (!user || !roles.includes(user.role)) return res.status(403).json({ message: "Forbidden" });
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
