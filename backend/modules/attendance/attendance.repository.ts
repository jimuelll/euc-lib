import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  AttendanceCountRow,
  AttendanceFilters,
  AttendanceLogRow,
  AttendanceSessionRow,
  AttendanceSummaryRow,
  AttendanceType,
  AttendanceUser,
  MyLogsOptions,
  MyLogsQueryResult,
  TodayLogInput,
} from "./attendance.types";

const db = require("../../db") as Pool;

interface LatestLogRow extends RowDataPacket {
  type: AttendanceType; id:number;
}

interface AttendanceInsertInput {
  userId: number;
  scannedId: string;
  type: AttendanceType;
  scannedBy: number;
  ipAddress?: string;
}

const resolveUser = async (scannedId: string): Promise<AttendanceUser | null> => {
  const [[user]] = await db.query<AttendanceUser[]>(
    `SELECT id, name, role, student_employee_id, barcode
       FROM users
      WHERE (barcode = ? OR student_employee_id = ?)
        AND is_active = 1
      LIMIT 1`,
    [scannedId, scannedId],
  );
  return user ?? null;
};

const acquireScanLock = async (lockName: string): Promise<PoolConnection | null> => {
  const connection = await db.getConnection();
  try {
    const [[row]] = await connection.query<{ acquired: number | null } & RowDataPacket[]>("SELECT GET_LOCK(?, 5) AS acquired", [lockName]);
    if (row?.acquired) return connection;
    connection.release();
    return null;
  } catch (error) { connection.release(); throw error; }
};

const getLatestEntryExitLog = async (userId: number, connection?: PoolConnection): Promise<LatestLogRow | null> => {
  const [[row]] = await (connection || db).query<LatestLogRow[]>(
    `SELECT id,type FROM attendance_logs
      WHERE user_id = ?
        AND created_at >= CURDATE()
        AND created_at < CURDATE() + INTERVAL 1 DAY
        AND purpose = 'entry_exit'
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [userId],
  );
  return row ?? null;
};

const insertScan = async ({ userId, scannedId, type, scannedBy, ipAddress }: AttendanceInsertInput, connection?: PoolConnection): Promise<void> => {
  await (connection || db).query(
    `INSERT INTO attendance_logs
      (user_id, scanned_id, type, purpose, scanned_by, ip_address)
     VALUES (?, ?, ?, 'entry_exit', ?, ?)`,
    [userId, scannedId, type, scannedBy ?? null, ipAddress ?? null],
  );
};

const releaseScanLock = async (lockName: string, connection: PoolConnection) => {
  try { await connection.query("SELECT RELEASE_LOCK(?)", [lockName]); }
  finally { connection.release(); }
};

const getTodayLogs = async ({ limit, lastId = null }: Required<Pick<TodayLogInput, "limit">> & Pick<TodayLogInput, "lastId">): Promise<AttendanceLogRow[]> => {
  const params: unknown[] = [];
  const cursorClause = lastId ? "AND al.id < ?" : "";
  if (lastId) params.push(lastId);
  params.push(limit);
  const [rows] = await db.query<AttendanceLogRow[]>(
    `SELECT al.id, al.type, al.created_at AS timestamp,
            u.name, u.student_employee_id, u.role
       FROM attendance_logs al
       JOIN users u ON u.id = al.user_id
      WHERE al.created_at >= CURDATE()
        AND al.created_at < CURDATE() + INTERVAL 1 DAY
        AND al.purpose = 'entry_exit'
        ${cursorClause}
      ORDER BY al.created_at DESC
      LIMIT ?`,
    params,
  );
  return rows;
};

const getLogs = async (filters: AttendanceFilters) => {
  const { page, limit, search, type, purpose, dateFrom, dateTo } = filters;
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (type && type !== "all") { conditions.push("al.type = ?"); params.push(type); }
  if (purpose && purpose !== "all") { conditions.push("al.purpose = ?"); params.push(purpose); }
  if (dateFrom) { conditions.push("al.created_at >= ?"); params.push(`${dateFrom} 00:00:00`); }
  if (dateTo) { conditions.push("al.created_at < DATE_ADD(?, INTERVAL 1 DAY)"); params.push(dateTo); }
  if (search.trim()) {
    const like = `%${search.trim()}%`;
    conditions.push("(u.name LIKE ? OR u.student_employee_id LIKE ? OR al.scanned_id LIKE ? OR scanner.name LIKE ?)");
    params.push(like, like, like, like);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const baseFromClause = `
    FROM attendance_logs al
    JOIN users u ON u.id = al.user_id
    LEFT JOIN users scanner ON scanner.id = al.scanned_by
    ${whereClause}`;

  const [[totalRow]] = await db.query<AttendanceCountRow[]>(`SELECT COUNT(*) AS total ${baseFromClause}`, params);
  const [[summaryRow]] = await db.query<AttendanceSummaryRow[]>(
    `SELECT COUNT(*) AS total_records,
            SUM(CASE WHEN al.type = 'check_in' THEN 1 ELSE 0 END) AS check_in_count,
            SUM(CASE WHEN al.type = 'check_out' THEN 1 ELSE 0 END) AS check_out_count,
            COUNT(DISTINCT al.user_id) AS unique_users,
            SUM(CASE WHEN al.purpose = 'borrowing' THEN 1 ELSE 0 END) AS borrowing_scan_count
       ${baseFromClause}`,
    params,
  );
  const [rows] = await db.query<AttendanceLogRow[]>(
    `SELECT al.id, al.type, al.purpose, al.scanned_id,
            al.created_at AS timestamp, u.name, u.student_employee_id,
            u.role, scanner.name AS scanned_by_name
       ${baseFromClause}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return { rows, total: Number(totalRow?.total ?? 0), summary: summaryRow ?? null };
};

const getSessionsForDate = async (date: string): Promise<AttendanceSessionRow[]> => {
  const [rows] = await db.query<AttendanceSessionRow[]>(
    `SELECT in_log.id, u.name, u.student_employee_id,
            in_log.created_at AS checked_in_at,
            (SELECT out_log.created_at
               FROM attendance_logs out_log
              WHERE out_log.user_id = in_log.user_id
                AND out_log.purpose = 'entry_exit'
                AND out_log.type = 'check_out'
                AND out_log.created_at > in_log.created_at
                AND out_log.created_at < DATE_ADD(?, INTERVAL 1 DAY)
                AND NOT EXISTS (
                  SELECT 1 FROM attendance_logs next_in
                   WHERE next_in.user_id = in_log.user_id
                     AND next_in.purpose = 'entry_exit'
                     AND next_in.type = 'check_in'
                     AND next_in.created_at > in_log.created_at
                     AND next_in.created_at < out_log.created_at
                )
              ORDER BY out_log.created_at ASC LIMIT 1) AS checked_out_at
       FROM attendance_logs in_log
       JOIN users u ON u.id = in_log.user_id
      WHERE in_log.purpose = 'entry_exit'
        AND in_log.type = 'check_in'
        AND in_log.created_at >= ?
        AND in_log.created_at < DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY in_log.created_at ASC`,
    [date, date, date],
  );
  return rows;
};

const getMyLogs = async (userId: number, { paged, limit, offset }: MyLogsOptions): Promise<MyLogsQueryResult> => {
  let total: number | string = 0;
  if (paged) {
    const [[row]] = await db.query<AttendanceCountRow[]>(
      "SELECT COUNT(*) AS total FROM attendance_logs WHERE user_id = ? AND purpose = 'entry_exit'",
      [userId],
    );
    total = row?.total ?? 0;
  }
  const [rows] = await db.query<AttendanceLogRow[]>(
    `SELECT id, type, created_at AS timestamp
       FROM attendance_logs
      WHERE user_id = ? AND purpose = 'entry_exit'
      ORDER BY created_at DESC${paged ? " LIMIT ? OFFSET ?" : " LIMIT 100"}`,
    paged ? [userId, limit, offset] : [userId],
  );
  return { rows, total: Number(total) };
};

const getVisits=async({page=1,limit=25,search="",type="all",purpose="all",dateFrom="",dateTo=""}:AttendanceFilters)=>{
 const derived=`WITH events AS (SELECT al.*, LEAD(type) OVER(PARTITION BY user_id,purpose ORDER BY created_at,id) AS next_type, LEAD(created_at) OVER(PARTITION BY user_id,purpose ORDER BY created_at,id) AS next_time, LAG(type) OVER(PARTITION BY user_id,purpose ORDER BY created_at,id) AS previous_type, LAG(created_at) OVER(PARTITION BY user_id,purpose ORDER BY created_at,id) AS previous_time FROM attendance_logs al), visits AS (SELECT e.id,e.user_id,e.scanned_id,e.purpose,e.type, e.created_at AS timestamp,CASE WHEN e.type='check_in' THEN e.created_at END AS checked_in_at,CASE WHEN e.type='check_out' THEN e.created_at WHEN e.next_type='check_out' AND DATE(e.next_time)=DATE(e.created_at) THEN e.next_time END AS checked_out_at,u.name,u.student_employee_id,u.role,scanner.name AS scanned_by_name FROM events e JOIN users u ON u.id=e.user_id LEFT JOIN users scanner ON scanner.id=e.scanned_by WHERE e.type='check_in' OR e.purpose='borrowing' OR e.previous_type IS NULL OR e.previous_type<>'check_in' OR DATE(e.previous_time)<>DATE(e.created_at))`;
 const where:string[]=[];const params:unknown[]=[];
 if(search.trim()){where.push("(name LIKE ? OR student_employee_id LIKE ? OR scanned_id LIKE ?)");const like=`%${search.trim()}%`;params.push(like,like,like);}
 if(purpose!=="all"){where.push("purpose = ?");params.push(purpose);}
 if(dateFrom){where.push("timestamp >= ?");params.push(dateFrom);}
 if(dateTo){where.push("timestamp < DATE_ADD(?,INTERVAL 1 DAY)");params.push(dateTo);}
 const base=where.length?`WHERE ${where.join(" AND ")}`:"";
 const [[summary]]=await db.query<RowDataPacket[]>(`${derived} SELECT COUNT(*) AS total,COUNT(DISTINCT user_id) AS unique_users,SUM(checked_in_at IS NOT NULL AND purpose='entry_exit') AS arrivals,SUM(checked_out_at IS NOT NULL AND purpose='entry_exit') AS departures,SUM(checked_in_at IS NOT NULL AND checked_out_at IS NULL AND purpose='entry_exit' AND DATE(timestamp)=CURDATE()) AS inside FROM visits ${base}`,params);
 const extra=type==="inside"?"purpose='entry_exit' AND checked_in_at IS NOT NULL AND checked_out_at IS NULL AND DATE(timestamp)=CURDATE()":type==="arrivals"?"checked_in_at IS NOT NULL AND purpose='entry_exit'":type==="departures"?"checked_out_at IS NOT NULL AND purpose='entry_exit'":"";
 const filtered=extra?`${base} ${base?"AND":"WHERE"} ${extra}`:base;
 const [[count]]=await db.query<RowDataPacket[]>(`${derived} SELECT COUNT(*) AS total FROM visits ${filtered}`,params);
 const [rows]=await db.query<RowDataPacket[]>(`${derived} SELECT *,TIMESTAMPDIFF(MINUTE,checked_in_at,checked_out_at) AS duration_minutes FROM visits ${filtered} ORDER BY timestamp DESC,id DESC LIMIT ? OFFSET ?`,[...params,limit,(page-1)*limit]);
 return {rows,summary:{total_visits:Number(summary.total || 0),unique_users:Number(summary.unique_users || 0),arrivals:Number(summary.arrivals || 0),departures:Number(summary.departures || 0),inside:Number(summary.inside || 0)},pagination:{page,limit,total:Number(count.total),totalPages:Math.max(1,Math.ceil(Number(count.total)/limit))}};
};
const getInsideToday=async(cutoff:string)=>{const[rows]=await db.query<RowDataPacket[]>(`SELECT al.id,al.user_id,al.scanned_id FROM attendance_logs al WHERE al.purpose='entry_exit' AND al.type='check_in' AND al.created_at>=CURDATE() AND UNIX_TIMESTAMP(al.created_at)<=? AND NOT EXISTS(SELECT 1 FROM attendance_logs newer WHERE newer.user_id=al.user_id AND newer.purpose='entry_exit' AND (newer.created_at>al.created_at OR (newer.created_at=al.created_at AND newer.id>al.id)))`,[Math.floor(Date.parse(cutoff)/1000)]);return rows;};

export = { getVisits,getInsideToday,
  resolveUser,
  acquireScanLock,
  getLatestEntryExitLog,
  insertScan,
  releaseScanLock,
  getTodayLogs,
  getLogs,
  getSessionsForDate,
  getMyLogs,
};
