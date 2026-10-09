const db = require('../../db');
export async function periodCharts(dateFrom: string, dateTo: string) {
    const [[reservations], [fines], [roles], [books]] = await Promise.all([
        db.query(`SELECT label,SUM(created_count) created_count,SUM(fulfilled_count) fulfilled_count,SUM(cancelled_count) cancelled_count FROM (
 SELECT DATE_FORMAT(reserved_at,'%Y-%m-%d') label,COUNT(*) created_count,0 fulfilled_count,0 cancelled_count FROM reservations WHERE reserved_at>=? AND reserved_at<DATE_ADD(?,INTERVAL 1 DAY) GROUP BY label
 UNION ALL SELECT DATE_FORMAT(fulfilled_at,'%Y-%m-%d'),0,COUNT(*),0 FROM reservations WHERE fulfilled_at>=? AND fulfilled_at<DATE_ADD(?,INTERVAL 1 DAY) GROUP BY DATE_FORMAT(fulfilled_at,'%Y-%m-%d')
 UNION ALL SELECT DATE_FORMAT(cancelled_at,'%Y-%m-%d'),0,0,COUNT(*) FROM reservations WHERE cancelled_at>=? AND cancelled_at<DATE_ADD(?,INTERVAL 1 DAY) GROUP BY DATE_FORMAT(cancelled_at,'%Y-%m-%d')) flow GROUP BY label ORDER BY label`, [dateFrom, dateTo, dateFrom, dateTo, dateFrom, dateTo]),
        db.query(`SELECT DATE_FORMAT(effective_at,'%Y-%m-%d') label,COALESCE(SUM(-amount),0) settled_amount FROM fine_ledger_entries WHERE kind IN ('payment','legacy_credit','reversal') AND effective_at>=? AND effective_at<DATE_ADD(?,INTERVAL 1 DAY) GROUP BY label ORDER BY label`, [dateFrom, dateTo]),
        db.query(`SELECT u.role name,COUNT(*) value FROM borrowings b JOIN users u ON u.id=b.user_id WHERE b.borrowed_at>=? AND b.borrowed_at<DATE_ADD(?,INTERVAL 1 DAY) GROUP BY u.role ORDER BY value DESC`, [dateFrom, dateTo]),
        db.query(`SELECT COALESCE(bk.title,'Deleted book') name,COUNT(*) total FROM borrowings b LEFT JOIN books bk ON bk.id=b.book_id WHERE b.borrowed_at>=? AND b.borrowed_at<DATE_ADD(?,INTERVAL 1 DAY) GROUP BY b.book_id,bk.title ORDER BY total DESC LIMIT 5`, [dateFrom, dateTo])
    ]);
    return { reservations, fines, roles, books };
}
