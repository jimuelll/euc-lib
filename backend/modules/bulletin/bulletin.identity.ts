// Bulletin readers see a limited student identity; moderation retains the account ID.
export function bulletinName(name:string,role:string):string {
 if(role!=='student')return name;
 const words=String(name||'').trim().split(/\s+/).filter(Boolean);
 return words.length>1?`${words[0]} ${Array.from(words[words.length-1])[0].toLocaleUpperCase()}.`:words[0]||'Reader';
}
export function publicComment(row:any){
 if(row.deleted_at||row.hidden_at)return {...row,author:'',author_id:null,author_role:null,text:'',helpful_count:0,helpful_by_me:false};
 return {...row,helpful_count:Number(row.helpful_count||0),helpful_by_me:Number(row.helpful_by_me||0)>0,author:bulletinName(row.author,row.author_role)};
}
