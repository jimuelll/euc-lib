import type {RowDataPacket} from 'mysql2/promise';
import db=require('../db');
async function main(){
 const conn=await db.getConnection();let locked=false;
 try{
  if(process.argv.includes('--apply')){const [[lock]]=await conn.query<RowDataPacket[]>("SELECT GET_LOCK('euc-library-email-dispatch',30) AS acquired");if(!lock.acquired)throw new Error('Email worker is busy. Retry the migration.');locked=true;}
  const [columns]=await conn.query<RowDataPacket[]>('SHOW COLUMNS FROM notifications');
  for(const[name,type]of Object.entries({image_url:'varchar(1024)',image_public_id:'varchar(191)',image_alt:'varchar(250)'}))if(!columns.some(row=>row.Field===name)){
   if(!locked)throw new Error(`Migration required: notifications.${name}. Run with --apply.`);
   await conn.query(`ALTER TABLE notifications ADD COLUMN ${name} ${type} DEFAULT NULL`);console.log(`Added notifications.${name}`);
  }
  console.log('Notification image schema ready. Existing notifications remain text-only; no emails queued.');
 }finally{if(locked)await conn.query("SELECT RELEASE_LOCK('euc-library-email-dispatch')");conn.release();}
}
main().catch(error=>{console.error(error.code||error.message);process.exitCode=1;}).finally(()=>db.end());
