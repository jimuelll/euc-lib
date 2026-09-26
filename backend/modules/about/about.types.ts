import type { RowDataPacket } from "mysql2/promise";

export interface AboutSettingsInput {
  library_name?: string | null;
  established?: string | number | null;
  mission_title?: string | null;
  mission_text?: string | null;
  history_title?: string | null;
  history_text?: string | null;
  policies?: unknown;
  facilities?: unknown;
  staff?: unknown;
  spaces?: unknown;
}

export interface AboutSettings {
  library_name: string;
  established: number | null;
  mission_title: string;
  mission_text: string | null;
  history_title: string;
  history_text: string | null;
  policies: unknown;
  facilities: unknown;
  staff: unknown;
  spaces: unknown;
}

export interface AboutSettingsRow extends RowDataPacket {
  library_name: string;
  established: number | null;
  mission_title: string;
  mission_text: string | null;
  history_title: string;
  history_text: string | null;
  policies: unknown;
  facilities: unknown;
  staff: unknown;
  spaces: unknown;
}

export interface AboutSettingsWrite {
  library_name: string;
  established: string | number | null;
  mission_title: string;
  mission_text: string | null;
  history_title: string;
  history_text: string | null;
  policies: string;
  facilities: string;
  staff: string;
  spaces: string;
}
