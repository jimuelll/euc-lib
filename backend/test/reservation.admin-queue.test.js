const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const repository = require("../modules/reservation/reservation.repository");
test("admin queue filters live work while counts ignore status and preserve search", async () => {
  const original = db.query; const calls=[];
  db.query=async(sql,params)=>{calls.push({sql:sql.replace(/\s+/g," "),params});if(sql.includes("AS total_records"))return [[{total_records:4,pending_count:2,ready_count:1,expired_count:1,expiring_count:1,soonest_expiry:"2026-10-09T10:00:00"}],[]];if(sql.includes("COUNT(*) AS total"))return [[{total:3}],[]];return [[],[]];};
  try {const result=await repository.getAdminReservations({status:"needs_action",search:"Alex",page:1,limit:15});assert.match(calls[0].sql,/r.status IN \('pending','ready'\)/);assert.doesNotMatch(calls[1].sql,/AND r.status IN/);assert.deepEqual(calls[1].params,["%Alex%","%Alex%","%Alex%","%Alex%"]);assert.match(calls[2].sql,/ORDER BY CASE r.status WHEN 'ready' THEN 0 WHEN 'pending' THEN 1/);assert.match(calls[2].sql,/AS available_copies/);assert.match(calls[2].sql,/bc.id = r.reserved_copy_id\) AS reserved_copy_barcode/);assert.equal(result.summary.pending_count,2);assert.equal(result.summary.expiring_count,1);} finally {db.query=original;}
});
test("cancellation reason is appended without overwriting existing notes",async()=>{const calls=[];const conn={query:async(sql,params)=>{calls.push({sql,params});return [{affectedRows:1}];}};await repository.cancelReservationAdmin(8,conn,"Patron request");assert.match(calls[0].sql,/CONCAT_WS\(CHAR\(10\), NULLIF\(notes/);assert.deepEqual(calls[0].params,["Cancellation reason: Patron request",8]);assert.match(calls[0].sql,/status IN \('pending','ready'\)/);});
if(require.main===module)test.after(()=>db.end());
