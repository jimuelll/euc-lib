import axiosInstance from "@/utils/AxiosInstance";

export interface PublicCatalogBook {
  id: number; title: string; author?: string; isbn?: string; category?: string; edition?: string;
  publication_year?: number; copies?: number; registered_copies?: number; available?: number; material_type?: "book" | "thesis";
  image_url?: string | null;
  canBorrow?: boolean; canReserve?: boolean; [key: string]: unknown;
}
export interface PublicCatalogSchemaField { key: string; label: string; type: string; order: number; locked?: boolean; public?: boolean; }
export interface PublicCatalogFacets {
  format: { all: number; book: number; thesis: number };
  availability: { all: number; available: number; unavailable: number };
  subjects: { value: string; count: number }[];
}
export interface PublicCatalogSearchResponse {
  rows: PublicCatalogBook[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  facets: PublicCatalogFacets;
}
export const fetchPublicCatalogSchema = async (): Promise<PublicCatalogSchemaField[]> => (await axiosInstance.get<PublicCatalogSchemaField[]>("/api/catalogue/schema")).data;
export interface PublicCatalogSearchParams {
  query?: string; title?: string; author?: string; isbn?: string; format?: string;
  availability?: string; subject?: string; sort?: string; page?: number;
}
export const searchPublicCatalogue = async (params: PublicCatalogSearchParams): Promise<PublicCatalogSearchResponse> =>
  (await axiosInstance.get<PublicCatalogSearchResponse>("/api/catalogue/search", {
    params: { ...params, query: params.query?.trim() ?? "", page: params.page ?? 1, limit: 20 },
  })).data;
