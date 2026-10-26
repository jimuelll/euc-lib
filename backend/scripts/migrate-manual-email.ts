import type { RowDataPacket } from 'mysql2/promise';
import db = require('../db');

// Additive and restartable after a partial DDL failure. Never reads or logs credentials.
async function main() {
  const apply=process.argv.includes('--apply');
  const conn=await db.getConnection();let locked=false;
  try {
    if(apply){const [[lock]]=await conn.query<RowDataPacket[]>("SELECT GET_LOCK('euc-library-email-dispatch',30) AS acquired");if(!lock.acquired)throw new Error('Email worker is busy; retry the migration.');locked=true;}
    const additions:Record<string,Record<string,string>>={
      notifications:{email_requested:'tinyint(1) NOT NULL DEFAULT 0',email_batch_id:'char(36) DEFAULT NULL',email_expires_at:'datetime DEFAULT NULL'},
      email_deliveries:{notification_id:'bigint(20) UNSIGNED DEFAULT NULL'}
    };
    for(const [table,columns]of Object.entries(additions)){
      const [existing]=await conn.query<RowDataPacket[]>(`SHOW COLUMNS FROM ${table}`);
      for(const [name,definition]of Object.entries(columns))if(!existing.some(row=>row.Field===name)){
        if(!apply)throw new Error(`Migration required: ${table}.${name}. Run with --apply before deploying.`);
        await conn.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
        console.log(`Added ${table}.${name}`);
      }
    }
    const [indexes]=await conn.query<RowDataPacket[]>('SHOW INDEX FROM email_deliveries');
    if(!indexes.some(row=>row.Key_name==='idx_email_notification')){
      if(!apply)throw new Error('Migration required: email notification index.');
      await conn.query('ALTER TABLE email_deliveries ADD KEY idx_email_notification (notification_id,status)');
      console.log('Added email notification index');
    }
    console.log('Manual notification email schema is ready. Existing notifications were not queued.');
  } finally {if(locked)await conn.query("SELECT RELEASE_LOCK('euc-library-email-dispatch')");conn.release();}
}
main().catch(error=>{console.error(error.code || error.message);process.exitCode=1;}).finally(()=>db.end());
