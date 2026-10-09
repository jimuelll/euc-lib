import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
export const auditContext=new AsyncLocalStorage<Record<string,string>>();
export function auditRequestContext(req:any,res:any,next:()=>void){const requestId=randomUUID();res.setHeader('X-Request-ID',requestId);auditContext.run({request_id:requestId,user_agent:String(req.get('user-agent')||'Not recorded').slice(0,512)},next);}
