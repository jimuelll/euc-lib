export type ScanMode = "idle" | "scanning" | "processing" | "success" | "notice" | "error";
export type AttendanceType = "check_in" | "check_out";

export interface AttendanceResult {
  type: AttendanceType;
  userName: string;
  studentId: string;
  timestamp: Date;
}

export interface AttendanceNotice {
  type: AttendanceType;
  userName: string;
  studentId: string;
  message: string;
}
