import axiosInstance from '@/utils/AxiosInstance';
export type Snapshot={id:number;filename:string;sizeBytes:number;kind:'manual'|'scheduled'|'pre_restore';createdAt:string;createdBy:string|null;label?:string;notes?:string;pinned?:boolean;checksum?:string;version?:number;verification?:'verified'|'unverified'|'failed';verifiedAt?:string;restoreEventId?:number;restoreOccurredAt?:string};
export type Sessions={users:number;staff:number;patrons:number;sessions:number};
export type Compatibility={compatible:boolean;version?:number;sourceVersion?:number;currentVersion?:number;createdAt?:string;message:string;checksum?:string;verification?:string;checkedAt?:string;safetyLabel?:string;impact?:Array<{table:string;added:number;changed:number;restored:number}>;activeSessions?:Sessions};
export type RestoreResult={message:string;preRestoreSnapshot:Snapshot&{restoreAuditId?:number;auditEventId?:number;reversedEventCount?:number}};
export type BackupStatus={mode:'normal'|'restoring';maxImportBytes?:number;snapshotVersion?:number;activeSessions?:Sessions;progress?:{phase:string;source?:string;result?:Snapshot};storage?:{provider:string;region:string|null;encryptionAtRest:boolean|null};schedule?:{enabled:boolean;nextRun:string|null;frequency?:string;hour?:number;weekday?:number;lastResult?:string;lastError?:string|null};retention?:number;noticeRecipients?:number};
export type BackupDownload={blob:Blob;contentDisposition?:string};
export const fetchBackupSnapshots=async(signal?:AbortSignal):Promise<Snapshot[]> =>(await axiosInstance.get('/api/admin/backup/snapshots',{signal})).data.snapshots??[];
export const fetchBackupStatus=async(signal?:AbortSignal):Promise<BackupStatus> =>(await axiosInstance.get('/api/admin/backup/status',{signal})).data;
export const downloadBackup=async():Promise<BackupDownload> =>{const response=await axiosInstance.get('/api/admin/backup/export',{responseType:'blob'});return {blob:response.data,contentDisposition:response.headers['content-disposition']};};
export const createBackupSnapshot=async(details:{label?:string;notes?:string}={}):Promise<Snapshot> =>(await axiosInstance.post('/api/admin/backup/snapshots',details)).data.snapshot;
export const downloadBackupSnapshot=async(id:number):Promise<BackupDownload> =>{const response=await axiosInstance.get(`/api/admin/backup/snapshots/${id}/download`,{responseType:'blob'});return {blob:response.data,contentDisposition:response.headers['content-disposition']};};
const credentials=(password:string,word:string)=>({headers:{'x-restore-confirmation':'global-sign-out','x-restore-password':password,'x-restore-word':word}});
export const restoreBackupSnapshot=async(id:number,password:string,word:string):Promise<RestoreResult> =>(await axiosInstance.post(`/api/admin/backup/snapshots/${id}/restore`,{},credentials(password,word))).data;
export const restoreBackup=async(backup:unknown,password:string,word:string):Promise<RestoreResult> =>(await axiosInstance.post('/api/admin/backup/restore',backup,credentials(password,word))).data;
export const checkBackupCompatibility=async(backup:unknown):Promise<Compatibility> =>(await axiosInstance.post('/api/admin/backup/compatibility',backup)).data;
export const fetchSnapshotCompatibility=async(id:number,signal?:AbortSignal):Promise<Compatibility> =>(await axiosInstance.get(`/api/admin/backup/snapshots/${id}/compatibility`,{signal})).data;
export const previewRestore=async(source:{id?:number;backup?:unknown}):Promise<Compatibility> =>(await axiosInstance.post(source.id?`/api/admin/backup/snapshots/${source.id}/preview`:'/api/admin/backup/preview',source.backup??{})).data;
export const verifySnapshot=async(id:number):Promise<Compatibility> =>(await axiosInstance.post(`/api/admin/backup/snapshots/${id}/verify`)).data;
export const updateSnapshot=async(id:number,details:{label?:string;notes?:string;pinned?:boolean})=>axiosInstance.patch(`/api/admin/backup/snapshots/${id}`,details);
export const deleteSnapshot=async(id:number)=>axiosInstance.delete(`/api/admin/backup/snapshots/${id}`);

export const saveSchedule=async(details:{enabled:boolean;frequency:string;hour:number;weekday:number})=>(await axiosInstance.put('/api/admin/backup/schedule',details)).data;

export const sendRestoreNotice=async(confirmedRecipientCount:number):Promise<{message:string;recipientCount:number;sentAt?:string}> =>(await axiosInstance.post('/api/admin/backup/notice',{confirmedRecipientCount})).data;
