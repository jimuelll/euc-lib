const router = require("express").Router();
const db = require("../../db");
const { authMiddleware } = require("../auth/auth.middleware");

const toSqlDateTime = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
};

router.get("/", async (_req, res) => {
  try {
    const [rows] = await db.query("SELECT id,title,starts_at,ends_at FROM library_events WHERE starts_at >= NOW() ORDER BY starts_at ASC LIMIT 8");
    res.json(rows);
  } catch (error) { res.status(500).json({ message: "Could not load events" }); }
});
router.post("/", authMiddleware(["admin", "super_admin"]), async (req, res) => {
  try {
    const { title, starts_at, ends_at } = req.body;
    const startsAt = toSqlDateTime(starts_at);
    const endsAt = ends_at === undefined || ends_at === null || ends_at === "" ? null : toSqlDateTime(ends_at);
    if (!title?.trim() || !startsAt) return res.status(400).json({ message: "A title and valid start time are required" });
    if (ends_at && !endsAt) return res.status(400).json({ message: "End time must be a valid date and time" });
    if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) return res.status(400).json({ message: "End time cannot be before the start time" });
    const [result] = await db.query("INSERT INTO library_events (title,starts_at,ends_at,created_by) VALUES (?,?,?,?)", [title.trim(), startsAt, endsAt, req.user.id]);
    res.status(201).json({ id: result.insertId });
  } catch (error) { res.status(500).json({ message: "Could not create event" }); }
});
router.delete("/:id", authMiddleware(["admin", "super_admin"]), async (req, res) => {
  try { await db.query("DELETE FROM library_events WHERE id=?", [req.params.id]); res.status(204).end(); }
  catch (error) { res.status(500).json({ message: "Could not delete event" }); }
});
module.exports = router;
