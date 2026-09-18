const db = require("../../db");

async function getPosts({ userId, page, limit, archiveScope, search, month, postType, upcomingOnly }) {
  const offset = (page - 1) * limit;
  const deletedFilter = archiveScope === "archived"
    ? "bp.deleted_at IS NOT NULL"
    : archiveScope === "all"
      ? "(bp.deleted_at IS NULL OR bp.deleted_at IS NOT NULL)"
      : "bp.deleted_at IS NULL";
  const normalizedSearch = search.trim();
  const searchFilter = normalizedSearch ? "AND (bp.title LIKE ? OR bp.content LIKE ? OR u.name LIKE ?)" : "";
  const searchParams = normalizedSearch ? Array(3).fill(`%${normalizedSearch}%`) : [];
  const normalizedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : "";
  const monthFilter = normalizedMonth ? "AND DATE_FORMAT(bp.created_at, '%Y-%m') = ?" : "";
  const normalizedType = ["announcement", "event"].includes(postType) ? postType : "all";
  const typeFilter = normalizedType === "all" ? "" : "AND bp.post_type = ?";
  const upcomingFilter = upcomingOnly ? "AND bp.post_type = 'event' AND COALESCE(bp.event_ends_at, bp.event_starts_at) >= NOW()" : "";
  const filterParams = [...searchParams, ...(normalizedMonth ? [normalizedMonth] : []), ...(normalizedType === "all" ? [] : [normalizedType])];

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM bulletin_posts bp JOIN users u ON u.id = bp.author_id
     WHERE ${deletedFilter} ${searchFilter} ${monthFilter} ${typeFilter} ${upcomingFilter}`,
    filterParams
  );
  const [monthRows] = await db.query(
    `SELECT DISTINCT DATE_FORMAT(bp.created_at, '%Y-%m') AS value
     FROM bulletin_posts bp JOIN users u ON u.id = bp.author_id
     WHERE ${deletedFilter} ${searchFilter} ${typeFilter} ${upcomingFilter}
     ORDER BY value DESC`,
    [...searchParams, ...(normalizedType === "all" ? [] : [normalizedType])]
  );
  const queryParams = userId ? [userId, ...filterParams, limit, offset] : [...filterParams, limit, offset];
  const [rows] = await db.query(
    `SELECT bp.id, bp.title, bp.content, bp.image_url, bp.post_type, bp.event_starts_at, bp.event_ends_at,
       bp.event_location, bp.event_registration_url, bp.is_pinned, bp.created_at, bp.deleted_at,
       u.id AS author_id, u.name AS author_name, u.role AS author_role,
       (SELECT COUNT(*) FROM bulletin_likes WHERE post_id = bp.id) AS likes,
       (SELECT COUNT(*) FROM bulletin_comments WHERE post_id = bp.id AND deleted_at IS NULL) AS comment_count,
       ${userId ? "EXISTS(SELECT 1 FROM bulletin_likes WHERE post_id = bp.id AND user_id = ?)" : "FALSE"} AS liked_by_me
     FROM bulletin_posts bp JOIN users u ON u.id = bp.author_id
     WHERE ${deletedFilter} ${searchFilter} ${monthFilter} ${typeFilter} ${upcomingFilter}
     ORDER BY bp.is_pinned DESC, CASE WHEN bp.post_type = 'event' THEN bp.event_starts_at END ASC, bp.created_at DESC
     LIMIT ? OFFSET ?`,
    queryParams
  );
  return { data: rows, total, page, totalPages: Math.ceil(total / limit), months: monthRows.map((row) => row.value) };
}

async function findPost(postId, userId, includeArchived = false) {
  const [[post]] = await db.query(
    `SELECT bp.id, bp.title, bp.content, bp.image_url, bp.post_type, bp.event_starts_at, bp.event_ends_at,
       bp.event_location, bp.event_registration_url, bp.is_pinned, bp.created_at,
       u.id AS author_id, u.name AS author_name, u.role AS author_role,
       (SELECT COUNT(*) FROM bulletin_likes WHERE post_id = bp.id) AS likes,
       ${userId ? "EXISTS(SELECT 1 FROM bulletin_likes WHERE post_id = bp.id AND user_id = ?)" : "FALSE"} AS liked_by_me
     FROM bulletin_posts bp JOIN users u ON u.id = bp.author_id
     WHERE bp.id = ? ${includeArchived ? "" : "AND bp.deleted_at IS NULL"}`,
    userId ? [userId, postId] : [postId]
  );
  return post || null;
}

async function findComments(postId) {
  const [comments] = await db.query(
    `SELECT bc.id, bc.text, bc.created_at, u.name AS author, u.id AS author_id
     FROM bulletin_comments bc JOIN users u ON u.id = bc.user_id
     WHERE bc.post_id = ? AND bc.deleted_at IS NULL ORDER BY bc.created_at ASC`,
    [postId]
  );
  return comments;
}

async function createPost({ title, excerpt, content, imageUrl, imagePublicId, authorId, pinned, postType, eventStartsAt, eventEndsAt, eventLocation, eventRegistrationUrl }) {
  if (pinned) await db.query("UPDATE bulletin_posts SET is_pinned = 0 WHERE is_pinned = 1 AND deleted_at IS NULL");
  const [result] = await db.query(
    `INSERT INTO bulletin_posts
       (title, excerpt, content, image_url, image_public_id, author_id, is_pinned, post_type, event_starts_at, event_ends_at, event_location, event_registration_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, excerpt, content, imageUrl, imagePublicId, authorId, pinned ? 1 : 0, postType, eventStartsAt, eventEndsAt, eventLocation, eventRegistrationUrl]
  );
  return { id: result.insertId };
}

async function findPostForDelete(postId, includeArchived = false) {
  const [[post]] = await db.query(
    `SELECT author_id, image_public_id FROM bulletin_posts WHERE id = ? AND deleted_at IS ${includeArchived ? "NOT" : ""} NULL`,
    [postId]
  );
  return post || null;
}

async function archivePost(postId, userId) {
  await db.query("UPDATE bulletin_posts SET deleted_at = NOW(), deleted_by = ?, is_pinned = 0 WHERE id = ?", [userId, postId]);
  await db.query("UPDATE bulletin_comments SET deleted_at = NOW(), deleted_by = ? WHERE post_id = ?", [userId, postId]);
}

async function restorePost(postId) {
  await db.query("UPDATE bulletin_posts SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", [postId]);
  await db.query("UPDATE bulletin_comments SET deleted_at = NULL, deleted_by = NULL WHERE post_id = ?", [postId]);
}

async function pinPost(postId, pinned) {
  if (pinned) await db.query("UPDATE bulletin_posts SET is_pinned = 0 WHERE is_pinned = 1 AND deleted_at IS NULL");
  await db.query("UPDATE bulletin_posts SET is_pinned = ? WHERE id = ?", [pinned ? 1 : 0, postId]);
}

async function getPostForPin(postId) {
  const [[post]] = await db.query("SELECT id FROM bulletin_posts WHERE id = ? AND deleted_at IS NULL", [postId]);
  return post || null;
}

async function toggleLike(postId, userId) {
  const [[existing]] = await db.query("SELECT id FROM bulletin_likes WHERE post_id = ? AND user_id = ?", [postId, userId]);
  if (existing) await db.query("DELETE FROM bulletin_likes WHERE post_id = ? AND user_id = ?", [postId, userId]);
  else await db.query("INSERT INTO bulletin_likes (post_id, user_id) VALUES (?, ?)", [postId, userId]);
  const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM bulletin_likes WHERE post_id = ?", [postId]);
  return { liked: !existing, total };
}

async function getLikes(postId) {
  const [[post]] = await db.query("SELECT id FROM bulletin_posts WHERE id = ? AND deleted_at IS NULL", [postId]);
  if (!post) return null;
  const [likes] = await db.query(
    `SELECT u.id, u.name, u.role, bl.created_at FROM bulletin_likes bl JOIN users u ON u.id = bl.user_id
     WHERE bl.post_id = ? ORDER BY bl.created_at DESC, bl.id DESC`,
    [postId]
  );
  return likes;
}

async function addComment(postId, userId, text) {
  const [result] = await db.query("INSERT INTO bulletin_comments (post_id, user_id, text) VALUES (?, ?, ?)", [postId, userId, text]);
  const [[comment]] = await db.query(
    `SELECT bc.id, bc.text, bc.created_at, u.name AS author, u.id AS author_id
     FROM bulletin_comments bc JOIN users u ON u.id = bc.user_id WHERE bc.id = ?`,
    [result.insertId]
  );
  return comment;
}

async function findComment(commentId) {
  const [[comment]] = await db.query("SELECT user_id FROM bulletin_comments WHERE id = ? AND deleted_at IS NULL", [commentId]);
  return comment || null;
}

async function deleteComment(commentId, userId) {
  await db.query("UPDATE bulletin_comments SET deleted_at = NOW(), deleted_by = ? WHERE id = ?", [userId, commentId]);
}

module.exports = { getPosts, findPost, findComments, createPost, findPostForDelete, archivePost, restorePost, pinPost, getPostForPin, toggleLike, getLikes, addComment, findComment, deleteComment };
