import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  GuideContent,
  GuideDraftInput,
  GuideModuleRow,
  GuideUpdateInput,
  PublishedGuideRow,
} from "./user-guide.types";

const db = require("../../db") as Pool;

const ensureDefaults = async (defaults: GuideContent[]): Promise<void> => {
  const [countRows] = await db.query<Array<RowDataPacket & { total: number | string }>>(
    "SELECT COUNT(*) AS total FROM user_guide_modules WHERE deleted_at IS NULL",
  );
  const [row] = countRows;
  if (Number(row.total) > 0) return;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (let index = 0; index < defaults.length; index += 1) {
      const content = defaults[index];
      const serialized = JSON.stringify(content);
      await conn.query(
        `INSERT IGNORE INTO user_guide_modules
          (slug, sort_order, draft_content, published_content, is_published, published_at)
         VALUES (?, ?, ?, ?, 1, NOW())`,
        [content.slug, index + 1, serialized, serialized],
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const listPublished = async (): Promise<PublishedGuideRow[]> => {
  const [rows] = await db.query<PublishedGuideRow[]>(
    `SELECT id, sort_order, published_content
       FROM user_guide_modules
      WHERE is_published = 1 AND published_content IS NOT NULL AND deleted_at IS NULL
      ORDER BY sort_order ASC, id ASC`,
  );
  return rows;
};

const listForAdmin = async (): Promise<GuideModuleRow[]> => {
  const [rows] = await db.query<GuideModuleRow[]>(
    "SELECT * FROM user_guide_modules WHERE deleted_at IS NULL ORDER BY sort_order ASC, id ASC",
  );
  return rows;
};

const getById = async (id: number): Promise<GuideModuleRow | null> => {
  const [rows] = await db.query<GuideModuleRow[]>(
    "SELECT * FROM user_guide_modules WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
  return rows[0] ?? null;
};

const getNextOrder = async (): Promise<number> => {
  const [rows] = await db.query<Array<RowDataPacket & { next_order: number | string }>>(
    "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM user_guide_modules WHERE deleted_at IS NULL",
  );
  return Number(rows[0].next_order);
};

const createDraft = async ({ slug, sortOrder, content, userId }: GuideDraftInput): Promise<number> => {
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO user_guide_modules (slug, sort_order, draft_content, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?)`,
    [slug, sortOrder, JSON.stringify(content), userId || null, userId || null],
  );
  return result.insertId;
};

const updateDraft = async (id: number, { slug, content, userId }: GuideUpdateInput): Promise<void> => {
  await db.query(
    "UPDATE user_guide_modules SET slug = ?, draft_content = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL",
    [slug, JSON.stringify(content), userId || null, id],
  );
};

const publish = async (id: number, userId: number): Promise<void> => {
  await db.query(
    `UPDATE user_guide_modules
        SET published_content = draft_content, is_published = 1, published_at = NOW(), updated_by = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [userId || null, id],
  );
};

const unpublish = async (id: number, userId: number): Promise<void> => {
  await db.query(
    "UPDATE user_guide_modules SET is_published = 0, updated_by = ? WHERE id = ? AND deleted_at IS NULL",
    [userId || null, id],
  );
};

const archive = async (id: number, userId: number): Promise<void> => {
  await db.query(
    "UPDATE user_guide_modules SET slug = CONCAT(slug, '-archived-', id), deleted_at = NOW(), updated_by = ? WHERE id = ?",
    [userId || null, id],
  );
};

const listActiveIds = async (): Promise<number[]> => {
  const [rows] = await db.query<Array<RowDataPacket & { id: number | string }>>(
    "SELECT id FROM user_guide_modules WHERE deleted_at IS NULL",
  );
  return rows.map((row) => Number(row.id));
};

const reorder = async (ids: number[], userId: number): Promise<void> => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (let index = 0; index < ids.length; index += 1) {
      await conn.query(
        "UPDATE user_guide_modules SET sort_order = ?, updated_by = ? WHERE id = ?",
        [index + 1, userId || null, ids[index]],
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

export = {
  ensureDefaults,
  listPublished,
  listForAdmin,
  getById,
  getNextOrder,
  createDraft,
  updateDraft,
  publish,
  unpublish,
  archive,
  listActiveIds,
  reorder,
};
