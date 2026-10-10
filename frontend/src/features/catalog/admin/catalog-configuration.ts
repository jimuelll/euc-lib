import type {FormField,FieldScope} from './AdminCatalog.types';
import type {FieldUsage} from './catalog.api';
import {toKey} from './components/CatalogBuilderConstants';
export const systemKeys=new Set(['title','author','isbn','copies','thesis_program','thesis_adviser','academic_year','accession_number','thesis_keywords','thesis_abstract']);
export const alwaysPublicKeys=new Set(['title','author','isbn','copies']);
export const scopeNames:Record<FieldScope,string>={shared:'Books and Theses',book:'Books only',thesis:'Theses only'};
export const typeHelp={text:'One short text value.',textarea:'Long text, such as an abstract or description.',number:'A numeric value.',date:'A calendar date.',select:'One choice from your configured options.',repeatable:'A list of text values, such as authors or subjects.'};
export const blankField=():FormField=>({key:'',label:'',type:'text',scope:'shared',required:false,public:true,locked:false,order:0,options:[]});
export const recordUsageLink=(key:string,usage:'used'|'missing'='used',material='all',status='all')=>`/admin/catalog?tab=records&${new URLSearchParams({fieldKey:key,fieldUsage:usage,material,status})}`;
export function fieldErrors(field:FormField,fields:FormField[],creating:boolean){
 const errors:Record<string,string>={},key=creating?toKey(field.label):field.key;
 if(!field.label.trim())errors.label='Enter a field label.';else if(field.label.trim().length>255)errors.label='Use 255 characters or fewer.';
 if(!/^[a-z][a-z0-9_]{1,63}$/.test(key))errors.key='Use a label that creates a 2–64 character key starting with a letter.';
 else if(creating&&fields.some(f=>f.key===key))errors.key='This key already exists. Edit or restore the existing field.';
 if(field.type==='select'&&(!field.options?.length||field.options.some(o=>!o.trim()||o.length>255)||new Set(field.options.map(o=>o.trim().toLowerCase())).size!==field.options.length))errors.options='Add unique, non-empty options (up to 255 characters each).';
 return errors;
}
export function reorderFields(fields:FormField[],key:string,target:string){
 const active=fields.filter(f=>!f.archived).sort((a,b)=>a.order-b.order),from=active.findIndex(f=>f.key===key),to=active.findIndex(f=>f.key===target);
 if(from<0||to<0||from===to)return fields;
 const [moved]=active.splice(from,1);active.splice(to,0,moved);
 const orders=new Map(active.map((f,i)=>[f.key,i]));return fields.map(f=>orders.has(f.key)?{...f,order:orders.get(f.key)!}:f);
}
export function impactNotes(before:FormField,after:FormField,usage:FieldUsage){
 const notes:string[]=[];
 if(before.label!==after.label)notes.push(`The label changes in ${after.scope==='shared'||!after.scope?'2 forms (Books and Theses)':`1 form (${after.scope==='book'?'Books':'Theses'})`} and, when public, Public catalog details. The key and values on ${recordCount(usage.used)} stay unchanged.`);
 if(!before.public&&after.public)notes.push(`Values from ${recordCount(usage.publicUsed)} (active, applicable) will appear in Public catalog details. Search behavior is unchanged.`);
 if(after.required&&(!before.required||before.scope!==after.scope)){const missing=(after.scope!=='thesis'?usage.missingBooks:0)+(after.scope!=='book'?usage.missingTheses:0);notes.push(`${recordCount(missing)} (active) have no value in the applicable scope. They stay unchanged, but staff must fill this field on their next save.`);}
 if(before.scope!==after.scope){const excluded=after.scope==='book'?usage.thesisUsed:after.scope==='thesis'?usage.bookUsed:0;notes.push(`Applies to ${scopeNames[after.scope||'shared']}. ${recordCount(excluded)} with values will no longer show this field in their form or public display; stored data is kept.`);}
 if(before.public&&!after.public)notes.push(`Values on ${recordCount(usage.publicUsed)} (active) will be hidden from Public catalog details. Search behavior is unchanged.`);
 const removed=(before.options||[]).filter(o=>!after.options?.includes(o));if(removed.length)notes.push(`Removed options: ${removed.map(o=>`${o} (${recordCount(usage.options[o]||0)})`).join(', ')}. Stored values remain, but affected records need a valid option on their next save.`);
 return notes;
}

export const recordCount=(count:number)=>`${count} ${count===1?'record':'records'}`;
