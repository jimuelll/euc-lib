import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

const db = require("../../db") as Pool;
type QueryConnection = Pool | PoolConnection;

interface RefreshSessionRecord extends RowDataPacket {
  user_id: number;
  jti: string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

interface RestoreStateRecord extends RowDataPacket {
  invalidBeforeSeconds: number | string | null;
}

interface UserAccessRecord extends RowDataPacket {
  is_active: number | boolean;
}

const createRefreshSession = async (userId: number, jti: string, expiresAt: string): Promise<void> => {
  await db.query(
    `INSERT INTO auth_refresh_sessions (user_id, jti, expires_at)
     VALUES (?, ?, ?)`,
    [userId, jti, expiresAt],
  );
};

const getActiveRefreshSession = async (userId: number, jti: string): Promise<RefreshSessionRecord | null> => {
  const [rows] = await db.query<RefreshSessionRecord[]>(
    `SELECT *
       FROM auth_refresh_sessions
      WHERE user_id = ?
        AND jti = ?
        AND revoked_at IS NULL
        AND expires_at > UTC_TIMESTAMP()
      LIMIT 1`,
    [userId, jti],
  );
  return rows[0] ?? null;
};

const revokeRefreshSession = async (userId: number, jti: string): Promise<void> => {
  await db.query(
    `UPDATE auth_refresh_sessions
        SET revoked_at = UTC_TIMESTAMP()
      WHERE user_id = ? AND jti = ? AND revoked_at IS NULL`,
    [userId, jti],
  );
};

const rotateRefreshSession = async (userId: number, oldJti: string, nextJti: string, expiresAt: string): Promise<boolean> => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<ResultSetHeader>(
      `UPDATE auth_refresh_sessions
          SET revoked_at = UTC_TIMESTAMP()
        WHERE user_id = ? AND jti = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
      [userId, oldJti],
    );
    if (result.affectedRows !== 1) {
      await connection.rollback();
      return false;
    }
    await connection.query(
      `INSERT INTO auth_refresh_sessions (user_id, jti, expires_at)
       VALUES (?, ?, ?)`,
      [userId, nextJti, expiresAt],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const revokeAllRefreshSessionsForUser = async (userId: number): Promise<void> => {
  await db.query(
    `UPDATE auth_refresh_sessions
        SET revoked_at = UTC_TIMESTAMP()
      WHERE user_id = ? AND revoked_at IS NULL`,
    [userId],
  );
};

const purgeStaleRefreshSessions = async (): Promise<number> => {
  const [result] = await db.query<ResultSetHeader>(
    `DELETE FROM auth_refresh_sessions
      WHERE expires_at <= UTC_TIMESTAMP()
         OR revoked_at IS NOT NULL`,
  );
  return result.affectedRows;
};

const invalidateAllSessionsAfterRestore = async (conn: QueryConnection = db): Promise<void> => {
  await conn.query("UPDATE auth_restore_state SET invalid_before = UTC_TIMESTAMP() WHERE id = 1");
  await conn.query("UPDATE auth_refresh_sessions SET revoked_at = UTC_TIMESTAMP() WHERE revoked_at IS NULL");
};

const getInvalidBefore = async (): Promise<number | string | null> => {
  const [[state]] = await db.query<RestoreStateRecord[]>(
    "SELECT UNIX_TIMESTAMP(invalid_before) AS invalidBeforeSeconds FROM auth_restore_state WHERE id = 1",
  );
  return state?.invalidBeforeSeconds ?? null;
};

const isUserAccessActive = async (userId: number): Promise<boolean> => {
  const [[user]] = await db.query<UserAccessRecord[]>(
    "SELECT is_active FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [userId],
  );
  return Boolean(user?.is_active);
};

export = {
  createRefreshSession,
  getActiveRefreshSession,
  revokeRefreshSession,
  rotateRefreshSession,
  revokeAllRefreshSessionsForUser,
  purgeStaleRefreshSessions,
  invalidateAllSessionsAfterRestore,
  getInvalidBefore,
  isUserAccessActive,
};
