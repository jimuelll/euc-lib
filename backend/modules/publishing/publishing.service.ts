import * as repository from "./publishing.repository";
import { section, digest, validateDraft, validatePublished, fail, canonical } from "./publishing.validation";
import { sections, type Section, type Payload, type DraftRow } from "./publishing.types";
import home = require("../site-content/site-content.service");
import guide = require("../user-guide/user-guide.service");
import audit = require("../analytics/transactional-audit");
import * as notificationEmail from "../notifications/notifications.email.service";
import hub = require("../../realtime/notificationHub");
import * as notificationRepository from "../notifications/notifications.email.repository";
const parse = (value:string|null|undefined)=>{if(!value)return null;const parsed=JSON.parse(value);if(Array.isArray(parsed?.items))for(const item of parsed.items)if(item.id&&typeof item.content==='string'){item.content_revision??=1;item.edited_at??=null;}return parsed;};
export const itemKey=(item:any)=>String(item.id||item._key);
const changedCount=(payload:Payload,base:Payload)=>payload.items?payload.items.filter((item:any)=>!item.id||canonical(item)!==canonical((base.items||[]).find((row:any)=>row.id===item.id))).length:canonical(payload)!==canonical(base)?1:0;
const serialize=(row:DraftRow,live:Payload)=>{
 const legacyCount=row.section==="guide"?(live.items||[]).filter((item:any)=>item.is_published&&item.has_unpublished_changes).length:0;
 return {section:row.section,payload:parse(row.draft_json)||live,published:live,revision:Number(row.revision),baseVersion:digest(live),hasDraft:Boolean(row.draft_json)||legacyCount>0,draftCount:row.draft_json?changedCount(parse(row.draft_json),parse(row.base_json)||live):legacyCount,savedAt:row.saved_at,lastPublished:row.published_at,itemMeta:parse(row.item_meta_json)||{}};
};
async function prepare(kind:Section){if(kind==="homepage")await home.get();if(kind==="guide")await guide.listForAdmin();}
async function withConnection<T>(work:(conn:Awaited<ReturnType<typeof repository.getConnection>>)=>Promise<T>):Promise<T>{const conn=await repository.getConnection();try{await conn.beginTransaction();const result=await work(conn);await conn.commit();return result;}catch(error){await conn.rollback();throw error;}finally{conn.release();}}
export async function read(value:unknown){const kind=section(value);await prepare(kind);return withConnection(async conn=>serialize(await repository.lockDraft(conn,kind),await repository.readLive(conn,kind)));}
export async function list(){const records=[];for(const kind of sections)records.push(await read(kind));return records.map(({payload,published,...meta})=>({...meta,upcoming:meta.section==="events"?(payload.items||[]).filter((item:any)=>!item.deleted&&new Date(item.ends_at||item.starts_at).getTime()>=Date.now()).length:0,hidden:meta.section==="subscriptions"?(payload.items||[]).filter((item:any)=>!item.deleted&&!item.is_active).length:0}));}
function replaceItem(payload:Payload,key:string,item:any|null):Payload{const rows=payload.items||[];return {...payload,items:[...rows.filter((row:any)=>itemKey(row)!==key),...(item?[item]:[])]};}
async function applyMutation(conn:Awaited<ReturnType<typeof repository.getConnection>>,kind:Section,action:"draft"|"publish"|"discard",input:any,actor:number){
 if(!Number.isInteger(input?.revision)||input.revision<0)fail("A draft revision is required.");
 if(action!=="discard")validateDraft(input.payload);
 const row=await repository.lockDraft(conn,kind);
 if(Number(row.revision)!==input.revision)fail("Another administrator saved this section. Your edits are retained; reload the latest version before saving.",409);
 const live=await repository.readLive(conn,kind,true);const base=parse(row.base_json)||live;const saved=parse(row.draft_json)||live;
 const key=input.itemKey===undefined?undefined:String(input.itemKey);
 if(key&&!["bulletin","events","subscriptions","guide"].includes(kind))fail("This section has no individual records.");
 const sourceItem=key?(input.payload?.items||saved.items||[]).find((item:any)=>itemKey(item)===key):null;
 if(key&&action!=="discard"&&!sourceItem)fail("The selected record is missing.");
 if(sourceItem?.id&&!(live.items||[]).some((item:any)=>item.id===sourceItem.id))fail("This record changed. Reload before saving.",409);
 if(action!=="discard"&&!row.draft_json&&input.baseVersion!==digest(live))fail("Published content changed. Your edits are retained; reload before saving.",409);
 const meta=parse(row.item_meta_json)||{};let resolvedKey=key;
 if(action==="publish"){
  if(digest(base)!==digest(live))fail("Published content changed since this draft was started. Reload and review before publishing.",409);
  const notify=input.notifyUsers;
  if(notify && (!key || !["bulletin","events"].includes(kind) || sourceItem?.id || sourceItem?.deleted)) fail("Notifications can only be sent when publishing a new post or event.");
  if(notify){
   const preview=await notificationEmail.preview({type:"announcement",title:"",body:"",audienceType:"all"});
   if(!preview.enabled || !preview.emailCount || !preview.inAppCount)fail(preview.reason||"No eligible recipients are available.",409);
   if(Number(notify.total)!==preview.inAppCount || Number(notify.email)!==preview.emailCount)fail("The recipient counts changed. Review and confirm again.",409);
  }
  const publication=key?replaceItem(live,key,sourceItem):input.payload;
  validatePublished(kind,publication,live);
  await repository.writeLive(conn,kind,publication,live,actor,key);
  const published=await repository.readLive(conn,kind);
  if(key&&!sourceItem.id&&!sourceItem.deleted)resolvedKey=itemKey((published.items||[]).find((item:any)=>!(live.items||[]).some((old:any)=>old.id===item.id)));
  if(notify){
   const item=(published.items||[]).find((entry:any)=>itemKey(entry)===resolvedKey);
   if(!item)fail("Published item could not be found.",409);
   const body=kind==="bulletin"?String(item.content||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,500):`Event starts ${new Date(item.starts_at).toLocaleString("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"})}${item.ends_at?` and ends ${new Date(item.ends_at).toLocaleString("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"})}`:""}.`;
   await notificationRepository.publishInTransaction(conn,{type:"announcement",title:String(item.title).slice(0,200),body:body||"Open the bulletin for details.",href:kind==="bulletin"?`/bulletin?post=${item.id}`:"/bulletin#upcoming-events",audienceType:"all",createdBy:actor,sendEmail:true,deliveryKey:`publication:${kind}:${item.id}`,imageUrl:kind==="bulletin"?item.image_url:null,imagePublicId:kind==="bulletin"?item.image_public_id:null,imageAlt:kind==="bulletin"?item.image_alt:null},{total:Number(notify.total),email:Number(notify.email)});
  }
  await repository.markPublished(conn,kind,actor);
  if(key){const actual=(published.items||[]).find((item:any)=>itemKey(item)===resolvedKey);const retained=replaceItem(saved,key,actual||null);if(changedCount(retained,published)>0)await repository.writeDraft(conn,kind,retained,published,actor);}
  if(key){delete meta[key];meta[resolvedKey!]={lastPublished:new Date().toISOString()};await repository.writeItemMeta(conn,kind,meta);}
  else if(publication.items){for(const item of published.items||[])meta[itemKey(item)]={lastPublished:new Date().toISOString()};await repository.writeItemMeta(conn,kind,meta);}
  await audit.enqueueTransactionalAudit(conn,{actorId:actor,route:`/api/admin/publishing/${kind}/publish`,category:"content",action:"updated",description:`Published ${kind}${key?` record ${resolvedKey}`:" content"}`,before:live,after:publication});
 }else{
  let payload=action==="draft"?(key?replaceItem(saved,key,sourceItem):input.payload):null;
  if(action==="discard"&&key){if(kind==="guide"&&Number(key))await repository.discardLegacyGuideDraft(conn,actor,Number(key));const current=await repository.readLive(conn,kind);payload=replaceItem(saved,key,(current.items||[]).find((item:any)=>itemKey(item)===key)||null);if(changedCount(payload,current)===0)payload=null;}
  if(!key&&kind==="guide"&&action==="discard")await repository.discardLegacyGuideDraft(conn,actor);
  await repository.writeDraft(conn,kind,payload,payload?base:null,actor);
  if(key){meta[key]={...meta[key],savedAt:action==="draft"?new Date().toISOString():null};await repository.writeItemMeta(conn,kind,meta);}
  await audit.enqueueTransactionalAudit(conn,{actorId:actor,route:`/api/admin/publishing/${kind}/draft`,category:"content",action:"updated",description:`${action==="draft"?"Saved":"Discarded"} ${kind}${key?` record ${key}`:" draft"}`,before:saved,after:payload||live});
 }
 return {...serialize(await repository.lockDraft(conn,kind),await repository.readLive(conn,kind)),resolvedKey};
}
export async function mutate(value:unknown,action:"draft"|"publish"|"discard",input:any,actor:number){const kind=section(value);await prepare(kind);const result=await withConnection(conn=>applyMutation(conn,kind,action,input,actor));if(action==="publish"&&input?.notifyUsers){try{hub.pushAudienceChanged({audienceType:"all",audienceRole:null});}catch{console.error("[publishing] Notification saved; realtime refresh failed.");}}return result;}
export async function publishAll(input:any,actor:number){
 if(!Array.isArray(input?.documents)||!input.documents.length)fail("Choose content to publish.");
 const entries=new Map<Section,any>();for(const entry of input.documents){const kind=section(entry.section);if(entries.has(kind))fail("Duplicate publishing section.");entries.set(kind,entry);}
 for(const kind of sections)if(entries.has(kind))await prepare(kind);
 return withConnection(async conn=>{const results=[];for(const kind of sections)if(entries.has(kind))results.push(await applyMutation(conn,kind,"publish",entries.get(kind),actor));return results;});
}
