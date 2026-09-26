export type SnapshotRow = Record<string, any>;

export interface SnapshotPayload {
  format: string;
  version: number;
  createdAt: string;
  tableManifest?: string[];
  tables: Record<string, SnapshotRow[]>;
  integrity?: { algorithm: string; checksum: string };
  schema?: {
    tables?: Record<string, { columns?: Array<{ name: string; columnType?: string; isNullable?: string; extra?: string }> }>;
    fingerprint?: string;
  };
  [key: string]: unknown;
}
