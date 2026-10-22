import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import db = require("../../db");
import sessions = require("../auth/authSession.service");
import audit = require("../analytics/analytics.audit.service");
import hub = require("../../realtime/notificationHub");

const RESTORE_LOCK = "euc-library-restore";

export function recoveryFailureCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_]+$/.test(code) ? code : "INTERNAL_ERROR";
}

/** The same lock as a live restore protects recovery across backend instances. */
export async function recoverInterruptedRestore(): Promise<boolean> {
  const conn: PoolConnection = await db.getConnection();
  let locked = false;
  let discardConnection = false;
  let inTransaction = false;
  try {
    let acquired: number | null;
    try {
      const [[lock]] = await conn.query<Array<RowDataPacket & { acquired: number | null }>>(
        "SELECT GET_LOCK(?, 0) AS acquired", [RESTORE_LOCK],
      );
      acquired = lock?.acquired ?? null;
    } catch (error) {
      // A lost response cannot establish whether this connection owns the lock.
      discardConnection = true;
      throw error;
    }
    if (acquired === 0) return false;
    if (acquired !== 1) throw new Error("Could not verify restore lock ownership");
    locked = true;
    await conn.beginTransaction();
    inTransaction = true;
    const [[state]] = await conn.query<Array<RowDataPacket & { mode: string; started_at: Date | string | null }>>(
      "SELECT mode, started_at FROM system_maintenance_state WHERE id = 1 FOR UPDATE",
    );
    if (!state) throw new Error("Maintenance state is missing; apply the database baseline");
    if (state.mode !== "restoring") {
      await conn.commit();
      inTransaction = false;
      return false;
    }
    await sessions.invalidateAllSessionsAfterRestore(conn);
    await audit.enqueueAuditEvent(conn, {
      actorId: null,
      category: "system",
      action: "updated",
      route: "/system/restore-recovery",
      description: "Recovered interrupted restore maintenance. Review restore history and safety snapshots; the restore outcome has not been inferred.",
      metadata: { maintenance_started_at: state.started_at, restore_outcome: "unknown" },
    });
    await conn.query("UPDATE system_maintenance_state SET mode = 'normal', started_at = NULL, started_by = NULL WHERE id = 1");
    await conn.commit();
    inTransaction = false;
    hub.closeAllConnections({ type: "system.restored", message: "Your session ended. Please sign in again." });
    console.warn("[restore-recovery] Recovered interrupted maintenance; review restore history and safety snapshots.");
    return true;
  } catch (error) {
    if (inTransaction) {
      try { await conn.rollback(); }
      catch { discardConnection = true; }
    }
    throw error;
  } finally {
    if (locked) {
      try { await conn.query("SELECT RELEASE_LOCK(?)", [RESTORE_LOCK]); }
      catch (error) {
        discardConnection = true;
        console.error(`[restore-recovery] Lock cleanup failed (${recoveryFailureCode(error)}); discarding connection.`);
      }
    }
    if (discardConnection) conn.destroy();
    else conn.release();
  }
}

export function startRestoreRecoveryJob(): NodeJS.Timeout {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await recoverInterruptedRestore(); }
    catch (error) { console.error(`[restore-recovery] Recovery not confirmed (${recoveryFailureCode(error)}); retrying next minute.`); }
    finally { busy = false; }
  }, 60_000);
  timer.unref();
  return timer;
}
