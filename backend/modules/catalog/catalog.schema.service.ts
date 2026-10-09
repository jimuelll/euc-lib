const repository = require("./catalog.repository");
const {enqueueAuditEvent} = require('../analytics/analytics.audit.service');
const SYSTEM_KEYS = new Set(['title','author','isbn','copies','thesis_program','thesis_adviser','academic_year','accession_number','thesis_keywords','thesis_abstract']);
const comparable = (fields:any[]) => fields.map(f=>({key:f.key,label:f.label,type:f.type,options:typeof f.options==='string'?JSON.parse(f.options||'null'):f.options??null,archived_options:typeof f.archived_options==='string'?JSON.parse(f.archived_options||'[]'):f.archived_options||[],required:Boolean(f.required),locked:Boolean(f.locked),public:Boolean(f.public),order:Number(f.order),archived:Boolean(f.archived),scope:f.scope||'shared'})).sort((a,b)=>a.key.localeCompare(b.key));

interface CatalogSchemaField extends Record<string, any> {
  key: string;
  scope: string;
  public?: boolean;
}
interface CatalogSchemaOptions {
  publicOnly?: boolean;
}

const PUBLIC_CATALOGUE_CORE_KEYS = ["id", "title", "author", "isbn", "copies", "material_type", "metadata"];
const OPERATIONAL_BOOK_KEYS = new Set(["title", "author", "isbn", "copies", "book_type_id", "material_type"]);

const fieldsForMaterial = (schema: CatalogSchemaField[], materialType: string): CatalogSchemaField[] =>
  schema.filter((field) => field.scope === "shared" || field.scope === materialType);

const getSchema = async (options: CatalogSchemaOptions = {}): Promise<CatalogSchemaField[]> => repository.getSchema(options);

const upsertSchema = async (fields: CatalogSchemaField[], baseFields:any[], actorId:number|null=null, deleteKeys:string[]=[]): Promise<void> => {
  const conn = await repository.getConnection();
  try {
    await conn.beginTransaction();

    const [before] = await conn.query('SELECT * FROM catalog_schema ORDER BY `key` FOR UPDATE');
    if (!Array.isArray(baseFields) || JSON.stringify(comparable(before))!==JSON.stringify(comparable(baseFields))) {
      throw Object.assign(new Error('The field configuration changed in another session. Refresh to review it before saving.'),{status:409});
    }
    if (!Array.isArray(deleteKeys) || deleteKeys.some(key=>typeof key!=='string')) throw Object.assign(new Error('Invalid field deletion request.'),{status:400});
    for (const old of before) {
      const next = fields.find(f=>f.key===old.key);
      if (next && old.type!==next.type) throw Object.assign(new Error(`The type of “${old.label}” cannot be changed. Add a replacement field.`),{status:409});
      if (SYSTEM_KEYS.has(old.key) && (!next || next.archived || !next.locked || next.scope!==old.scope)) throw Object.assign(new Error(`System field “${old.label}” must retain its protection and scope.`),{status:409});
      if (old.locked && (!next || next.archived)) throw Object.assign(new Error(`Unprotect “${old.label}” before archiving it.`),{status:409});
    }
    for (const key of deleteKeys) {
      const old = before.find((f:any)=>f.key===key);
      if (!old || !old.archived || old.locked || SYSTEM_KEYS.has(key) || fields.some(f=>f.key===key)) throw Object.assign(new Error('Only an archived, unprotected field can be permanently deleted.'),{status:409});
      const path = `$."${key}"`;
      const [used] = await conn.query(`SELECT id FROM books WHERE JSON_EXTRACT(metadata,?) IS NOT NULL AND CAST(JSON_EXTRACT(metadata,?) AS CHAR) NOT IN ('null','""','[]') LIMIT 1 FOR UPDATE`,[path,path]);
      if (used.length) throw Object.assign(new Error(`“${old.label}” has stored data. Keep it archived so that data can be restored.`),{status:409});
      await conn.query('DELETE FROM catalog_schema WHERE `key`=?',[key]);
    }

    const existingKeys: string[] = await repository.findActiveSchemaKeys(conn);
    const incomingKeys = new Set(fields.map((field) => field.key));
    const toArchive = existingKeys.filter((key) => !incomingKeys.has(key) && !deleteKeys.includes(key));
    await repository.archiveSchemaKeys(toArchive, conn);
    await repository.upsertSchema(fields, conn);

    const prior = new Map(comparable(before).map(f=>[f.key,f]));
    const next = new Map(comparable(fields).map(f=>[f.key,f]));
    for (const [key,field] of prior) if (!next.has(key) && !deleteKeys.includes(key)) next.set(key,{...field,archived:true});
    const display = (value:any) => value===undefined || value===null ? 'Not set' : typeof value==='boolean' ? value?'Yes':'No' : Array.isArray(value)?value.join(', '):String(value);
    const changes = [...new Set([...prior.keys(),...next.keys()])].flatMap(key=>{
      const old=prior.get(key),updated=next.get(key);
      return (['label','type','options','archived_options','required','locked','public','order','archived','scope'] as const).filter(property=>JSON.stringify(old?.[property])!==JSON.stringify(updated?.[property])).map(property=>({field:`${updated?.label||old?.label||key} (${key}) · ${property}`,before:display(old?.[property]),after:display(updated?.[property])}));
    });
    await enqueueAuditEvent(conn,{actorId,category:'catalog',action:'updated',route:'/api/admin/catalog-schema',description:'Updated Catalog Configuration · stored record values retained',metadata:{detail_status:'captured',changes}});

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export = {
  OPERATIONAL_BOOK_KEYS,
  PUBLIC_CATALOGUE_CORE_KEYS,
  fieldsForMaterial,
  getSchema,
  upsertSchema,
};
