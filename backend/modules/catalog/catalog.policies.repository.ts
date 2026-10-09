const db=require('../../db');
const {enqueueAuditEvent}=require('../analytics/analytics.audit.service');
export async function savePolicy(id:number|null,data:Record<string,any>,actorId:number|null=null){
 const conn=await db.getConnection();
 try{await conn.beginTransaction();
 const [[before]]=id ? await conn.query('SELECT * FROM book_types WHERE id = ? FOR UPDATE',[id]) : [[]];
 if(id&&!before)throw Object.assign(new Error('Book type policy not found'),{status:404});
 const termsChanged=before&&(Number(before.loan_duration_minutes??Number(before.default_borrow_days)*1440)!==Number(data.minutes)||Number(before.fine_per_hour)!==Number(data.fine)||Number(before.initial_fine||0)!==Number(data.initial)||(before.fine_interval||"hour")!==data.fineInterval);
 const reason=String(data.reason||'').trim();
 const [[duplicate]]=await conn.query('SELECT id FROM book_types WHERE name = ? AND id <> ? LIMIT 1',[data.name,id||0]);
 if(duplicate)throw Object.assign(new Error('A book type with this name already exists.'),{status:409,field:'name'});
 const active=data.isActive===undefined ? Number(before?.is_active??1) : Number(data.isActive);
 if(before && Number(before.is_active)===1 && active===0){
  const [assigned]=await conn.query('SELECT id FROM books WHERE book_type_id = ? FOR UPDATE',[id]);
  if(assigned.length)throw Object.assign(new Error('Reassign all active and archived books before archiving this policy.'),{status:409});
 }
 if(termsChanged&&(reason.length<3||reason.length>500))throw Object.assign(new Error('Enter a reason for changing loan duration or fines (3–500 characters).'),{status:400,field:'reason'});
 const values=[data.name,data.days,data.minutes,data.durationUnit,data.fine.toFixed(2),data.fineInterval,data.initial.toFixed(2),active];
 if(id)await conn.query('UPDATE book_types SET name=?,default_borrow_days=?,loan_duration_minutes=?,loan_duration_unit=?,fine_per_hour=?,fine_interval=?,initial_fine=?,is_active=? WHERE id=?',[...values,id]);
 else{const [result]=await conn.query('INSERT INTO book_types (name,default_borrow_days,loan_duration_minutes,loan_duration_unit,fine_per_hour,fine_interval,initial_fine,is_active) VALUES (?,?,?,?,?,?,?,?)',values);id=result.insertId;}
 const [[after]]=await conn.query('SELECT * FROM book_types WHERE id=?',[id]);
 const duration=(row:any)=>{if(!row)return 'Not set';const hours=Number(row.loan_duration_minutes??Number(row.default_borrow_days)*1440)/60,days=hours/24;return row.loan_duration_unit==='day'?`${days} ${days===1?'day':'days'}`:`${hours} ${hours===1?'hour':'hours'}`;};
 const durationChange=duration(before)!==duration(after)?[{field:'Loan duration',before:duration(before),after:duration(after)}]:[];
 const fields=[['name','Policy name'],['initial_fine','Initial fine (₱)'],['fine_per_hour','Recurring fine (₱)'],['fine_interval','Fine interval'],['is_active','Active']];
 await enqueueAuditEvent(conn,{actorId,category:'settings',action:before?'updated':'created',description:`${before?'Updated':'Created'} book type policy: ${data.name} · applies to new loans only`,route:`/api/admin/book-types/${id}`,metadata:{detail_status:'captured',...(termsChanged?{reason,reason_recorded:true}:{}),fine_interval_before:before?.fine_interval??null,fine_interval_after:after.fine_interval,changes:[...durationChange,...fields.filter(([key])=>String(before?.[key]??'')!==String(after[key])).map(([key,field])=>({field,before:before?.[key]??null,after:after[key]}))]}});
 await conn.commit();return after;
 }catch(error:any){await conn.rollback();if(error.code==='ER_DUP_ENTRY')throw Object.assign(new Error('A book type with this name already exists.'),{status:409,field:'name'});throw error;}finally{conn.release();}
}
