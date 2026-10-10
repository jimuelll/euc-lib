import type {AuditItem} from '../api/adminAnalytics.api';
import {adminInstant} from '@/utils/adminInstant';
export const actionLabel=(action:string)=>({login:'Signed in',logout:'Signed out',created:'Created',updated:'Updated',deleted:'Deleted',archived:'Archived',restored:'Restored',exported:'Exported',password_changed:'Changed password',waived:'Waived'}[action]||action.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()));
export const categoryLabel=(value:string)=>({academic_settings:'Academic settings',clearance:'Clearance & payments',auth:'Auth',recommendations:'AI Recommendations'}[value]||value.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()));
export const parsedMetadata=(value:unknown):Record<string,unknown>=>{try{const result=typeof value==='string'?JSON.parse(value):value;return result&&typeof result==='object'&&!Array.isArray(result)?result:{};}catch{return {};}};
export const valueText=(value:unknown)=>value===null||value===undefined?'Not set':value==='Changed'?'Not recorded (legacy event)':typeof value==='object'?JSON.stringify(value):String(value);
export type Change={field:string;before?:unknown;after?:unknown;value?:unknown;current_name?:boolean};
export function changesOf(item:AuditItem):Change[]{const value=item.display_changes||parsedMetadata(item.metadata).changes;return Array.isArray(value)?value.filter(c=>c&&typeof c==='object'&&typeof c.field==='string'):[];}
export const instant=adminInstant;
export const dayKey=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant(value));
export const eventTime=(value:string)=>instant(value).toLocaleTimeString('en-PH',{timeZone:'Asia/Ulaanbaatar',hour:'numeric',minute:'2-digit'});
export const exactTime=(value:string)=>instant(value).toLocaleString('en-PH',{timeZone:'Asia/Ulaanbaatar',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'})+' · UTC+08:00';
export function dayTitle(value:string){const key=dayKey(value),today=dayKey(new Date().toISOString()),yesterday=dayKey(new Date(Date.now()-86400000).toISOString()),date=instant(value).toLocaleDateString('en-PH',{timeZone:'Asia/Ulaanbaatar',weekday:'short',month:'short',day:'numeric',year:'numeric'});return `${key===today?'Today · ':key===yesterday?'Yesterday · ':''}${date}`;}
export const hasAuditDetails=(item:AuditItem)=>Boolean(item.significant||changesOf(item).length||item.related_ids?.length||item.restore_status==='reversed'||Object.keys(parsedMetadata(item.metadata)).some(key=>!['detail_status','changes'].includes(key)));
export const eventCount=(n:number)=>`${n} ${n===1?'event':'events'}`;
export const hiddenValue=(value:unknown)=>value==='Redacted (sensitive)';
export function fieldLabel(field:string){return /^(fine per increment|fine per hour)$/i.test(field)?'Recurring fine':field.replace('(PHP)','(₱)');}
export function changeValue(item:AuditItem,change:Change,value:unknown,side:'before'|'after'='after'){
 if(hiddenValue(value))return 'Values hidden';
 if(/^loan duration$/i.test(change.field)&&value!==null&&value!==undefined&&/^\d+(\.\d+)?$/.test(String(value)))return `${Number(value)} minutes`;
 if(/^borrow days$/i.test(change.field)&&value!==null&&value!==undefined)return `${value} days`;
 if(/fine|amount|payment/i.test(change.field)&&value!==null&&value!==undefined&&/^-?\d+(\.\d+)?$/.test(String(value))){
  const interval=changesOf(item).find(c=>/fine interval/i.test(c.field));
  // An unrecorded interval must not be guessed from today's policy.
  const unit=interval?.[side]||parsedMetadata(item.metadata)[`fine_interval_${side}`];
  return `₱${Number(value).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}${/initial/i.test(change.field)||!/book-types/.test(item.route||'')?'':unit?` per ${unit}`:' (interval not recorded)'}`;
 }
 return valueText(value);
}
export function eventSummary(item:AuditItem){
 if(item.target?.url&&['Patron','Book type policy','Policy','Book','Reservation'].includes(item.target.kind))return `${actionLabel(item.action)} ${item.target.kind==='Policy'?'book type policy':item.target.kind.toLowerCase()}: ${item.target.label}`;
 return item.copy_display_description||item.description;
}
export function relativeTime(value:string){const minutes=Math.floor((Date.now()-instant(value).getTime())/60000);return minutes<0?eventTime(value):minutes<1?'Just now':minutes<60?`${minutes}m ago`:minutes<1440?`${Math.floor(minutes/60)}h ago`:eventTime(value);}
