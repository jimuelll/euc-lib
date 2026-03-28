export type ScanMode = "idle" | "scanning" | "processing" | "success" | "error";
export type AttendanceType = "check_in" | "check_out";

export interface AttendanceResult {
  type: AttendanceType;
  userName: string;
  studentId: string;
  timestamp: Date;
}