const sensitive=/(password|token|secret|authorization|cookie|session.?id|email|phone|contact|address|student.?employee|personal|birth|remarks|notes|reason|distributor)/i;
export const REDACTED='Redacted (sensitive)';
export function sensitiveField(field:string){return sensitive.test(field)||/^(name|patron name|user name)$/i.test(field.trim());}
export function redact(value:any,key=''):any{
 if(sensitiveField(key))return REDACTED;
 if(Array.isArray(value))return value.map(item=>redact(item));
 if(value&&typeof value==='object'){
  if(typeof value.field==='string'&&sensitiveField(value.field))return {...value,before:REDACTED,after:REDACTED,value:undefined};
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v,k)]));
 }
 if(typeof value==='string')return value.replace(/Bearer\s+[^\s]+/gi,REDACTED).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,REDACTED).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,REDACTED);
 return value;
}
export function metadataOf(value:any){if(typeof value==='string'){try{return JSON.parse(value);}catch{return {};}}return value&&typeof value==='object'?value:{};}
// Derived presentation only: never rewrite the captured audit record.
export const categorySql="CASE WHEN route LIKE '%/users/%' THEN 'users' WHEN route LIKE '%/book-types%' OR route LIKE '%/catalog-schema%' OR route LIKE '%/catalog-settings%' OR route LIKE '%/library-settings%' THEN 'settings' ELSE category END";
const impactFields='Fine|Amount|Payment|Paid|Waiv|Loan duration|Borrow days|Role|Permission|Public|Visibility|Required|Due date';
export const highImpactSql=`(action IN ('deleted','waived','permission_changed','role_changed') OR CAST(JSON_EXTRACT(metadata,'$.changes') AS CHAR) REGEXP '${impactFields}')`;
export const quickSql:Record<string,string>={
 important:highImpactSql,
 money:"(category='clearance' OR action='waived' OR CAST(JSON_EXTRACT(metadata,'$.changes') AS CHAR) REGEXP 'Fine|Amount|Payment|Paid|Waiv')",
 loans:"(category IN ('loans','circulation','reservations') OR route REGEXP '/loans|/borrow|/return|/reservations')",
 identity:`((${categorySql})='users' OR action IN ('role_changed','permission_changed'))`,
 auth:"category='auth'",
 test:"actor_name REGEXP '(^|[^a-z])(test|development)([^a-z]|$)'",
};
export function displayCategory(row:any){return /\/users\//.test(row.route||'')?'users':/\/(book-types|catalog-schema|catalog-settings|library-settings)/.test(row.route||'')?'settings':row.category;}
export function impactReason(row:any){
 if(row.action==='deleted')return 'Deletes a record';
 if(/waived/.test(row.action))return 'Changes money owed';
 const changes=row.display_changes||metadataOf(row.metadata).changes;
 const fields=(Array.isArray(changes)?changes:[]).map((c:any)=>c.field).join(' ');
 if(/Role|Permission/i.test(fields+' '+row.action))return 'Changes account permissions';
 if(/Fine|Amount|Payment|Paid|Waiv/i.test(fields))return /book-types/.test(row.route||'')?'Changes overdue fine amounts for new loans':'Changes money owed or paid';
 if(/Loan duration|Borrow days/i.test(fields))return 'Changes loan duration for new loans';
 if(/Due date/i.test(fields))return 'Changes loan due dates';
 if(/Public|Visibility|Required/i.test(fields))return 'Changes patron-visible data or cataloguing requirements';
 return '';
}
export function filters(input:any={}){
 const terms=['occurred_at IS NOT NULL'],params:any[]=[];
 if(input.quick){if(input.quick==='mine'){if(!Number.isSafeInteger(Number(input.currentActorId))||Number(input.currentActorId)<1)throw Object.assign(new Error('Your account could not be identified.'),{status:400});terms.push('actor_id = ?');params.push(Number(input.currentActorId));}else if(quickSql[input.quick])terms.push(quickSql[input.quick]);else throw Object.assign(new Error('Choose a valid quick filter.'),{status:400});}
 if(input.event){if(!/^\d+$/.test(String(input.event)))throw Object.assign(new Error('Choose a valid event ID.'),{status:400});terms.push('id = ?');params.push(Number(input.event));}
 for(const key of ['category','action'])if(input[key]&&input[key]!=='all'){terms.push(`${key==='category'?`(${categorySql})`:key} = ?`);params.push(String(input[key]));}
 if(input.actor){if(!/^\d+$/.test(String(input.actor)))throw Object.assign(new Error('Choose a valid actor.'),{status:400});terms.push('actor_id = ?');params.push(Number(input.actor));}
 if(input.record){
  const record=String(input.record).slice(0,255),patron=record.match(/^\/api\/admin\/users\/([^/]+)$/);
  if(patron){let reference;try{reference=decodeURIComponent(patron[1]);}catch{throw Object.assign(new Error('Choose a valid record route.'),{status:400});}
   terms.push("(route = ? OR JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.record_ref')) = ? OR (route = '/api/admin/users/:user' AND JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.target_id')) = (SELECT CAST(id AS CHAR) FROM users WHERE student_employee_id = ? LIMIT 1)))");params.push(record,record,reference);
  }else{terms.push('(route = ? OR JSON_UNQUOTE(JSON_EXTRACT(metadata,\'$.record_ref\')) = ?)');params.push(record,record);}
 }
 if(input.important==='true'||input.important===true)terms.push(highImpactSql);
 if(input.security==='true'||input.security===true)terms.push("(category='auth' OR CAST(metadata AS CHAR) REGEXP 'Role|Permission')");
 if(input.dateFrom&&input.dateTo&&input.dateTo<input.dateFrom)throw Object.assign(new Error('End date must be on or after start date.'),{status:400});
 for(const key of ['dateFrom','dateTo'])if(input[key]){const parsed=Date.parse(input[key]);if(!/^\d{4}-\d{2}-\d{2}$/.test(input[key])||!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==input[key])throw Object.assign(new Error('Choose valid calendar dates.'),{status:400});terms.push(`DATE(occurred_at) ${key==='dateFrom'?'>=':'<='} ?`);params.push(input[key]);}
 const query=String(input.query||'').trim().slice(0,120);if(query){const columns=['actor_name','description','route','category','action','CAST(metadata AS CHAR)','CAST(id AS CHAR)'];terms.push('('+columns.map(c=>`LOCATE(LOWER(?),LOWER(COALESCE(${c},'')))>0`).join(' OR ')+')');params.push(...columns.map(()=>query));}
 return {sql:'WHERE '+terms.join(' AND '),params};
}
export function safeRow(row:any){const reason=impactReason(row);return {...row,category:displayCategory(row),impact_reason:reason,significant:Boolean(reason),description:redact(row.description),metadata:redact(metadataOf(row.metadata)),display_changes:redact(row.display_changes),copy_display_description:redact(row.copy_display_description)};}
export function csvCell(value:any){let text=String(value??'');if(/^[=+@-]/.test(text.trimStart()))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
