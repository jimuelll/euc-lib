const MAX_FILE=40*1024*1024;
const encode=(bytes:Uint8Array)=>{let text='';for(let offset=0;offset<bytes.length;offset+=8192)text+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(text);};
const decode=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function key(password:string,salt:Uint8Array,usage:KeyUsage[]){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt as BufferSource,iterations:300000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,usage);}
export async function encryptBackup(blob:Blob,password:string){if(password.length<12)throw new Error('Use at least 12 characters for the backup password.');const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(password,salt,['encrypt']),await blob.arrayBuffer());return new Blob([JSON.stringify({format:'euc-library-encrypted',version:1,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:300000,salt:encode(salt),iv:encode(iv),data:encode(new Uint8Array(encrypted))})],{type:'application/json'});}
async function boundedText(source:ReadableStream<Uint8Array>,maxBytes:number){const reader=source.getReader(),chunks:Uint8Array[]=[];let total=0;while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw new Error('The expanded backup exceeds the import limit.');}chunks.push(value);}const data=new Uint8Array(total);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(data);}
export async function readBackup(file:File,maxBytes:number,password=''):Promise<unknown>{
 const encryptedName=file.name.toLowerCase().endsWith('.encrypted.json'),fileLimit=encryptedName?60*1024*1024:MAX_FILE;
 if(file.size>fileLimit)throw new Error(`Choose a backup file of ${encryptedName?'60':'40'} MB or less.`);
 let text=await boundedText(file.name.toLowerCase().endsWith('.gz')?file.stream().pipeThrough(new DecompressionStream('gzip')):file.stream(),encryptedName?fileLimit:maxBytes);
 let value;try{value=JSON.parse(text);}catch{throw new Error('This file is damaged or is not a JSON backup.');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Choose an EUC Library backup file.');
 if(value.format==='euc-library-encrypted'){
  if(!password)throw new Error('Enter the password used to encrypt this backup file.');
  if(value.version!==1||value.algorithm!=='AES-256-GCM'||value.kdf!=='PBKDF2-SHA256'||value.iterations!==300000||typeof value.data!=='string')throw new Error('Unsupported encrypted backup format.');
  try{const salt=decode(value.salt),iv=decode(value.iv);if(salt.length!==16||iv.length!==12)throw new Error('Invalid encryption metadata');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},await key(password,salt,['decrypt']),decode(value.data));text=await boundedText(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip')),maxBytes);value=JSON.parse(text);}catch{throw new Error('The backup password is incorrect or the file is damaged.');}
 }
 if(value.format!=='euc-library-backup')throw new Error('Choose an EUC Library backup file.');if(new TextEncoder().encode(text).length>maxBytes)throw new Error('The expanded backup exceeds the import limit.');return value;
}
export const backupDate=(value:string)=>new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Ulaanbaatar',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
export const backupAge=(value:string)=>{const hours=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/3600000));return hours<1?'Less than an hour ago':hours<24?`${hours} ${hours===1?'hour':'hours'} ago`:`${Math.floor(hours/24)} days ago`;};
export const backupSize=(value:number)=>value<1048576?`${(value/1024).toFixed(1)} KB`:`${(value/1048576).toFixed(1)} MB`;
