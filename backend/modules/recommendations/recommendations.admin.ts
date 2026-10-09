import type {BackfillOptions} from './recommendations.types';
export function validateBackfillOptions(input:any={}):BackfillOptions {
 if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(new Error('Choose valid backfill options'),{status:400});
 const scope=input.scope??'attention',limit=input.limit??100;
 if(!['attention','synopses','embeddings','selected','all'].includes(scope)||!Number.isInteger(limit)||limit<1||limit>1000)throw Object.assign(new Error('Choose a scope and a limit from 1 to 1,000 books'),{status:400});
 if(input.retryFailures!==undefined&&typeof input.retryFailures!=='boolean')throw Object.assign(new Error('Retry failures must be On or Off'),{status:400});
 const ids=input.bookIds??[];
 if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>!Number.isSafeInteger(id)||id<1)||scope==='selected'&&!ids.length)throw Object.assign(new Error('Select at least one valid book (up to 1,000)'),{status:400});
 return {scope,limit,bookIds:[...new Set<number>(ids)],retryFailures:Boolean(input.retryFailures)};
}
export function synopsisSql(){
 const value=(key:string)=>`COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(enrichment.enrichment_json, '$.${key}')),'null'),'')`;
 return `CASE WHEN TRIM(${value('description')})<>'' THEN 'present' WHEN NULLIF(TRIM(bk.isbn),'') IS NULL OR enrichment.source='manual' THEN 'missing' WHEN TRIM(${value('synopsisLastError')})<>'' OR TRIM(${value('googleBooksSynopsisLastError')})<>'' THEN 'lookup_failed' WHEN CAST(${value('synopsisProviderCheckVersion')} AS UNSIGNED)>=1 THEN 'no_description' ELSE 'not_checked' END`;
}
