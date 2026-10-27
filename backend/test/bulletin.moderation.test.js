const test=require('node:test');
const assert=require('node:assert/strict');
const {screenComment}=require('../modules/bulletin/bulletin.moderation.rules');
const {commentVisibility}=require('../modules/bulletin/bulletin.visibility');
const snapshots=require('../modules/backup/snapshot.transforms');
test('screening recognizes English, Filipino, mixed and disguised terms without substring blocking',()=>{
 for(const text of ['This is fucking rude','Gago ka','ang g4g0 naman','f.u.c.k','shiiit'])assert.equal(screenComment(text).action,'revise',text);
 for(const text of ['Papatayin kita','I will kill you','magpakamatay ka']){const result=screenComment(text);assert.equal(result.action,'hold');assert.equal(result.priority,'urgent');}
 for(const text of ['The class discusses identity and discrimination.','Bakla ako at welcome ako dito.','Mga Muslim at Kristiyano sa paaralan.','The bookshelf has an assignment.','Useful library information'])assert.equal(screenComment(text).action,'allow',text);
});
test('removed branches retain only ancestors of live descendants, including through multiple removed levels',()=>{
 const rows=[{id:1,parent_id:null,deleted_at:'now'},{id:2,parent_id:1,hidden_at:'now'},{id:3,parent_id:2},{id:4,parent_id:1,deleted_at:'now'},{id:5,parent_id:null,hidden_at:'now'}];
 let result=commentVisibility(rows);assert.deepEqual([...result.visible].sort(),[1,2,3]);assert.equal(result.children.get(1),1);assert.equal(result.children.get(2),1);
 rows[2].deleted_at='now';assert.equal(commentVisibility(rows).ids.length,0);
});
test('moderation records survive snapshot upgrades and legacy comments get safe neutral defaults',()=>{
 const backup={format:'euc-library-backup',version:24,tables:{bulletin_comments:[{id:1,text:'Existing'}],bulletin_moderation_cases:[{id:7,snapshot_text:'Evidence',status:'open'}],bulletin_moderation_actions:[{case_id:7,action:'reported',reason:'Recorded reason'}]}};
 backup.integrity={algorithm:'sha256',checksum:snapshots.payloadChecksum(backup)};const result=snapshots.upgradeBackup(backup);
 assert.equal(result.version,25);assert.equal(result.tables.bulletin_comments[0].moderation_status,'published');assert.equal(result.tables.bulletin_comments[0].moderation_reason,null);assert.equal(result.tables.bulletin_moderation_cases[0].snapshot_text,'Evidence');assert.equal(result.tables.bulletin_moderation_actions[0].reason,'Recorded reason');assert.deepEqual(result.tables.bulletin_comment_reports,[]);assert.equal(result.integrity.checksum,snapshots.payloadChecksum(result));
});
