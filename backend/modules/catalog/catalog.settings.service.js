const db = require("../../db");
const { enqueueTransactionalAudit } = require("../analytics/transactional-audit");

const getCatalogSettings = async (conn = db) => {
  const [[row]] = await conn.query("SELECT show_unheld_in_opac, updated_at FROM catalog_settings WHERE id = 1");
  return { show_unheld_in_opac: row ? Boolean(row.show_unheld_in_opac) : true, updated_at: row?.updated_at ?? null };
};

const updateCatalogSettings = async (showUnheldInOpac, updatedBy) => {
  if (typeof showUnheldInOpac !== "boolean") {
    throw Object.assign(new Error("show_unheld_in_opac must be true or false"), { status: 400 });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("INSERT INTO catalog_settings (id, show_unheld_in_opac) VALUES (1, 1) ON DUPLICATE KEY UPDATE id = id");
    const [[before]] = await conn.query("SELECT show_unheld_in_opac FROM catalog_settings WHERE id = 1 FOR UPDATE");
    await conn.query(
      "UPDATE catalog_settings SET show_unheld_in_opac = ?, updated_by = ? WHERE id = 1",
      [showUnheldInOpac ? 1 : 0, updatedBy ?? null],
    );
    const [[after]] = await conn.query("SELECT show_unheld_in_opac, updated_at FROM catalog_settings WHERE id = 1");
    await enqueueTransactionalAudit(conn, {
      actorId: updatedBy,
      category: "catalog",
      route: "/api/admin/catalog-settings",
      description: "Updated catalog visibility settings",
      before,
      after,
    });
    await conn.commit();
    return { show_unheld_in_opac: Boolean(after?.show_unheld_in_opac), updated_at: after?.updated_at ?? null };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
};

module.exports = { getCatalogSettings, updateCatalogSettings };
