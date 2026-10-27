const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const repo = require("../modules/catalog/catalog.holdings.repository");
const service = require("../modules/catalog/catalog.holdings.service");
const audit = require("../modules/analytics/transactional-audit");

test("bulk accessions preserve zeros, map selected order, and commit one audit", async () => {
 const original={getConnection:db.getConnection,getCopyForUpdate:repo.getCopyForUpdate,insertAccessionClaim:repo.insertAccessionClaim,insertHolding:repo.insertHolding,enqueueTransactionalAudit:audit.enqueueTransactionalAudit};
 const claims=[], writes=[], events=[], state={commit:0,rollback:0};
 db.getConnection=async()=>({beginTransaction:async()=>{},commit:async()=>{state.commit++;},rollback:async()=>{state.rollback++;},release:()=>{},query:async()=>[[{id:5,title:"Atlas"}]]});
 repo.getCopyForUpdate=async id=>({id,book_id:5,barcode:`copy-${id}`,title:"Atlas",is_active:1,accession_number:null});
 repo.insertAccessionClaim=async(copy,number)=>claims.push([copy.id,number]);
 repo.insertHolding=async(id,value)=>writes.push([id,value.accessionNumber]);
 audit.enqueueTransactionalAudit=async(_conn,event)=>events.push(event);
 try {
  const result=await service.assignAccessionRange(5,{copyIds:[8,3,7],start:"0006"},2);
  assert.deepEqual(claims,[[8,"0006"],[3,"0007"],[7,"0008"]]);
  assert.deepEqual(writes,claims);assert.equal(events.length,1);assert.equal(result.assignments.length,3);assert.equal(state.commit,1);
  await assert.rejects(service.assignAccessionRange(5,{copyIds:[8,8],start:"1"},2),{status:400});
  repo.insertAccessionClaim=async()=>{throw Object.assign(new Error("duplicate"),{code:"ER_DUP_ENTRY"});};
  await assert.rejects(service.assignAccessionRange(5,{copyIds:[8,3],start:"9"},2),{status:409});
  assert.equal(state.rollback,1);assert.equal(state.commit,1);assert.equal(events.length,1);
  repo.getCopyForUpdate=async id=>({id,book_id:5,is_active:1,accession_number:"12"});
  await assert.rejects(service.assignAccessionRange(5,{copyIds:[8],start:"1"},2),{status:409});
  assert.equal(state.rollback,2);
 } finally {db.getConnection=original.getConnection;repo.getCopyForUpdate=original.getCopyForUpdate;repo.insertAccessionClaim=original.insertAccessionClaim;repo.insertHolding=original.insertHolding;audit.enqueueTransactionalAudit=original.enqueueTransactionalAudit;}
});
