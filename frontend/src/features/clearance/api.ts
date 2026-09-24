import axiosInstance from "@/utils/AxiosInstance";

export type FineRow = { id: number; book_title: string; status: "borrowed" | "overdue" | "returned"; is_archived?: boolean; copy_barcode?: string | null; fine_amount: number; settled_amount: number; unsettled_amount: number };
export type ClearanceProfile = { user: { name: string; student_employee_id: string; program_course?: string | null }; status: "blocked" | "eligible"; reasons: string[]; overdueItems: { id: number; title: string }[]; fineRows: FineRow[]; outstandingAmount: number; reservations: { id: number; status: string; book_title: string }[]; transactions: { id: number; receipt_number: string | null; transaction_type: string; amount: number; reason: string | null; created_at: string; corrected: number }[] };
export type ClearanceUserSuggestion = { student_employee_id: string; name: string; role: string };
export type QueueEntry = { userId: number; name: string; studentEmployeeId: string; overdueCount: number; oldestDueDate: string | null; overdueTitles: string[]; outstandingAmount: number; fineRecords: number };
export type QueueResponse = { rows: QueueEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
export type PaymentRow = { id: number; user_id: number; user_name: string; student_employee_id: string; book_title: string; copy_barcode: string | null; due_date: string | null; returned_at: string | null; status: "borrowed" | "overdue" | "returned"; fine_amount: number; settled_amount: number; unsettled_amount: number; hours_overdue: number };
export type PaymentOverviewResponse = { rows: PaymentRow[]; summary: { total_records: number; affected_users: number; total_unsettled_amount: number }; pagination?: { page: number; limit: number; total: number; totalPages: number } };
export type UserPaymentOverviewResponse = PaymentOverviewResponse & { user: { id: number; name: string; role: string; student_employee_id: string; is_active: number } };

export const fetchClearanceQueue = async (page = 1): Promise<QueueResponse> => (await axiosInstance.get<QueueResponse>("/api/admin/clearance/queue", { params: { page, limit: 25 } })).data;
export const searchClearanceUsers = async (query: string): Promise<ClearanceUserSuggestion[]> => (await axiosInstance.get<ClearanceUserSuggestion[]>("/api/admin/users", { params: { student_employee_id: query, name: query } })).data;
export const fetchClearanceProfile = async (studentId: string): Promise<ClearanceProfile> => (await axiosInstance.get<ClearanceProfile>("/api/admin/clearance/profile", { params: { student_employee_id: studentId } })).data;
export const recordClearancePayment = async (studentId: string): Promise<{ receiptNumber: string }> => (await axiosInstance.post<{ receiptNumber: string }>("/api/admin/clearance/payment", { student_employee_id: studentId })).data;
export const adjustClearanceFine = async (borrowingId: number, amount: number, reason: string): Promise<void> => { await axiosInstance.post(`/api/admin/clearance/borrowings/${borrowingId}/adjust`, { amount, reason }); };
export const reverseClearanceTransaction = async (transactionId: number, reason: string): Promise<void> => { await axiosInstance.post(`/api/admin/clearance/transactions/${transactionId}/reverse`, { reason }); };
export const fetchPaymentOverview = async (page: number): Promise<PaymentOverviewResponse> => (await axiosInstance.get<PaymentOverviewResponse>("/api/borrowing/admin/payments", { params: { page, limit: 20 } })).data;
export const fetchUserPaymentOverview = async (studentId: string): Promise<UserPaymentOverviewResponse> => (await axiosInstance.get<UserPaymentOverviewResponse>("/api/borrowing/admin/payments/user", { params: { student_employee_id: studentId } })).data;
export const settleUserPayment = async (studentId: string, amount: number): Promise<{ message?: string }> => (await axiosInstance.post<{ message?: string }>("/api/borrowing/admin/payments/settle", { student_employee_id: studentId, amount })).data;
export const fetchClearanceReceipt = async (receiptNumber: string): Promise<any> => (await axiosInstance.get(`/api/admin/clearance/receipts/${encodeURIComponent(receiptNumber)}`)).data;
