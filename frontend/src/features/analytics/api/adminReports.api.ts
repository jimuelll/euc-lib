import axiosInstance from "@/utils/AxiosInstance";

export type ClearanceQueueEntry = {
  userId: number;
  name: string;
  studentEmployeeId: string;
  overdueCount: number;
  oldestDueDate: string | null;
  overdueTitles: string[];
  outstandingAmount: number;
  fineRecords: number;
};

export type ClearanceQueueResponse = {
  rows: ClearanceQueueEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export async function fetchClearanceQueue(page: number, limit = 25): Promise<ClearanceQueueResponse> {
  return (await axiosInstance.get<ClearanceQueueResponse>("/api/admin/clearance/queue", { params: { page, limit } })).data;
}
