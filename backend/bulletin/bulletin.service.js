const db         = require("../db");
const cloudinary = require("cloudinary").v2;

// ─── Cloudinary config ────────────────────────────────────────────────────────
// Add these to your .env:
//   CLOUDINARY_CLOUD_NAME=your_cloud_name
//   CLOUDINARY_API_KEY=your_api_key
//   CLOUDINARY_API_SECRET=your_api_secret

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAN_POST_ROLES = ["staff", "admin", "super_admin"];

/**
 * Delete an image from Cloudinary if a public_id exists.
 * Non-fatal — logs a warning but never throws, so a missing or already-deleted
 * image on Cloudinary won't block the DB delete from completing.
 */
const destroyCloudinaryImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("[bulletin] Cloudinary destroy failed for", publicId, err.message);
  }
};

// ─── Posts ────────────────────────────────────────────────────────────────────

/**
 * userId is optional — pass null for unauthenticated requests.
 * liked_by_me will always be FALSE when userId is null.
 */
const getPosts = async (userId, page = 1, limit = 4) => {
  const offset = (page - 1) * limit;

  const [[{ total }]] = await db.query(
    "SELECT COUNT(*) AS total FROM bulletin_posts"
  );

  const [rows] = await db.query(
    `SELECT
       bp.id,
       bp.title,
       bp.excerpt,
       bp.content,
       bp.image_url,
       bp.is_pinned,
       bp.created_at,
       u.name AS author_name,
       u.role AS author_role,
       (SELECT COUNT(*) FROM bulletin_likes    WHERE post_id = bp.id) AS likes,
       (SELECT COUNT(*) FROM bulletin_comments WHERE post_id = bp.id) AS comment_count,
       ${userId
         ? "EXISTS(SELECT 1 FROM bulletin_likes WHERE post_id = bp.id AND user_id = ?)"
         : "FALSE"}
       AS liked_by_me
     FROM bulletin_posts bp
     JOIN users u ON u.id = bp.author_id
     ORDER BY bp.is_pinned DESC, bp.created_at DESC
     LIMIT ? OFFSET ?`,
    userId ? [userId, limit, offset] : [limit, offset]
  );

  return { data: rows, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * userId is optional — pass null for unauthenticated requests.
 * liked_by_me will always be FALSE when userId is null.
 */
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
       u.name AS author_name,
       u.role AS author_role,
       (SELECT COUNT(*) FROM bulletin_likes WHERE post_id = bp.id) AS likes,
       ${userId
         ? "EXISTS(SELECT 1 FROM bulletin_likes WHERE post_id = bp.id AND user_id = ?)"
         : "FALSE"}
       AS liked_by_me
     FROM bulletin_posts bp
     JOIN users u ON u.id = bp.author_id
     WHERE bp.id = ?`,
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
     WHERE bc.post_id = ?
     ORDER BY bc.created_at ASC`,
    [postId]
  );

  return { ...post, comments };
};

/**
 * Create a new bulletin post.
 * Expects image_url and image_public_id from the Cloudinary upload
 * already completed on the client side.
 */
const createPost = async (authorId, { title, excerpt, content, image_url, image_public_id }) => {
  if (!title?.trim() || !excerpt?.trim() || !content?.trim()) {
    throw Object.assign(
      new Error("title, excerpt, and content are required"),
      { status: 400 }
    );
  }

  const [result] = await db.query(
    `INSERT INTO bulletin_posts
       (title, excerpt, content, image_url, image_public_id, author_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      title.trim(),
      excerpt.trim(),
      content.trim(),
      image_url?.trim()       ?? null,
      image_public_id?.trim() ?? null,
      authorId,
    ]
  );

  return { id: result.insertId };
};

/**
 * Delete a post and its Cloudinary image (if any).
 * Ownership/role check happens here — route just ensures the user is authenticated.
 * DB delete always runs first; Cloudinary cleanup is non-fatal.
 */
const deletePost = async (postId, requestingUser) => {
  const [[post]] = await db.query(
    "SELECT author_id, image_public_id FROM bulletin_posts WHERE id = ?",
    [postId]
  );

  if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });

  const isOwner = post.author_id === requestingUser.id;
  const isAdmin = ["admin", "super_admin"].includes(requestingUser.role);

  if (!isOwner && !isAdmin) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  await db.query("DELETE FROM bulletin_posts WHERE id = ?", [postId]);

  // Clean up Cloudinary after DB delete succeeds — non-fatal if it fails
  await destroyCloudinaryImage(post.image_public_id);
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
    "SELECT user_id FROM bulletin_comments WHERE id = ?",
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

  await db.query("DELETE FROM bulletin_comments WHERE id = ?", [commentId]);
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  CAN_POST_ROLES,
  getPosts,
  getPostById,
  createPost,
  deletePost,
  toggleLike,
  addComment,
  deleteComment,
};