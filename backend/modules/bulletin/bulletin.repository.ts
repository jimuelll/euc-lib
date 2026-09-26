import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  BulletinCommentRow,
  BulletinCountRow,
  BulletinFilters,
  BulletinMonthRow,
  BulletinPostOwnerRow,
  BulletinPostRow,
  CreatePostRepositoryInput,
} from "./bulletin.types";

const db = require("../../db") as Pool;

interface LikeRow extends RowDataPacket {
  id: number;
}

interface BulletinPostIdRow extends RowDataPacket {
  id: number;
}

interface LikeCountRow extends RowDataPacket {
  total: number | string;
}

interface LikePersonRow extends RowDataPacket {
  id: number;
  name: string;
  role: string;
  created_at: Date | string;
}

interface CommentOwnerRow extends RowDataPacket {
  user_id: number;
}

const getPosts = async ({ userId, page, limit, archiveScope, search, month, postType, upcomingOnly }: BulletinFilters) => {
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

  const [[{ total }]] = await db.query<BulletinCountRow[]>(
    `SELECT COUNT(*) AS total FROM bulletin_posts bp JOIN users u ON u.id = bp.author_id
     WHERE ${deletedFilter} ${searchFilter} ${monthFilter} ${typeFilter} ${upcomingFilter}`,
    filterParams,
  );
  const [monthRows] = await db.query<BulletinMonthRow[]>(
    `SELECT DISTINCT DATE_FORMAT(bp.created_at, '%Y-%m') AS value
     FROM bulletin_posts bp JOIN users u ON u.id = bp.author_id
     WHERE ${deletedFilter} ${searchFilter} ${typeFilter} ${upcomingFilter}
     ORDER BY value DESC`,
    [...searchParams, ...(normalizedType === "all" ? [] : [normalizedType])],
  );
  const queryParams = userId ? [userId, ...filterParams, limit, offset] : [...filterParams, limit, offset];
  const [rows] = await db.query<BulletinPostRow[]>(
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
    queryParams,
  );
  return {
    data: rows,
    total,
    page,
    totalPages: Math.ceil(Number(total) / limit),
    months: monthRows.map((row) => row.value),
  };
};

const findPost = async (postId: number, userId: number | null, includeArchived = false): Promise<BulletinPostRow | null> => {
  const [[post]] = await db.query<BulletinPostRow[]>(
    `SELECT bp.id, bp.title, bp.content, bp.image_url, bp.post_type, bp.event_starts_at, bp.event_ends_at,
       bp.event_location, bp.event_registration_url, bp.is_pinned, bp.created_at,
       u.id AS author_id, u.name AS author_name, u.role AS author_role,
       (SELECT COUNT(*) FROM bulletin_likes WHERE post_id = bp.id) AS likes,
       ${userId ? "EXISTS(SELECT 1 FROM bulletin_likes WHERE post_id = bp.id AND user_id = ?)" : "FALSE"} AS liked_by_me
     FROM bulletin_posts bp JOIN users u ON u.id = bp.author_id
     WHERE bp.id = ? ${includeArchived ? "" : "AND bp.deleted_at IS NULL"}`,
    userId ? [userId, postId] : [postId],
  );
  return post || null;
};

const findComments = async (postId: number): Promise<BulletinCommentRow[]> => {
  const [comments] = await db.query<BulletinCommentRow[]>(
    `SELECT bc.id, bc.text, bc.created_at, u.name AS author, u.id AS author_id
     FROM bulletin_comments bc JOIN users u ON u.id = bc.user_id
     WHERE bc.post_id = ? AND bc.deleted_at IS NULL ORDER BY bc.created_at ASC`,
    [postId],
  );
  return comments;
};

const createPost = async ({ title, excerpt, content, imageUrl, imagePublicId, authorId, pinned, postType, eventStartsAt, eventEndsAt, eventLocation, eventRegistrationUrl }: CreatePostRepositoryInput): Promise<{ id: number }> => {
  if (pinned) await db.query("UPDATE bulletin_posts SET is_pinned = 0 WHERE is_pinned = 1 AND deleted_at IS NULL");
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO bulletin_posts
       (title, excerpt, content, image_url, image_public_id, author_id, is_pinned, post_type, event_starts_at, event_ends_at, event_location, event_registration_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, excerpt, content, imageUrl, imagePublicId, authorId, pinned ? 1 : 0, postType, eventStartsAt, eventEndsAt, eventLocation, eventRegistrationUrl],
  );
  return { id: result.insertId };
};

const findPostForDelete = async (postId: number, includeArchived = false): Promise<BulletinPostOwnerRow | null> => {
  const [[post]] = await db.query<BulletinPostOwnerRow[]>(
    `SELECT author_id, image_public_id FROM bulletin_posts WHERE id = ? AND deleted_at IS ${includeArchived ? "NOT" : ""} NULL`,
    [postId],
  );
  return post || null;
};

const archivePost = async (postId: number, userId: number): Promise<void> => {
  await db.query("UPDATE bulletin_posts SET deleted_at = NOW(), deleted_by = ?, is_pinned = 0 WHERE id = ?", [userId, postId]);
  await db.query("UPDATE bulletin_comments SET deleted_at = NOW(), deleted_by = ? WHERE post_id = ?", [userId, postId]);
};

const restorePost = async (postId: number): Promise<void> => {
  await db.query("UPDATE bulletin_posts SET deleted_at = NULL, deleted_by = NULL WHERE id = ?", [postId]);
  await db.query("UPDATE bulletin_comments SET deleted_at = NULL, deleted_by = NULL WHERE post_id = ?", [postId]);
};

const pinPost = async (postId: number, pinned: boolean): Promise<void> => {
  if (pinned) await db.query("UPDATE bulletin_posts SET is_pinned = 0 WHERE is_pinned = 1 AND deleted_at IS NULL");
  await db.query("UPDATE bulletin_posts SET is_pinned = ? WHERE id = ?", [pinned ? 1 : 0, postId]);
};

const getPostForPin = async (postId: number): Promise<{ id: number } | null> => {
  const [[post]] = await db.query<BulletinPostIdRow[]>(
    "SELECT id FROM bulletin_posts WHERE id = ? AND deleted_at IS NULL",
    [postId],
  );
  return post || null;
};

const toggleLike = async (postId: number, userId: number): Promise<{ liked: boolean; total: number | string }> => {
  const [[existing]] = await db.query<LikeRow[]>("SELECT id FROM bulletin_likes WHERE post_id = ? AND user_id = ?", [postId, userId]);
  if (existing) await db.query("DELETE FROM bulletin_likes WHERE post_id = ? AND user_id = ?", [postId, userId]);
  else await db.query("INSERT INTO bulletin_likes (post_id, user_id) VALUES (?, ?)", [postId, userId]);
  const [[{ total }]] = await db.query<LikeCountRow[]>("SELECT COUNT(*) AS total FROM bulletin_likes WHERE post_id = ?", [postId]);
  return { liked: !existing, total };
};

const getLikes = async (postId: number): Promise<LikePersonRow[] | null> => {
  const [[post]] = await db.query<LikeRow[]>("SELECT id FROM bulletin_posts WHERE id = ? AND deleted_at IS NULL", [postId]);
  if (!post) return null;
  const [likes] = await db.query<LikePersonRow[]>(
    `SELECT u.id, u.name, u.role, bl.created_at FROM bulletin_likes bl JOIN users u ON u.id = bl.user_id
     WHERE bl.post_id = ? ORDER BY bl.created_at DESC, bl.id DESC`,
    [postId],
  );
  return likes;
};

const addComment = async (postId: number, userId: number, text: string): Promise<BulletinCommentRow | undefined> => {
  const [result] = await db.query<ResultSetHeader>("INSERT INTO bulletin_comments (post_id, user_id, text) VALUES (?, ?, ?)", [postId, userId, text]);
  const [[comment]] = await db.query<BulletinCommentRow[]>(
    `SELECT bc.id, bc.text, bc.created_at, u.name AS author, u.id AS author_id
     FROM bulletin_comments bc JOIN users u ON u.id = bc.user_id WHERE bc.id = ?`,
    [result.insertId],
  );
  return comment;
};

const findComment = async (commentId: number): Promise<CommentOwnerRow | null> => {
  const [[comment]] = await db.query<CommentOwnerRow[]>("SELECT user_id FROM bulletin_comments WHERE id = ? AND deleted_at IS NULL", [commentId]);
  return comment || null;
};

const deleteComment = async (commentId: number, userId: number): Promise<void> => {
  await db.query("UPDATE bulletin_comments SET deleted_at = NOW(), deleted_by = ? WHERE id = ?", [userId, commentId]);
};

export = { getPosts, findPost, findComments, createPost, findPostForDelete, archivePost, restorePost, pinPost, getPostForPin, toggleLike, getLikes, addComment, findComment, deleteComment };
