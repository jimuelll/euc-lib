const test = require("node:test");
const assert = require("node:assert/strict");
const query = require("../modules/catalog/catalog.query.service");
const repository = require("../modules/catalog/catalog.repository");
const image = require("../modules/catalog/catalog.image.service");

test("ISBN check normalizes identifiers and excludes the current record", async () => {
 const original=repository.findIsbnMatch;const calls=[];
 repository.findIsbnMatch=async (...args)=>{calls.push(args);return {id:4,title:"Atlas",deleted_at:null};};
 try {assert.deepEqual(await query.checkIsbn("978-0-306-40615-7",5),{id:4,title:"Atlas",deleted_at:null});assert.deepEqual(calls,[["9780306406157",5]]);await assert.rejects(query.checkIsbn("invalid",5),{status:400});}
 finally {repository.findIsbnMatch=original;}
});

test("ISBN cover import rejects arbitrary hosts without fetching them", async () => {
 const lookup=query.lookupIsbn, fetch=global.fetch;let fetched=false;
 query.lookupIsbn=async()=>({cover_url:"https://example.com/cover.jpg"});global.fetch=async()=>{fetched=true;throw new Error("unexpected fetch");};
 try {await assert.rejects(image.importIsbnImage(1,"9780306406157",2),{status:400});assert.equal(fetched,false);}
 finally {query.lookupIsbn=lookup;global.fetch=fetch;}
});

test("ISBN cover import revalidates redirect destinations", async () => {
 const lookup=query.lookupIsbn, fetch=global.fetch;let calls=0;
 query.lookupIsbn=async()=>({cover_url:"https://covers.openlibrary.org/a.jpg"});
 global.fetch=async()=>{calls++;return {status:302,headers:{get:()=>"https://example.com/secret"}};};
 try {await assert.rejects(image.importIsbnImage(1,"9780306406157",2),{status:400});assert.equal(calls,1);}
 finally {query.lookupIsbn=lookup;global.fetch=fetch;}
});
