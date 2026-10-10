// SQL datetime strings are library time (UTC+08); ISO timestamps keep their offset.
export function adminInstant(value:string){return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:value.replace(' ','T')+'+08:00');}
export function adminUpdatedTime(value:string){const date=adminInstant(value);return Number.isFinite(date.getTime())?date.toLocaleString('en-PH',{timeZone:'Asia/Ulaanbaatar',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'—';}
