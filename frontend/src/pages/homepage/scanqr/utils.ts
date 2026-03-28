import axiosInstance from "@/utils/AxiosInstance";
import type { AttendanceType } from "./types";

/** How long to show the success screen before auto-resetting (ms) */
export const AUTO_RESET_DELAY = 5000;

export const postAttendanceScan = async (
  scannedId: string,
  type: AttendanceType
): Promise<{ user: { name: string; student_employee_id: string }; type: AttendanceType }> => {
  const res = await axiosInstance.post("/api/attendance/scan", { scannedId, type });
  return res.data;
};