import type { Request, RequestHandler } from "express";
import service = require("./bulletin.service");
import logger = require("../../logger");

const { logError } = logger;
interface UserRequest extends Request {
  user?: { id: number; role: string };
}
type AuthenticatedRequest = Request & { user: { id: number; role: string } };
type ControllerError = { status?: number; message?: string; code?: string };

const getPosts: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(200, parseInt(String(req.query.limit), 10) || 4);
    const user = (req as UserRequest).user;
    const userId = user?.id ?? null;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const canReviewArchived = user && ["admin", "super_admin"].includes(user.role);
    const archiveScope = canReviewArchived && req.query.scope === "all"
      ? "all"
      : canReviewArchived && req.query.archived === "true"
        ? "archived"
        : "active";
    const month = typeof req.query.month === "string" ? req.query.month.trim() : "";
    const postType = typeof req.query.type === "string" ? req.query.type : "all";
    const upcomingOnly = req.query.upcoming === "true";
    const result = await service.getPosts(userId, page, limit, archiveScope, search, month, postType, upcomingOnly);
    res.json(result);
  } catch (err) {
    logError("[bulletin] getPosts:", err);
    const error = err as ControllerError;
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to fetch posts" });
  }
};

const getPostById: RequestHandler = async (req, res) => {
  try {
    const postId = parseInt(String(req.params.postId), 10);
    if (isNaN(postId) || postId < 1) return res.status(400).json({ message: "Invalid post ID" });
    const userId = (req as UserRequest).user?.id ?? null;
    const post = await service.getPostById(postId, userId);
    res.json(post);
  } catch (err) {
    logError("[bulletin] getPostById:", err);
    const error = err as ControllerError;
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to fetch post" });
  }
};

const getLikes: RequestHandler = async (req, res) => {
  try {
    const postId = parseInt(String(req.params.postId), 10);
    if (isNaN(postId) || postId < 1) return res.status(400).json({ message: "Invalid post ID" });
    res.json(await service.getLikes(postId));
  } catch (err) {
    logError("[bulletin] getLikes:", err);
    const error = err as ControllerError;
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to fetch likes" });
  }
};

const createPost: RequestHandler = async (req, res) => {
  try {
    const {
      title, content, image_url, image_public_id, is_pinned, post_type,
      event_starts_at, event_ends_at, event_location, event_registration_url,
    } = req.body;
    const result = await service.createPost((req as AuthenticatedRequest).user.id, {
      title,
      content,
      image_url,
      image_public_id,
      is_pinned: Boolean(is_pinned),
      post_type,
      event_starts_at,
      event_ends_at,
      event_location,
      event_registration_url,
    });
    res.status(201).json({ message: "Post created successfully", ...result });
  } catch (err) {
    logError("[bulletin] createPost:", err);
    const error = err as ControllerError;
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to create post" });
  }
};

const deletePost: RequestHandler = async (req, res) => {
  try {
    const postId = parseInt(String(req.params.postId), 10);
    if (isNaN(postId) || postId < 1) return res.status(400).json({ message: "Invalid post ID" });
    await service.deletePost(postId, (req as AuthenticatedRequest).user);
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    logError("[bulletin] deletePost:", err);
    const error = err as ControllerError;
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to delete post" });
  }
};

const restorePost: RequestHandler = async (req, res) => {
  try {
    const postId = parseInt(String(req.params.postId), 10);
    if (isNaN(postId) || postId < 1) return res.status(400).json({ message: "Invalid post ID" });
    res.json(await service.restorePost(postId, (req as AuthenticatedRequest).user));
  } catch (err) {
    logError("[bulletin] restorePost:", err);
    const error = err as ControllerError;
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to restore post" });
  }
};

const pinPost: RequestHandler = async (req, res) => {
  try {
    const postId = parseInt(String(req.params.postId), 10);
    if (isNaN(postId) || postId < 1) return res.status(400).json({ message: "Invalid post ID" });
    res.json(await service.pinPost(postId, Boolean(req.body.pinned), (req as AuthenticatedRequest).user));
  } catch (err) {
    logError("[bulletin] pinPost:", err);
    const error = err as ControllerError;
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to update pin" });
  }
};

const toggleLike: RequestHandler = async (req, res) => {
  try {
    const postId = parseInt(String(req.params.postId), 10);
    if (isNaN(postId) || postId < 1) return res.status(400).json({ message: "Invalid post ID" });
    res.json(await service.toggleLike(postId, (req as AuthenticatedRequest).user.id));
  } catch (err) {
    logError("[bulletin] toggleLike:", err);
    const error = err as ControllerError;
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to toggle like" });
  }
};

const addComment: RequestHandler = async (req, res) => {
  try {
    const postId = parseInt(String(req.params.postId), 10);
    if (isNaN(postId) || postId < 1) return res.status(400).json({ message: "Invalid post ID" });
    const comment = await service.addComment(postId, (req as AuthenticatedRequest).user.id, req.body.text);
    res.status(201).json(comment);
  } catch (err) {
    logError("[bulletin] addComment:", err);
    const error = err as ControllerError;
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to add comment" });
  }
};

const deleteComment: RequestHandler = async (req, res) => {
  try {
    const commentId = parseInt(String(req.params.commentId), 10);
    if (isNaN(commentId) || commentId < 1) return res.status(400).json({ message: "Invalid comment ID" });
    await service.deleteComment(commentId, (req as AuthenticatedRequest).user);
    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    logError("[bulletin] deleteComment:", err);
    const error = err as ControllerError;
    res.status(error.status ?? 500).json({ message: error.message ?? "Failed to delete comment" });
  }
};

export = {
  getPosts,
  getLikes,
  getPostById,
  createPost,
  deletePost,
  restorePost,
  pinPost,
  toggleLike,
  addComment,
  deleteComment,
};
