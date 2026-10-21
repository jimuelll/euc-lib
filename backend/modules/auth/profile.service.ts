import * as repository from './profile.repository';
import audit = require('../analytics/transactional-audit');
const fail=(message:string,status=400)=>Object.assign(new Error(message),{status});
export function validateProfile(body:unknown) {
 if(!body || typeof body!=='object' || Array.isArray(body))throw fail('Invalid account details');
 const input=body as Record<string,unknown>;
 const limits={name:255,username:50,address:100,contact:11};
 if(Object.keys(input).some(key=>!Object.hasOwn(limits,key)))throw fail('Only name, username, address, and contact can be changed here');
 const result={} as Record<keyof typeof limits,string>;
 for(const key of Object.keys(limits) as (keyof typeof limits)[]) {
  if(typeof input[key]!=='string')throw fail(`Invalid ${key}`);
  result[key]=(input[key] as string).trim();
  if(result[key].length>limits[key])throw fail(`${key} is too long`);
 }
 if(!result.name || !result.username)throw fail('Name and username are required');
 if(result.contact && !/^\d{11}$/.test(result.contact))throw fail('Contact number must contain 11 digits');
 return result;
}
export async function read(id:number) {
 const profile=await repository.find(id);
 if(!profile || profile.role!=='super_admin')throw fail('Only super admins can edit their own account details',403);
 return {name:profile.name,username:profile.username||profile.student_employee_id,address:profile.address,contact:profile.contact};
}
export async function update(id:number,body:unknown) {
 const after=validateProfile(body);
 const conn=await repository.getConnection();
 try {
  await conn.beginTransaction();
  const [rows]=await conn.query<repository.Profile[]>('SELECT name, username, student_employee_id, address, contact, role, must_change_password, setup_pending, is_active FROM users WHERE id=? AND deleted_at IS NULL FOR UPDATE',[id]);
  const user=rows[0];
  if(!user || user.role!=='super_admin' || !user.is_active)throw fail('Only super admins can edit their own account details',403);
  if(user.must_change_password || user.setup_pending)throw fail('Complete password setup before editing account details',403);
  const before={name:user.name,username:user.username||user.student_employee_id,address:user.address,contact:user.contact};
  await conn.query('UPDATE users SET name=?, username=?, student_employee_id=?, address=?, contact=? WHERE id=?',[after.name,after.username,after.username,after.address,after.contact,id]);
  await audit.enqueueTransactionalAudit(conn,{actorId:id,route:'/api/auth/profile',category:'users',description:'Updated own account details',before,after});
  await conn.commit();
  return after;
 }catch(error){await conn.rollback();if((error as {code?:string}).code==='ER_DUP_ENTRY')throw fail('That username is already in use',409);throw error;}
 finally{conn.release();}
}

