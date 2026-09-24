import axiosInstance from "@/utils/AxiosInstance";

export interface PublicCatalogBook {
  id: number; title: string; author?: string; isbn?: string; category?: string; edition?: string;
  publication_year?: number; copies?: number; registered_copies?: number; available?: number; material_type?: "book" | "thesis";
  canBorrow?: boolean; canReserve?: boolean; [key: string]: unknown;
}
export interface PublicCatalogSchemaField { key: string; label: string; type: string; order: number; locked?: boolean; public?: boolean; }
export interface PublicCatalogSearchResponse { rows: PublicCatalogBook[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export const fetchPublicCatalogSchema = async (): Promise<PublicCatalogSchemaField[]> => (await axiosInstance.get<PublicCatalogSchemaField[]>("/api/catalogue/schema")).data;
export const searchPublicCatalogue = async (query: string, page: number): Promise<PublicCatalogSearchResponse> => (await axiosInstance.get<PublicCatalogSearchResponse>("/api/catalogue/search", { params: { query: query.trim(), page, limit: 20 } })).data;
