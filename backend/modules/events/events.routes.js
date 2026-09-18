const router = require("express").Router();
const { authMiddleware } = require("../auth/auth.middleware");
const controller = require("./events.controller");

router.get("/", controller.listEvents);
router.post("/", authMiddleware(["admin", "super_admin"]), controller.createEvent);
router.delete("/:id", authMiddleware(["admin", "super_admin"]), controller.deleteEvent);
module.exports = router;
