/** Parameterized filters used by configuration impact links. Zero and false are values. */
export function configurationFilter(fieldKey?:string, fieldUsage?:string, unheld=false) {
 const params:string[]=[];
 let sql='';
 if(fieldKey && (fieldUsage==='used'||fieldUsage==='missing')) {
  const core=new Set(['title','author','isbn','copies']);
  let present:string;
  if(core.has(fieldKey)) present=`NULLIF(TRIM(CAST(bk.${fieldKey} AS CHAR)), '') IS NOT NULL`;
  else {
   const path=`$."${fieldKey}"`;
   present=`CASE WHEN JSON_TYPE(JSON_EXTRACT(bk.metadata, ?))='ARRAY' THEN EXISTS (SELECT 1 FROM JSON_TABLE(COALESCE(JSON_EXTRACT(bk.metadata, ?),JSON_ARRAY()), '$[*]' COLUMNS (item VARCHAR(4096) PATH '$' NULL ON ERROR)) option_value WHERE NULLIF(TRIM(option_value.item),'') IS NOT NULL) ELSE JSON_TYPE(JSON_EXTRACT(bk.metadata, ?)) <> 'NULL' AND NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(bk.metadata, ?))), '') IS NOT NULL END`;
   params.push(path,path,path,path);
  }
  sql+=` AND ${fieldUsage==='missing'?'NOT ':''}(COALESCE((${present}),FALSE))`;
 }
 if(unheld) sql+=" AND bk.material_type='book' AND NOT EXISTS (SELECT 1 FROM book_copies unheld_copy JOIN copy_holdings unheld_holding ON unheld_holding.copy_id=unheld_copy.id WHERE unheld_copy.book_id=bk.id AND unheld_copy.deleted_at IS NULL AND unheld_copy.is_active=1 AND unheld_copy.condition IN ('good','damaged') AND NULLIF(TRIM(unheld_holding.accession_number),'') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accession_claim_voids unheld_void WHERE unheld_void.accession_number=unheld_holding.accession_number))";
 return {sql,params};
}
