import axiosInstance from "@/utils/AxiosInstance";
import type { ApiComment, ApiPost } from "./types";

export interface BulletinPostRecord extends ApiPost { deleted_at?: string | null; }
export interface BulletinListResponse { data: BulletinPostRecord[]; total: number; page: number; totalPages: number; months?: string[]; }
export interface BulletinDetailResponse { comments: ApiComment[]; }
export interface BulletinLikeResponse { liked: boolean; total: number; }
export interface BulletinLiker { id: number; name: string; role: string; created_at: string; }
export interface BulletinEvent { id: number; title: string; starts_at: string; ends_at?: string | null; }

export const fetchBulletinPosts = async (params: Record<string, unknown> = {}): Promise<BulletinListResponse> =>
  (await axiosInstance.get<BulletinListResponse>("/api/bulletin", { params })).data;
export const fetchBulletinPost = async (postId: number): Promise<BulletinDetailResponse> =>
  (await axiosInstance.get<BulletinDetailResponse>(`/api/bulletin/${postId}`)).data;
export const toggleBulletinLike = async (postId: number): Promise<BulletinLikeResponse> =>
  (await axiosInstance.post<BulletinLikeResponse>(`/api/bulletin/${postId}/like`)).data;
export const setBulletinPinned = async (postId: number, pinned: boolean): Promise<void> => {
  await axiosInstance.patch(`/api/bulletin/${postId}/pin`, { pinned });
};
export const archiveBulletinPost = async (postId: number): Promise<void> => { await axiosInstance.delete(`/api/bulletin/${postId}`); };
export const restoreBulletinPost = async (postId: number): Promise<void> => { await axiosInstance.patch(`/api/bulletin/${postId}/restore`); };
export const createBulletinPost = async (payload: { title: string; content: string; is_pinned: boolean; image_url: string | null; image_public_id: string | null }) =>
  (await axiosInstance.post<{ id: number }>("/api/bulletin", payload)).data;
export const createBulletinComment = async (postId: number, text: string): Promise<ApiComment> =>
  (await axiosInstance.post<ApiComment>(`/api/bulletin/${postId}/comments`, { text })).data;
export const deleteBulletinComment = async (postId: number, commentId: number): Promise<void> => { await axiosInstance.delete(`/api/bulletin/${postId}/comments/${commentId}`); };
export const fetchBulletinLikers = async (postId: number): Promise<BulletinLiker[]> =>
  (await axiosInstance.get<{ data?: BulletinLiker[] }>(`/api/bulletin/${postId}/likes`)).data.data ?? [];
