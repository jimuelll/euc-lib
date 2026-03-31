const express    = require("express");
const router     = express.Router();
const controller = require("./bulletin.controller");
const { authMiddleware, optionalAuthMiddleware } = require("../auth/auth.middleware");

const CAN_POST  = ["admin", "super_admin"];
const ADMIN_ONLY = ["admin", "super_admin"];

// ─── Public — no login required ───────────────────────────────────────────────
router.get("/",        optionalAuthMiddleware(), controller.getPosts);
router.get("/:postId", optionalAuthMiddleware(), controller.getPostById);

// ─── Protected — must be logged in ───────────────────────────────────────────
router.post  ("/",                            authMiddleware(CAN_POST),   controller.createPost);
router.delete("/:postId",                     authMiddleware(),            controller.deletePost);
router.patch ("/:postId/restore",             authMiddleware(ADMIN_ONLY), controller.restorePost);
router.patch ("/:postId/pin",                 authMiddleware(ADMIN_ONLY), controller.pinPost);

router.post  ("/:postId/like",                authMiddleware(), controller.toggleLike);
router.post  ("/:postId/comments",            authMiddleware(), controller.addComment);
router.delete("/:postId/comments/:commentId", authMiddleware(), controller.deleteComment);

module.exports = router;
