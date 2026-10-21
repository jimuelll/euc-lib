import { randomBytes } from 'node:crypto';
import bcrypt = require('bcryptjs');
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { normalizeEmail, requireEmail } from '../modules/email/email.config';
import { transaction, claimAddress, invite, invalidateChallenges } from '../modules/auth/account-email.service';
const db=require('../db') as Pool;
async function run() {
  requireEmail();
  const [identifier,address]=process.argv.slice(2);
  if(!identifier || !address)throw new Error('Usage: invite-super-admin <username> <email>');
  const email=normalizeEmail(address),hash=await bcrypt.hash(randomBytes(48).toString('base64url'),12);
  await transaction(async conn=>{
    const [[user]]=await conn.query<RowDataPacket[]>("SELECT * FROM users WHERE student_employee_id=? AND role='super_admin' AND deleted_at IS NULL AND is_active=1 FOR UPDATE",[identifier]);
    if(!user)throw new Error('Active super-admin account not found');
    await claimAddress(conn,user.id,email);
    await invalidateChallenges(conn,user.id);
    await conn.query('UPDATE users SET email=?,pending_email=NULL,email_verified_at=NULL,password_hash=?,setup_pending=1,must_change_password=1,session_version=session_version+1 WHERE id=?',[email,hash,user.id]);
    await conn.query('DELETE FROM email_address_claims WHERE user_id=? AND email<>?',[user.id,email]);
    await conn.query('UPDATE auth_refresh_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=?',[user.id]);
    await invite(conn,{...user,email});
  });
  console.log('Super-admin invitation queued. The backend worker must be running.');
}
void run().catch(()=>{console.error('Invitation could not be queued. Check arguments, configuration, schema, and address uniqueness.');process.exitCode=1;}).finally(()=>db.end());
