import axiosInstance from "@/utils/AxiosInstance";

export type QueryColumn = { key: string; label: string; type: "text" | "date" | "dateTime" };
export type QueryRow = Record<string, string | number | null>;
export type QueryDataset = "catalog" | "users" | "borrowings" | "reservations" | "attendance" | "notifications" | "subscriptions" | "clearance";
export type QueryFilters = Record<string, string | number | undefined> & { dataset: QueryDataset; page?: number; limit?: number };
export type QueryResult = { dataset: QueryDataset; label: string; columns: QueryColumn[]; rows: QueryRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number }; summary?: { overduePatrons: number; unpaidFinePatrons: number; overdueItems: number; outstandingAmount: number }; filters: Record<string, string> };
export type QueryMeta = { datasets: { value: QueryDataset; label: string; filters: string[] }[]; bookTypes: { id: number; name: string }[]; categories: { value: string }[]; programs: { id: number; name: string }[]; issuers: { id: number; name: string }[]; subscriptionCategories: { value: string }[]; roles: string[] };

const compact = (filters: QueryFilters) => Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== "" && value !== "all"));

export async function fetchQueryMeta() { return (await axiosInstance.get<QueryMeta>("/api/admin/query/meta")).data; }
export async function fetchQuery(filters: QueryFilters) { return (await axiosInstance.get<QueryResult>("/api/admin/query", { params: compact(filters) })).data; }
export async function fetchQueryPreview(filters: QueryFilters) { return (await axiosInstance.get<QueryResult>("/api/admin/query/export", { params: { ...compact(filters), format: "preview" } })).data; }
export async function downloadQueryCsv(filters: QueryFilters) {
  const response = await axiosInstance.get("/api/admin/query/export", { params: compact(filters), responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob); const link = document.createElement("a");
  link.href = url; link.download = `${filters.dataset}-query.csv`; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
