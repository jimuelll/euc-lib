import {formatPeso} from '@/features/admin';
import type {BookType} from './catalog.api';
export const policyDefaults={name:'',duration:'7',unit:'day' as 'day'|'hour',initial:'0.00',recurring:'1.00',interval:'hour' as 'day'|'hour'};
export type PolicyDraft=typeof policyDefaults;
export function policyDraft(type?:BookType):PolicyDraft{return type?{name:type.name,duration:String(Number(type.loan_duration_minutes)/(type.loan_duration_unit==='hour'?60:1440)),unit:type.loan_duration_unit,initial:Number(type.initial_fine||0).toFixed(2),recurring:Number(type.fine_per_hour).toFixed(2),interval:type.fine_interval||'hour'}:{...policyDefaults};}
export function policyErrors(draft:PolicyDraft,types:BookType[],id?:number){const errors:Record<string,string>={},duration=Number(draft.duration),minutes=duration*(draft.unit==='day'?1440:60);
 if(!draft.name.trim())errors.name='Enter a type name.';else if(draft.name.trim().length>100)errors.name='Use 100 characters or fewer.';else if(types.some(type=>type.id!==id&&type.name.trim().toLocaleLowerCase()===draft.name.trim().toLocaleLowerCase()))errors.name='A book type with this name already exists.';
 if(!draft.duration.trim()||!Number.isFinite(duration)||minutes<1||minutes>525600||Math.abs(minutes-Math.round(minutes))>0.000001||(draft.unit==='day'&&!Number.isInteger(duration)))errors.duration=draft.unit==='day'?'Enter 1–365 whole days.':'Enter 1 minute–8,760 hours, in whole minutes.';
 for(const key of ['initial','recurring'] as const){const value=Number(draft[key]);if(!draft[key].trim()||!Number.isFinite(value)||value<0||value>99999999.99||Math.abs(value*100-Math.round(value*100))>0.000001)errors[key]='Enter ₱0.00–₱99,999,999.99, with up to two decimals.';}
 return errors;
}
export function finePreview(initial:number,recurring:number,interval:'hour'|'day'='hour'){const unit=interval==='day'?'days':'hours';return `Overdue by 3 ${unit} = ${formatPeso(Math.round((initial+recurring*3)*100)/100)} (${formatPeso(initial)} initial + ${formatPeso(recurring)} × 3 ${unit})`;}
export function loanDuration(type:BookType){const minutes=Number(type.loan_duration_minutes);if(type.loan_duration_unit==='day')return `${minutes/1440} ${minutes===1440?'day':'days'}`;return minutes%60===0?`${minutes/60} ${minutes===60?'hour':'hours'}`:`${Math.floor(minutes/60)} h ${minutes%60} min`;}
