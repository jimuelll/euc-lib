const router = require("express").Router();
const db = require("../../db");
const { authMiddleware } = require("../auth/auth.middleware");
router.get("/", async (_req,res) => { try { const [rows]=await db.query("SELECT id,title,starts_at,ends_at FROM library_events WHERE starts_at >= NOW() ORDER BY starts_at ASC LIMIT 8"); res.json(rows); } catch(e){res.status(500).json({message:e.message});} });
router.post("/", authMiddleware(["admin","super_admin"]), async (req,res) => { const {title,starts_at,ends_at}=req.body; if(!title?.trim()||!starts_at) return res.status(400).json({message:"Title and start time are required"}); const [r]=await db.query("INSERT INTO library_events (title,starts_at,ends_at,created_by) VALUES (?,?,?,?)",[title.trim(),String(starts_at).replace("T"," "),ends_at?String(ends_at).replace("T"," "):null,req.user.id]); res.status(201).json({id:r.insertId}); });
router.delete("/:id", authMiddleware(["admin","super_admin"]), async (req,res) => { await db.query("DELETE FROM library_events WHERE id=?",[req.params.id]); res.status(204).end(); });
module.exports=router;
