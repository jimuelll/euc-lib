const db = require("../../db");

const syncOverdueBorrowings = async (conn = db) => {
  await conn.query(
    `UPDATE borrowings
     SET status = 'overdue'
     WHERE status = 'borrowed'
       AND due_date < CURDATE()`
  );
};

module.exports = { syncOverdueBorrowings };
