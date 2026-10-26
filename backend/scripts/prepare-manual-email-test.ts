import db = require('../db');
// A separate, fixed test schema. CREATE TABLE LIKE copies structure, never library records.
async function main(){
  if(!['localhost','127.0.0.1','::1'].includes(process.env.DB_HOST || ''))throw new Error('This test-schema helper is restricted to local MySQL.');
  await db.query('CREATE DATABASE IF NOT EXISTS euc_manual_email_test');
  for(const table of ['users','notifications','notification_reads','email_deliveries','delivery_outbox','email_quota_usage','email_dispatch_state','system_maintenance_state']){
    await db.query(`CREATE TABLE IF NOT EXISTS euc_manual_email_test.${table} LIKE ${table}`);
  }
  await db.query('INSERT IGNORE INTO euc_manual_email_test.email_dispatch_state(id) VALUES (1)');
  await db.query("INSERT IGNORE INTO euc_manual_email_test.system_maintenance_state(id,mode) VALUES (1,'idle')");
  console.log('Dedicated euc_manual_email_test schema ready; no library records copied.');
}
main().catch(error=>{console.error(error.code || error.message);process.exitCode=1;}).finally(()=>db.end());
