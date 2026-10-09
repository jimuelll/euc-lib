const express = require("express");
const { authMiddleware } = require("../auth/auth.middleware");
const controller = require("./backup.controller");
const { limiters } = require("../../middlewares/rateLimiter");

const router = express.Router();
const management=require('./backup.management');
const superAdminOnly = authMiddleware(["super_admin"]);
// Status and downloads remain reachable. Peer administrators must not remove
// the safety copy or change backup controls while a restore is in progress.
router.use('/backup',superAdminOnly,async(req:any,res:any,next:any)=>{
 if(req.method==='GET'||/\/(?:preview|compatibility)$/.test(req.path))return next();
 try{const state=await require('./backup.repository').getMaintenanceStatus();if(state.mode==='restoring')return res.status(423).json({message:'A restore is in progress. Wait before changing backups.'});next();}catch(error){next(error);}
});
router.get("/backup/export", superAdminOnly, limiters.backup, controller.exportBackup);
router.get("/backup/snapshots", superAdminOnly, controller.listSavedSnapshots);
router.get("/backup/status", superAdminOnly, controller.backupStatus);
router.post("/backup/compatibility", superAdminOnly, limiters.backup, controller.checkCompatibility);
router.get("/backup/snapshots/:id/compatibility", superAdminOnly, limiters.backup, controller.checkSavedCompatibility);
router.post("/backup/snapshots", superAdminOnly, limiters.backup, controller.saveSnapshot);
router.get("/backup/snapshots/:id/download", superAdminOnly, limiters.backup, controller.downloadSnapshot);
router.post("/backup/snapshots/:id/restore", superAdminOnly, limiters.backup, controller.restoreSavedSnapshot);
router.post("/backup/restore", superAdminOnly, limiters.backup, controller.restoreUploadedSnapshot);
router.post('/backup/preview',superAdminOnly,limiters.backup,management.preview);
router.post('/backup/snapshots/:id/preview',superAdminOnly,limiters.backup,management.preview);
router.post('/backup/snapshots/:id/verify',superAdminOnly,limiters.backup,management.verify);
router.patch('/backup/snapshots/:id',superAdminOnly,limiters.backup,management.update);
router.delete('/backup/snapshots/:id',superAdminOnly,limiters.backup,management.remove);
router.put('/backup/schedule',superAdminOnly,limiters.backup,require('./backup.schedule').update);
router.post('/backup/notice',superAdminOnly,limiters.backup,management.notice);

module.exports = router;
