const express = require("express");
const db = require("../../db");
const { authMiddleware } = require("../auth/auth.middleware");

const router = express.Router();
const superAdminOnly = authMiddleware(["super_admin"]);

function encodeValue(value) {
  if (Buffer.isBuffer(value)) return { __backupType: "buffer", data: value.toString("base64") };
  if (value instanceof Date) return { __backupType: "date", data: value.toISOString() };
  return value;
}

function decodeValue(value) {
  if (value && typeof value === "object" && value.__backupType === "buffer") {
    return Buffer.from(value.data, "base64");
  }
  if (value && typeof value === "object" && value.__backupType === "date") return value.data;
  return value;
}

async function getTableNames() {
  const [rows] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
  );
  return rows.map((row) => row.TABLE_NAME);
}

router.get("/backup/export", superAdminOnly, async (_req, res) => {
  try {
    const tables = await getTableNames();
    const data = {};
    for (const table of tables) {
      const [rows] = await db.query(`SELECT * FROM \`${table}\``);
      data[table] = rows.map((row) => Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, encodeValue(value)])
      ));
    }

    const backup = {
      format: "euc-library-backup",
      version: 1,
      createdAt: new Date().toISOString(),
      tables: data,
    };
    const filename = `euc-library-backup-${backup.createdAt.replace(/[:.]/g, "-")}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.send(JSON.stringify(backup));
  } catch (err) {
    console.error("[backup] export:", err);
    res.status(500).json({ message: "Could not create the database backup." });
  }
});

router.post("/backup/restore", superAdminOnly, async (req, res) => {
  const backup = req.body;
  if (backup?.format !== "euc-library-backup" || backup.version !== 1 || !backup.tables || typeof backup.tables !== "object") {
    return res.status(400).json({ message: "This file is not a valid EUC Library backup." });
  }

  let connection;
  try {
    const tables = await getTableNames();
    const backupTables = Object.keys(backup.tables).sort();
    if (tables.length !== backupTables.length || tables.some((table, index) => table !== backupTables[index])) {
      return res.status(400).json({ message: "This backup does not match the current database structure." });
    }
    if (tables.some((table) => !Array.isArray(backup.tables[table]))) {
      return res.status(400).json({ message: "The backup contains invalid table data." });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const table of tables) await connection.query(`DELETE FROM \`${table}\``);
    for (const table of tables) {
      const rows = backup.tables[table];
      for (const row of rows) {
        const columns = Object.keys(row);
        if (!columns.length) continue;
        const values = columns.map((column) => decodeValue(row[column]));
        const names = columns.map((column) => `\`${column}\``).join(", ");
        const placeholders = columns.map(() => "?").join(", ");
        await connection.query(`INSERT INTO \`${table}\` (${names}) VALUES (${placeholders})`, values);
      }
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    await connection.commit();
    res.json({ message: "Database restored successfully.", restoredAt: new Date().toISOString() });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("[backup] restore:", err);
    res.status(500).json({ message: "Restore failed. The current database was left unchanged." });
  } finally {
    if (connection) {
      // This setting is scoped to a pooled connection, so always reset it before reuse.
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
      connection.release();
    }
  }
});

module.exports = router;
