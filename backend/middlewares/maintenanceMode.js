const db = require("../db");

// A restore replaces relational data in one transaction. Requests that start
// during that window must not read a half-restored world or write lost changes.
module.exports = async (req, res, next) => {
  // The in-flight restore request has already passed this middleware before it
  // switches maintenance on. Backup endpoints must remain reachable so the
  // owner can observe or complete that operation.
  if (req.path.startsWith("/api/admin/backup")) return next();
  try {
    const [[state]] = await db.query("SELECT mode FROM system_maintenance_state WHERE id = 1");
    if (state?.mode === "restoring") return res.status(503).json({ message: "The library is being restored. Please sign in again in a moment." });
    next();
  } catch (error) {
    // Before the additive migration is applied, retain the existing behavior.
    if (error?.code === "ER_NO_SUCH_TABLE") return next();
    next(error);
  }
};
