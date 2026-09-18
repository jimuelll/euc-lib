import axiosInstance from "@/utils/AxiosInstance";
import type { Recommendation } from "./components/RecommendationStrip";

type RecommendationsResponse = { material_type: "book" | "thesis"; rows: Recommendation[] };

export async function fetchRecommendations({ materialType, seedBookId, personal, signal }: { materialType: "book" | "thesis"; seedBookId?: number | null; personal?: boolean; signal?: AbortSignal }) {
  return (await axiosInstance.get<RecommendationsResponse>(personal ? "/api/recommendations/me" : `/api/catalogue/books/${seedBookId}/recommendations`, { params: personal ? { materialType } : undefined, signal })).data;
}

export async function dismissRecommendation(bookId: number) {
  await axiosInstance.post(`/api/recommendations/${bookId}/dismiss`);
}
