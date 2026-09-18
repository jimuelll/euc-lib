import axiosInstance from "@/utils/AxiosInstance";
import type { AttendanceType } from "./types";

export class AttendanceScanError extends Error {
  code?: string;
  user?: { name: string; student_employee_id: string };
  type?: AttendanceType;
  constructor(message: string, options?: { code?: string; user?: { name: string; student_employee_id: string }; type?: AttendanceType }) {
    super(message); this.name = "AttendanceScanError"; this.code = options?.code; this.user = options?.user; this.type = options?.type;
  }
}
export const postAttendanceScan = async (scannedId: string, type: AttendanceType): Promise<{ user: { name: string; student_employee_id: string }; type: AttendanceType }> => {
  try { return (await axiosInstance.post("/api/attendance/scan", { scannedId, type })).data; }
  catch (err: any) { throw new AttendanceScanError(err.response?.data?.message || err.message || "An unexpected error occurred", { code: err.response?.data?.code, user: err.response?.data?.user, type: err.response?.data?.type }); }
};
