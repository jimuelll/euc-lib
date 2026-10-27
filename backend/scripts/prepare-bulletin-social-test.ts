import mysql = require('mysql2/promise');
import db = require('../db');
import {migrateBulletinSocial} from './migrate-bulletin-social';
async function main(){
 if(!['localhost','127.0.0.1','::1'].includes(process.env.DB_HOST||''))throw new Error('This helper only supports local MySQL.');
 const name='euc_bulletin_social_test';
 await db.query(`CREATE DATABASE IF NOT EXISTS ${name}`);
 for(const table of ['users','audit_events','bulletin_posts','bulletin_comments','bulletin_likes','delivery_outbox','website_content_drafts'])await db.query(`CREATE TABLE IF NOT EXISTS ${name}.${table} LIKE ${table}`);
 const pool=mysql.createPool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASS,database:name,timezone:'Z',connectionLimit:10});
 try{await migrateBulletinSocial(pool);}finally{await pool.end();}
 console.log('Dedicated euc_bulletin_social_test schema ready; no library records were copied.');
}
main().catch(error=>{console.error(error.code||error.message);process.exitCode=1;}).finally(()=>db.end());
