import axiosInstance from "@/utils/AxiosInstance";

export type Snapshot = { id: number; filename: string; sizeBytes: number; kind: "manual" | "pre_restore"; createdAt: string; createdBy: string | null };
export type Compatibility = { compatible: boolean; version?: number; message: string };
export type BackupStatus = { mode: "normal" | "restoring"; maxImportBytes?: number };
export type BackupDownload = { blob: Blob; contentDisposition?: string };

export const fetchBackupSnapshots = async (): Promise<Snapshot[]> => (await axiosInstance.get<{ snapshots?: Snapshot[] }>("/api/admin/backup/snapshots")).data.snapshots ?? [];
export const fetchBackupStatus = async (): Promise<BackupStatus> => (await axiosInstance.get<BackupStatus>("/api/admin/backup/status")).data;
export const downloadBackup = async (): Promise<BackupDownload> => { const response = await axiosInstance.get<Blob>("/api/admin/backup/export", { responseType: "blob" }); return { blob: response.data, contentDisposition: response.headers["content-disposition"] }; };
export const createBackupSnapshot = async (): Promise<void> => { await axiosInstance.post("/api/admin/backup/snapshots"); };
export const downloadBackupSnapshot = async (snapshotId: number): Promise<BackupDownload> => { const response = await axiosInstance.get<Blob>(`/api/admin/backup/snapshots/${snapshotId}/download`, { responseType: "blob" }); return { blob: response.data, contentDisposition: response.headers["content-disposition"] }; };
export const restoreBackupSnapshot = async (snapshotId: number): Promise<void> => { await axiosInstance.post(`/api/admin/backup/snapshots/${snapshotId}/restore`, {}, { headers: { "x-restore-confirmation": "global-sign-out" } }); };
export const checkBackupCompatibility = async (backup: unknown): Promise<Compatibility> => (await axiosInstance.post<Compatibility>("/api/admin/backup/compatibility", backup)).data;
export const restoreBackup = async (backup: unknown): Promise<void> => { await axiosInstance.post("/api/admin/backup/restore", backup, { headers: { "x-restore-confirmation": "global-sign-out" } }); };
export const fetchSnapshotCompatibility = async (snapshotId: number): Promise<Compatibility> => (await axiosInstance.get<Compatibility>(`/api/admin/backup/snapshots/${snapshotId}/compatibility`)).data;
