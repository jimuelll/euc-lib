import type { Pool, RowDataPacket } from 'mysql2/promise';
const db = require('../../db') as Pool;
export const getConnection = () => db.getConnection();
export interface Profile extends RowDataPacket {name:string;username:string;student_employee_id:string;address:string;contact:string;role:string;must_change_password:number;setup_pending:number;is_active:number}
export async function find(id:number) {
 const [rows]=await db.query<Profile[]>('SELECT name, username, student_employee_id, address, contact, role FROM users WHERE id=? AND deleted_at IS NULL AND is_active=1',[id]);
 return rows[0];
}
