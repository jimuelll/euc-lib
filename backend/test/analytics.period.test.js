const test=require('node:test');const assert=require('node:assert/strict');
const db=require('../db');const {formatReport}=require('../modules/analytics/aiReport.format');
const {periodCharts}=require('../modules/analytics/analytics.period.repository');
test('daily evidence preserves SQL dates at UTC+08 and keeps attendance and fine ledger totals',async()=>{
 const repository=require('../modules/analytics/analytics.repository'),overdue=require('../modules/borrowing/overdue.helper');
 const path=require.resolve('../modules/analytics/aiReport.evidence.service'),cached=require.cache[path];
 const originals={data:repository.getAiReportQueryData,bounds:repository.getReportRangeBounds,list:overdue.listUnsettledBorrowings};
 try{
 repository.getAiReportQueryData=async()=>({circulation:{borrowed:4},reservations:{},attendance:{entry_exit_scans:3},visits:{},fines:{},topBooks:[],watchItems:{},previousCirculation:{},previousReservations:{},previousAttendance:{},previousVisits:{},previousFines:{},dailyActivity:[{day:new Date('2026-10-02T16:00:00Z'),borrowed:4,entry_exit_scans:3,library_entries:2,unique_library_visitors:2}],topBorrower:null});
 repository.getReportRangeBounds=async()=>({dateFrom:'2026-09-04',dateTo:'2026-10-09'});overdue.listUnsettledBorrowings=async()=>({summary:{total_unsettled_amount:2118}});
 delete require.cache[path];const {buildAiReportEvidence}=require(path);const result=await buildAiReportEvidence({dateFrom:'2026-10-03',dateTo:'2026-10-09'});
 assert.equal(result.activity.daily_activity[0].date,'2026-10-03');assert.equal(result.activity.daily_activity[0].borrowed,4);assert.equal(result.activity.daily_activity[0].library_entries,2);assert.equal(result.activity.daily_activity.at(-1).date,'2026-10-09');assert.equal(result.current_watch_items.outstanding_fines,2118);
 }finally{repository.getAiReportQueryData=originals.data;repository.getReportRangeBounds=originals.bounds;overdue.listUnsettledBorrowings=originals.list;if(cached)require.cache[path]=cached;else delete require.cache[path];}
});
test('AI briefs use pesos and discard unrecorded prior-period growth claims',()=>{
 const text=formatReport('## Key findings\n- 1260 USD in fines settled.\n- Borrowing increased by +13 vs the prior period.\n- 13 items borrowed.',false);
 assert.match(text,/₱1,260/);assert.match(text,/No prior data to compare/);assert.doesNotMatch(text,/USD|increased|\+13/);assert.match(text,/13 items borrowed/);
 assert.match(formatReport('USD 200 was settled.',true),/₱200/);
});
test('period charts use bounded event dates and borrowed_at for circulation demand',async()=>{const original=db.query,calls=[];db.query=async(sql,params)=>{calls.push({sql,params});return [[]];};
 try{await periodCharts('2026-10-02','2026-10-08');assert.equal(calls.length,4);for(const call of calls){assert.ok(call.params.every(value=>['2026-10-02','2026-10-08'].includes(value)));assert.match(call.sql,/DATE_ADD\(\?,INTERVAL 1 DAY\)/);}assert.match(calls[2].sql,/b\.borrowed_at>=\?/);assert.doesNotMatch(calls[2].sql,/created_at/);}
 finally{db.query=original;}
});
