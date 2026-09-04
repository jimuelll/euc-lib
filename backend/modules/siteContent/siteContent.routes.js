const router = require("express").Router();
const service = require("./siteContent.service");
const { authMiddleware } = require("../auth/auth.middleware");
router.get("/", async (_req, res) => { try { res.json(await service.get()); } catch (error) { res.status(500).json({ message: "Failed to load site content" }); } });
router.put("/", authMiddleware(["admin", "super_admin"]), async (req, res) => { try { res.json(await service.update(req.body, req.user?.id)); } catch (error) { res.status(error.status || 500).json({ message: error.message || "Failed to save site content" }); } });
module.exports = router;
