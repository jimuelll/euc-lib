import type { Request, Response } from 'express';
import * as accounts from './account-email.service';
import * as deliveries from '../email/email.service';
import cookies = require('./auth.cookies');
type AuthRequest = Request & {user:{id:number;role:string}};
const handle = (fn:(req:Request,res:Response)=>Promise<unknown>) => async(req:Request,res:Response) => {
  res.set('Cache-Control','no-store');
  try { res.json(await fn(req,res)); }
  catch(error) { const e=error as {status?:number;message?:string}; const status=e.status || 500;res.status(status).json({message:status>=500?'Email workflow is unavailable. Try again later or contact the library.':e.message}); }
};

export const setup=handle(async(req,res)=>{const result=await accounts.complete('setup',req.body.id,req.body.token,req.body.password);cookies.clearRefreshAuthCookies(res);return result;});
export const verify=handle(req=>accounts.complete('verify_email',req.body.id,req.body.token));
export const request=handle(req=>accounts.requestRecovery(req.body.email,req.ip || 'unknown'));
export const code=handle(req=>accounts.verifyRecovery(req.body.email,req.body.code));
export const reset=handle(async(req,res)=>{const result=await accounts.complete('reset',req.body.id,req.body.token,req.body.password);cookies.clearRefreshAuthCookies(res);return result;});
export const status=handle(req=>accounts.accountStatus((req as AuthRequest).user.id));
export const verification=handle(req=>accounts.requestVerification((req as AuthRequest).user.id));
export const change=handle(req=>accounts.changeEmail((req as AuthRequest).user.id,req.body.email));
export const adminAction=handle(req=>{
 const action=req.body.action;
 if(!['invite','recovery','verify'].includes(action))throw Object.assign(new Error('Invalid account email action'),{status:400});
 return accounts.adminAction(String(req.params.identifier),(req as AuthRequest).user.id,(req as AuthRequest).user.role,action);
});
export const listDeliveries=handle(req=>deliveries.adminStatus(req.query));
export const retry=handle(async req=>{await deliveries.retryDelivery(String(req.params.id));return {message:'Retry queued if eligible.'};});

export const deliveryDetail=handle(req=>deliveries.adminDelivery(String(req.params.id)));
