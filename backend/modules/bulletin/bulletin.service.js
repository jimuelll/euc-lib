const db         = require("../../db");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAN_POST_ROLES = ["staff", "admin", "super_admin"];

const destroyCloudinaryImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("[bulletin] Cloudinary destroy failed for", publicId, err.message);
  }
};

// ─── Posts ────────────────────────────────────────────────────────────────────

const getPosts = async (userId, page = 1, limit = 4, showArchived = false, search = "") => {
  const offset = (page - 1) * limit;
  const deletedFilter = showArchived ? "IS NOT NULL" : "IS NULL";
  const normalizedSearch = search.trim();
  const hasSearch = normalizedSearch.length > 0;
  const searchFilter = hasSearch
    ? "AND (bp.title LIKE ? OR bp.excerpt LIKE ? OR bp.content LIKE ? OR u.name LIKE ?)"
    : "";
  const searchParams = hasSearch
    ? Array(4).fill(`%${normalizedSearch}%`)
    : [];

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM bulletin_posts bp
     JOIN users u ON u.id = bp.author_id
     WHERE bp.deleted_at ${deletedFilter} ${searchFilter}`,
    searchParams
  );

  const queryParams = [];
  if (userId) {
    queryParams.push(userId);
  }
  queryParams.push(...searchParams, limit, offset);

  const [rows] = await db.query(
    `SELECT
       bp.id,
       bp.title,
       bp.excerpt,
       bp.content,
       bp.image_url,
       bp.is_pinned,
       bp.created_at,
       bp.deleted_at,
       u.id   AS author_id,
       u.name AS author_name,
       u.role AS author_role,
       (SELECT COUNT(*) FROM bulletin_likes    WHERE post_id = bp.id) AS likes,
       (SELECT COUNT(*) FROM bulletin_comments WHERE post_id = bp.id AND deleted_at IS NULL) AS comment_count,
       ${userId
         ? "EXISTS(SELECT 1 FROM bulletin_likes WHERE post_id = bp.id AND user_id = ?)"
         : "FALSE"}
       AS liked_by_me
     FROM bulletin_posts bp
     JOIN users u ON u.id = bp.author_id
     WHERE bp.deleted_at ${deletedFilter}
     ${searchFilter}
     ORDER BY bp.is_pinned DESC, bp.created_at DESC
     LIMIT ? OFFSET ?`,
    queryParams
  );

  return { data: rows, total, page, totalPages: Math.ceil(total / limit) };
};

const getPostById = async (postId, userId) => {
  const [[post]] = await db.query(
    `SELECT
       bp.id,
       bp.title,
       bp.excerpt,
       bp.content,
       bp.image_url,
       bp.is_pinned,
       bp.created_at,
       u.id   AS author_id,
       u.name AS author_name,
       u.role AS author_role,
       (SELECT COUNT(*) FROM bulletin_likes WHERE post_id = bp.id) AS likes,
       ${userId
         ? "EXISTS(SELECT 1 FROM bulletin_likes WHERE post_id = bp.id AND user_id = ?)"
         : "FALSE"}
       AS liked_by_me
     FROM bulletin_posts bp
     JOIN users u ON u.id = bp.author_id
     WHERE bp.id = ? AND bp.deleted_at IS NULL`,
    userId ? [userId, postId] : [postId]
  );

  if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });

  const [comments] = await db.query(
    `SELECT
       bc.id,
       bc.text,
       bc.created_at,
       u.name AS author,
       u.id   AS author_id
     FROM bulletin_comments bc
     JOIN users u ON u.id = bc.user_id
     WHERE bc.post_id = ? AND bc.deleted_at IS NULL
     ORDER BY bc.created_at ASC`,
    [postId]
  );

  return { ...post, comments };
};

const createPost = async (authorId, { title, excerpt, content, image_url, image_public_id, is_pinned }) => {
  if (!title?.trim() || !excerpt?.trim() || !content?.trim()) {
    throw Object.assign(
      new Error("title, excerpt, and content are required"),
      { status: 400 }
    );
  }

  // Enforce single pin — unpin any currently pinned post first
  if (is_pinned) {
    await db.query("UPDATE bulletin_posts SET is_pinned = 0 WHERE is_pinned = 1 AND deleted_at IS NULL");
  }

  const [result] = await db.query(
    `INSERT INTO bulletin_posts
       (title, excerpt, content, image_url, image_public_id, author_id, is_pinned)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      title.trim(),
      excerpt.trim(),
      content.trim(),
      image_url?.trim()       ?? null,
      image_public_id?.trim() ?? null,
      authorId,
      is_pinned ? 1 : 0,
    ]
  );

  return { id: result.insertId };
};

const deletePost = async (postId, requestingUser) => {
  const [[post]] = await db.query(
    "SELECT author_id, image_public_id FROM bulletin_posts WHERE id = ? AND deleted_at IS NULL",
    [postId]
  );

  if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });

  const isOwner = post.author_id === requestingUser.id;
  const isAdmin = ["staff", "admin", "super_admin"].includes(requestingUser.role);

  if (!isOwner && !isAdmin) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  await db.query(
    "UPDATE bulletin_posts SET deleted_at = NOW(), deleted_by = ?, is_pinned = 0 WHERE id = ?",
    [requestingUser.id, postId]
  );
  await db.query(
    "UPDATE bulletin_comments SET deleted_at = NOW(), deleted_by = ? WHERE post_id = ?",
    [requestingUser.id, postId]
  );

  await destroyCloudinaryImage(post.image_public_id);
};

const restorePost = async (postId, requestingUser) => {
  const [[post]] = await db.query(
    "SELECT author_id FROM bulletin_posts WHERE id = ? AND deleted_at IS NOT NULL",
    [postId]
  );

  if (!post) throw Object.assign(new Error("Archived post not found"), { status: 404 });

  const isOwner = post.author_id === requestingUser.id;
  const isAdmin = ["staff", "admin", "super_admin"].includes(requestingUser.role);

  if (!isOwner && !isAdmin) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  await db.query(
    "UPDATE bulletin_posts SET deleted_at = NULL, deleted_by = NULL WHERE id = ?",
    [postId]
  );
  await db.query(
    "UPDATE bulletin_comments SET deleted_at = NULL, deleted_by = NULL WHERE post_id = ?",
    [postId]
  );

  return { message: "Post restored successfully" };
};

// ─── Pin ──────────────────────────────────────────────────────────────────────

const pinPost = async (postId, pinned, requestingUser) => {
  const [[post]] = await db.query(
    "SELECT id FROM bulletin_posts WHERE id = ? AND deleted_at IS NULL",
    [postId]
  );

  if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });

  if (!["staff", "admin", "super_admin"].includes(requestingUser.role)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  // Enforce single pin — unpin everything first, then pin this one if requested
  if (pinned) {
    await db.query("UPDATE bulletin_posts SET is_pinned = 0 WHERE is_pinned = 1 AND deleted_at IS NULL");
  }

  await db.query(
    "UPDATE bulletin_posts SET is_pinned = ? WHERE id = ?",
    [pinned ? 1 : 0, postId]
  );

  return { pinned };
};

// ─── Likes ────────────────────────────────────────────────────────────────────

const toggleLike = async (postId, userId) => {
  const [[existing]] = await db.query(
    "SELECT id FROM bulletin_likes WHERE post_id = ? AND user_id = ?",
    [postId, userId]
  );

  if (existing) {
    await db.query(
      "DELETE FROM bulletin_likes WHERE post_id = ? AND user_id = ?",
      [postId, userId]
    );
  } else {
    await db.query(
      "INSERT INTO bulletin_likes (post_id, user_id) VALUES (?, ?)",
      [postId, userId]
    );
  }

  const [[{ total }]] = await db.query(
    "SELECT COUNT(*) AS total FROM bulletin_likes WHERE post_id = ?",
    [postId]
  );

  return { liked: !existing, total };
};

// ─── Comments ─────────────────────────────────────────────────────────────────

const addComment = async (postId, userId, text) => {
  if (!text?.trim()) {
    throw Object.assign(new Error("Comment text is required"), { status: 400 });
  }
  if (text.trim().length > 1000) {
    throw Object.assign(
      new Error("Comment must be 1000 characters or fewer"),
      { status: 400 }
    );
  }

  const [result] = await db.query(
    "INSERT INTO bulletin_comments (post_id, user_id, text) VALUES (?, ?, ?)",
    [postId, userId, text.trim()]
  );

  const [[comment]] = await db.query(
    `SELECT bc.id, bc.text, bc.created_at, u.name AS author, u.id AS author_id
     FROM bulletin_comments bc
     JOIN users u ON u.id = bc.user_id
     WHERE bc.id = ?`,
    [result.insertId]
  );

  return comment;
};

const deleteComment = async (commentId, requestingUser) => {
  const [[comment]] = await db.query(
    "SELECT user_id FROM bulletin_comments WHERE id = ? AND deleted_at IS NULL",
    [commentId]
  );

  if (!comment) {
    throw Object.assign(new Error("Comment not found"), { status: 404 });
  }

  const isOwner = comment.user_id === requestingUser.id;
  const isAdmin = ["admin", "super_admin"].includes(requestingUser.role);

  if (!isOwner && !isAdmin) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  await db.query(
    "UPDATE bulletin_comments SET deleted_at = NOW(), deleted_by = ? WHERE id = ?",
    [requestingUser.id, commentId]
  );
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  CAN_POST_ROLES,
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
