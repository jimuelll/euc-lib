import express = require("express");
import controller = require("./bulletin.controller");
import auth = require("../auth/auth.middleware");
const { limiters } = require("../../middlewares/rateLimiter");

const router = express.Router();
const { authMiddleware, optionalAuthMiddleware } = auth;

const CAN_POST = ["staff", "admin", "super_admin"];
const ADMIN_ONLY = ["admin", "super_admin"];
const social=require('./bulletin.social.repository');
const saves=require('./bulletin.saves.repository');
const discussion=require('./bulletin.discussion.repository');
const moderation=require('./bulletin.moderation.repository');
const id=(value:unknown)=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw Object.assign(new Error('Invalid ID'),{status:400});return n;};
const page=(value:unknown)=>{const n=Number(value||1);if(!Number.isSafeInteger(n)||n<1||n>100000)throw Object.assign(new Error('Invalid page'),{status:400});return n;};
const handle=(work:(req:any)=>Promise<any>,audited=false):import('express').RequestHandler=>async(req,res)=>{try{const result=await work(req);if(audited)res.locals.auditEnqueued=true;res.json(result);}catch(error:any){res.status(error.status||500).json({message:error.status?error.message:'Could not complete the bulletin action. Try again.'});}};
router.get('/moderation/stats',authMiddleware(ADMIN_ONLY),handle(req=>moderation.stats(req.user)));
router.get('/moderation',authMiddleware(ADMIN_ONLY),handle(req=>moderation.list(req.user,String(req.query.status||'open'),page(req.query.page))));
router.get('/moderation/:caseId',authMiddleware(ADMIN_ONLY),handle(req=>moderation.detail(req.user,id(req.params.caseId))));
router.patch('/moderation/:caseId',authMiddleware(ADMIN_ONLY),limiters.bulletinComment,handle(req=>moderation.review(req.user,id(req.params.caseId),req.body),true));
router.get('/:postId/my-comments',authMiddleware(),handle(req=>moderation.myComments(id(req.params.postId),req.user.id,page(req.query.page))));
router.post('/:postId/comments/:commentId/reconsider',authMiddleware(),limiters.bulletinComment,handle(req=>moderation.reconsider(id(req.params.postId),id(req.params.commentId),req.user,req.body)));
router.get('/:postId/comments/:commentId/likes',authMiddleware(),handle(req=>discussion.likers(id(req.params.postId),id(req.params.commentId),page(req.query.page))));
router.get('/saved',authMiddleware(),handle(req=>saves.savedPosts(req.user.id,page(req.query.page))));
router.put('/:postId/helpful',authMiddleware(),limiters.bulletinLike,handle(req=>social.setHelpful(id(req.params.postId),req.user.id,true)));
router.delete('/:postId/helpful',authMiddleware(),limiters.bulletinLike,handle(req=>social.setHelpful(id(req.params.postId),req.user.id,false)));
router.put('/:postId/interest',authMiddleware(),limiters.bulletinLike,handle(req=>social.setInterest(id(req.params.postId),req.user.id,true)));
router.delete('/:postId/interest',authMiddleware(),limiters.bulletinLike,handle(req=>social.setInterest(id(req.params.postId),req.user.id,false)));
router.put('/:postId/save',authMiddleware(),limiters.bulletinLike,handle(req=>saves.setSaved(id(req.params.postId),req.user.id,true)));
router.delete('/:postId/save',authMiddleware(),limiters.bulletinLike,handle(req=>saves.setSaved(id(req.params.postId),req.user.id,false)));
router.post('/:postId/comments/:commentId/report',authMiddleware(),limiters.bulletinComment,handle(req=>social.reportComment(id(req.params.postId),id(req.params.commentId),req.user,req.body),true));
router.post('/:postId/comment-snapshots',optionalAuthMiddleware(),limiters.bulletinLike,handle(req=>discussion.publicSnapshots(id(req.params.postId),req.user?.id||null,req.body.ids)));
router.get('/:postId/discussion-updates',optionalAuthMiddleware(),handle(req=>discussion.updates(id(req.params.postId),req.query.afterId&&String(req.query.afterId)!=='0'?id(req.query.afterId):0,req.user?.id||null)));
router.get('/:postId/comments/:commentId/context',optionalAuthMiddleware(),handle(req=>discussion.context(id(req.params.postId),id(req.params.commentId),req.user?.id||null)));
router.put('/:postId/comments/:commentId/helpful',authMiddleware(),limiters.bulletinLike,handle(req=>discussion.helpful(id(req.params.postId),id(req.params.commentId),req.user.id,true)));
router.delete('/:postId/comments/:commentId/helpful',authMiddleware(),limiters.bulletinLike,handle(req=>discussion.helpful(id(req.params.postId),id(req.params.commentId),req.user.id,false)));
router.patch('/:postId/comments/:commentId/moderation',authMiddleware(CAN_POST),limiters.bulletinComment,handle(req=>discussion.moderate(id(req.params.postId),id(req.params.commentId),req.user,req.body),true));
router.patch('/:postId/discussion',authMiddleware(CAN_POST),limiters.bulletinPost,handle(req=>discussion.lockComments(id(req.params.postId),req.user,req.body.locked),true));
router.patch('/:postId',authMiddleware(CAN_POST),limiters.bulletinPost,handle(req=>social.editPost(id(req.params.postId),req.user,req.body),true));
router.get('/:postId/comments',optionalAuthMiddleware(),handle(req=>social.comments(id(req.params.postId),req.query.parentId?id(req.query.parentId):null,page(req.query.page),req.user?.id||null,String(req.query.sort||(req.query.parentId?'oldest':'helpful')))));
router.get('/:postId/reactions',authMiddleware(),handle(req=>social.readers(id(req.params.postId),String(req.query.reaction||'all'),page(req.query.page))));
router.put('/:postId/reaction',authMiddleware(),limiters.bulletinLike,handle(req=>social.setReaction(id(req.params.postId),req.user.id,req.body.reaction)));
router.delete('/:postId/reaction',authMiddleware(),limiters.bulletinLike,handle(req=>social.setReaction(id(req.params.postId),req.user.id,null)));


router.get("/", optionalAuthMiddleware(), controller.getPosts);
router.get("/:postId/likes", authMiddleware(), controller.getLikes);
router.get("/:postId", optionalAuthMiddleware(), controller.getPostById);

router.post("/", authMiddleware(CAN_POST), limiters.bulletinPost, controller.createPost);
router.delete("/:postId", authMiddleware(), controller.deletePost);
router.patch("/:postId/restore", authMiddleware(CAN_POST), controller.restorePost);
router.patch("/:postId/pin", authMiddleware(ADMIN_ONLY), controller.pinPost);
router.post("/:postId/like", authMiddleware(), limiters.bulletinLike, controller.toggleLike);
router.post("/:postId/comments", authMiddleware(), limiters.bulletinComment, controller.addComment);
router.delete("/:postId/comments/:commentId", authMiddleware(), controller.deleteComment);

export = router;
