import express = require("express");
import controller = require("./bulletin.controller");
import auth = require("../auth/auth.middleware");

const router = express.Router();
const { authMiddleware, optionalAuthMiddleware } = auth;

const CAN_POST = ["staff", "admin", "super_admin"];
const ADMIN_ONLY = ["admin", "super_admin"];

router.get("/", optionalAuthMiddleware(), controller.getPosts);
router.get("/:postId/likes", optionalAuthMiddleware(), controller.getLikes);
router.get("/:postId", optionalAuthMiddleware(), controller.getPostById);

router.post("/", authMiddleware(CAN_POST), controller.createPost);
router.delete("/:postId", authMiddleware(), controller.deletePost);
router.patch("/:postId/restore", authMiddleware(CAN_POST), controller.restorePost);
router.patch("/:postId/pin", authMiddleware(ADMIN_ONLY), controller.pinPost);
router.post("/:postId/like", authMiddleware(), controller.toggleLike);
router.post("/:postId/comments", authMiddleware(), controller.addComment);
router.delete("/:postId/comments/:commentId", authMiddleware(), controller.deleteComment);

export = router;
