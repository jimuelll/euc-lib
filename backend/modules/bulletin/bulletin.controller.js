const service = require("./bulletin.service");

// ─── Posts ────────────────────────────────────────────────────────────────────

const getPosts = async (req, res) => {
  try {
    const page         = Math.max(1, parseInt(req.query.page)  || 1);
    const limit        = Math.min(20, parseInt(req.query.limit) || 4);
    const userId       = req.user?.id ?? null;
    const showArchived = req.user && ["admin", "super_admin"].includes(req.user.role)
      ? req.query.archived === "true"
      : false;
    const result = await service.getPosts(userId, page, limit, showArchived);
    res.json(result);
  } catch (err) {
    console.error("[bulletin] getPosts:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to fetch posts" });
  }
};

const getPostById = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    if (isNaN(postId) || postId < 1) {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    const userId = req.user?.id ?? null;
    const post   = await service.getPostById(postId, userId);
    res.json(post);
  } catch (err) {
    console.error("[bulletin] getPostById:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to fetch post" });
  }
};

const createPost = async (req, res) => {
  try {
    const { title, excerpt, content, image_url, image_public_id, is_pinned } = req.body;
    const result = await service.createPost(req.user.id, {
      title,
      excerpt,
      content,
      image_url,
      image_public_id,
      is_pinned: Boolean(is_pinned),
    });
    res.status(201).json({ message: "Post created successfully", ...result });
  } catch (err) {
    console.error("[bulletin] createPost:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to create post" });
  }
};

const deletePost = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    if (isNaN(postId) || postId < 1) {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    await service.deletePost(postId, req.user);
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("[bulletin] deletePost:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to delete post" });
  }
};

const restorePost = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    if (isNaN(postId) || postId < 1) {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    const result = await service.restorePost(postId, req.user);
    res.json(result);
  } catch (err) {
    console.error("[bulletin] restorePost:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to restore post" });
  }
};

const pinPost = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    if (isNaN(postId) || postId < 1) {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    const pinned = Boolean(req.body.pinned);
    const result = await service.pinPost(postId, pinned, req.user);
    res.json(result);
  } catch (err) {
    console.error("[bulletin] pinPost:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to update pin" });
  }
};

// ─── Likes ────────────────────────────────────────────────────────────────────

const toggleLike = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    if (isNaN(postId) || postId < 1) {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    const result = await service.toggleLike(postId, req.user.id);
    res.json(result);
  } catch (err) {
    console.error("[bulletin] toggleLike:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to toggle like" });
  }
};

// ─── Comments ─────────────────────────────────────────────────────────────────

const addComment = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    if (isNaN(postId) || postId < 1) {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    const comment = await service.addComment(postId, req.user.id, req.body.text);
    res.status(201).json(comment);
  } catch (err) {
    console.error("[bulletin] addComment:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to add comment" });
  }
};

const deleteComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId < 1) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }
    await service.deleteComment(commentId, req.user);
    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    console.error("[bulletin] deleteComment:", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Failed to delete comment" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getPosts,
  getPostById,
  createPost,
  deletePost,
  restorePost,
  pinPost,
  toggleLike,
  addComment,
  deleteComment,
};