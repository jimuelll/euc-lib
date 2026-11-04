import axiosInstance from "@/utils/AxiosInstance";

export type QueryColumn = { key: string; label: string; type: "text" | "date" | "dateTime" | "number" };
export type QueryRow = Record<string, string | number | null>;
export type QueryDataset = "catalog" | "users" | "borrowings" | "reservations" | "attendance" | "notifications" | "subscriptions" | "clearance";
export type QueryReport = "fined" | "daily_users" | "date_due" | "top_users" | "daily_stats" | "resource_usage" | "holdings_inventory";
export type QueryFilters = Record<string, string | number | undefined> & { dataset: QueryDataset; page?: number; limit?: number };
export type QueryResult = { dataset: QueryDataset; label: string; columns: QueryColumn[]; rows: QueryRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number }; summary?: { overduePatrons: number; unpaidFinePatrons: number; overdueItems: number; outstandingAmount: number }; filters: Record<string, string> };
export type QueryMeta = { previousTerm?:{from:string;to:string;name:string}|null; datasets: { value: QueryDataset; label: string; filters: string[] }[]; bookTypes: { id: number; name: string }[]; categories: { value: string }[]; programs: { id: number; name: string }[]; issuers: { id: number; name: string }[]; subscriptionCategories: { value: string }[]; roles: string[] };

const compact = (filters: QueryFilters) => Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]).filter(([, value]) => value !== undefined && value !== "" && value !== "all"));

export async function fetchQueryMeta(signal?: AbortSignal) { return (await axiosInstance.get<QueryMeta>("/api/admin/query/meta", { signal })).data; }
export async function fetchQuery(filters: QueryFilters, signal?: AbortSignal) { return (await axiosInstance.get<QueryResult>("/api/admin/query", { params: compact(filters), signal })).data; }

export type ReportFilters = Record<string, string | number | undefined> & { report: QueryReport; page?: number; limit?: number };
export type ReportResult = Omit<QueryResult, "dataset"> & { report: QueryReport };
const compactReport = (filters: ReportFilters) => Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]).filter(([, value]) => value !== undefined && value !== "" && value !== "all"));
export async function fetchReport(filters: ReportFilters, signal?: AbortSignal) { return (await axiosInstance.get<ReportResult>("/api/admin/query/reports", { params: compactReport(filters), signal })).data; }
