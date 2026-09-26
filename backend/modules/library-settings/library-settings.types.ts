import type { RowDataPacket } from "mysql2/promise";

export type RecordStatus = "active" | "archived" | "all";

export interface SettingsRecord extends RowDataPacket {
  overdue_fine_per_hour: number | string;
  updated_at: Date | string | null;
}

export interface HolidayRecord extends RowDataPacket {
  id: number;
  name: string;
  holiday_date: Date | string;
  description: string | null;
  is_active: number | boolean;
  created_at?: Date | string;
  updated_at?: Date | string;
  usage_count?: number | string | null;
  usage_note?: string;
}

export interface HolidayInput {
  name: string;
  holidayDate: string;
  description?: string | null;
}

export interface ProgramRecord extends RowDataPacket {
  id: number;
  name: string;
  is_active: number | boolean;
  created_at?: Date | string;
  updated_at?: Date | string;
  user_reference_count?: number | string;
  holding_reference_count?: number | string;
}

export interface ProgramDeletion {
  action: "archived" | "deleted";
  program: ProgramRecord;
  user_reference_count: number;
  holding_reference_count: number;
  reference_count: number;
}

export interface DepartmentRecord extends RowDataPacket {
  id: number;
  name: string;
  is_active: number | boolean;
  created_at?: Date | string;
  updated_at?: Date | string;
  user_reference_count?: number | string;
}

export interface DepartmentDeletion {
  action: "archived" | "deleted";
  department: DepartmentRecord;
  user_reference_count: number;
  reference_count: number;
}

export interface AcademicTermInput {
  name: string;
  startsOn: string | Date;
  endsOn: string | Date;
  isCurrent?: boolean;
}

export interface AcademicTermRecord extends RowDataPacket {
  id: number;
  name: string;
  starts_on?: string | Date;
  ends_on?: string | Date;
  is_current: number | boolean;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface AcademicTermDeleteResult {
  term: AcademicTermRecord | null;
  usage: number;
  deleted?: boolean;
}

export interface ErrorWithCode extends Error {
  code?: string;
  status?: number;
  usage?: number;
}

export interface SnapshotRecord extends RowDataPacket {
  id: number;
  name?: string;
  is_active?: number | boolean;
  starts_on?: string | Date;
  ends_on?: string | Date;
  is_current?: number | boolean;
}
