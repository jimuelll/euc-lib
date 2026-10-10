// @vitest-environment node
import {it,expect} from 'vitest';
import {gzipSync} from 'node:zlib';
import {File} from 'node:buffer';
import {encryptBackup,readBackup} from './backup.files';
it('encrypted backup files round-trip and reject wrong passwords or altered data',async()=>{
 const payload={format:'euc-library-backup',version:17,tables:{users:[{id:1}]}};
 const protectedBlob=await encryptBackup(new Blob([gzipSync(JSON.stringify(payload))]),'a-long-backup-secret');
 const file=new File([await protectedBlob.text()],'backup.encrypted.json') as unknown as globalThis.File;
 expect(await readBackup(file,1024*1024,'a-long-backup-secret')).toEqual(payload);
 await expect(readBackup(file,1024*1024,'the-wrong-password')).rejects.toThrow(/incorrect or.*damaged/);
 const tampered=JSON.parse(await protectedBlob.text());tampered.data=(tampered.data[0]==='A'?'B':'A')+tampered.data.slice(1);
 await expect(readBackup(new File([JSON.stringify(tampered)],'backup.encrypted.json') as unknown as globalThis.File,1024*1024,'a-long-backup-secret')).rejects.toThrow(/incorrect or.*damaged/);
});
it('rejects unknown files and expansion above the configured import limit',async()=>{
 await expect(readBackup(new File(['{}'],'file.json') as unknown as globalThis.File,1024)).rejects.toThrow('EUC Library');
 const zip=new File([gzipSync(' '.repeat(2048))],'backup.gz') as unknown as globalThis.File;
 await expect(readBackup(zip,1024)).rejects.toThrow('expanded backup exceeds');
});
