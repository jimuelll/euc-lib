import express = require('express');
import * as service from './profile.service';
const {authMiddleware}=require('./auth.middleware');
const {limiters}=require('../../middlewares/rateLimiter');
export const router=express.Router();
const handle=(save:boolean):express.RequestHandler=>async(req,res)=>{
 res.set('Cache-Control','no-store');
 try {
  const id=(req as express.Request & {user:{id:number}}).user.id;
  res.json(await (save?service.update(id,req.body):service.read(id)));
 }catch(error){const e=error as {status?:number;message?:string};res.status(e.status||500).json({message:e.status?e.message:'Unable to update account details. Try again.'});}
};
router.get('/profile',authMiddleware(['super_admin']),handle(false));
router.put('/profile',authMiddleware(['super_admin']),limiters.passwordChange,handle(true));
