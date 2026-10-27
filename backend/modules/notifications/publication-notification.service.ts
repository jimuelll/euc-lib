import type {Pool, PoolConnection, RowDataPacket} from "mysql2/promise";
import * as email from "./notifications.email.service";
import * as repository from "./notifications.email.repository";
import hub = require("../../realtime/notificationHub");
const db = require("../../db") as Pool;
export interface PublicationNotice {total:number; email:number; requestId:string}
export async function publishWithNotice(kind:"bulletin"|"events", actor:number, notice:PublicationNotice, title:string, body:string, image:{url?:string|null;publicId?:string|null;alt?:string|null}, create:(conn:PoolConnection)=>Promise<number>) {
 if (!notice || !/^[0-9a-f-]{36}$/i.test(notice.requestId || "") || !Number.isSafeInteger(notice.total) || !Number.isSafeInteger(notice.email)) throw Object.assign(new Error("Invalid notification confirmation."),{status:400});
 const key=`quick:${kind}:${actor}:${notice.requestId}`;
 if(key.length>64)throw Object.assign(new Error("Invalid notification request."),{status:400});
 const conn=await db.getConnection();let locked=false;
 try {
  const [[lock]]=await conn.query<RowDataPacket[]>("SELECT GET_LOCK(?, 10) AS acquired",[key]);
  if(Number(lock.acquired)!==1)throw Object.assign(new Error("This publication is still processing. Try again."),{status:409});
  locked=true;await conn.beginTransaction();
  const [[existing]]=await conn.query<RowDataPacket[]>("SELECT source_id FROM notifications WHERE delivery_key=?",[key]);
  if(existing){await conn.commit();return {id:Number(existing.source_id)};}
  const preview=await email.preview({type:"announcement",title:"",body:"",audienceType:"all"});
  if(!preview.enabled||!preview.inAppCount||!preview.emailCount)throw Object.assign(new Error(preview.reason||"No eligible recipients are available."),{status:409});
  if(preview.inAppCount!==notice.total||preview.emailCount!==notice.email)throw Object.assign(new Error("The recipient counts changed. Review and confirm again."),{status:409});
  const id=await create(conn);
  await repository.publishInTransaction(conn,{type:"announcement",title:title.slice(0,200),body:body.slice(0,500)||"Open the bulletin for details.",href:kind==="bulletin"?`/bulletin?post=${id}`:"/bulletin#upcoming-events",audienceType:"all",createdBy:actor,sendEmail:true,deliveryKey:key,sourceType:kind,sourceId:id,imageUrl:image.url,imagePublicId:image.publicId,imageAlt:image.alt},{total:notice.total,email:notice.email});
  await conn.commit();try{hub.pushAudienceChanged({audienceType:"all",audienceRole:null});}catch{console.error("[publication] Realtime refresh failed.");}return {id};
 } catch(error){await conn.rollback();throw error;} finally {if(locked)try{await conn.query("SELECT RELEASE_LOCK(?)",[key]);}catch{}conn.release();}
}
