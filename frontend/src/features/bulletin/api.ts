import axiosInstance from "@/utils/AxiosInstance";
import type { ApiComment, ApiPost, PostImage, ReactionKind, ReactionSummary, CommentSort } from "./types";

export interface BulletinPostRecord extends ApiPost { deleted_at?: string | null; }
export interface BulletinListResponse { data: BulletinPostRecord[]; total: number; page: number; totalPages: number; months?: string[]; }
export interface BulletinDetailResponse extends ApiPost { comments: ApiComment[]; }
export interface BulletinLikeResponse { liked: boolean; total: number; }
export interface BulletinLiker { id: number; name: string; role: string; created_at: string; }
export interface BulletinEvent { id: number; title: string; starts_at: string; ends_at?: string | null; }

export const fetchBulletinPosts = async (params: Record<string, unknown> = {}, signal?: AbortSignal): Promise<BulletinListResponse> =>
  (await axiosInstance.get<BulletinListResponse>("/api/bulletin", { params, signal })).data;
export const fetchBulletinPost = async (postId: number, signal?: AbortSignal): Promise<BulletinDetailResponse> =>
  (await axiosInstance.get<BulletinDetailResponse>(`/api/bulletin/${postId}`, { signal })).data;
export const toggleBulletinLike = async (postId: number): Promise<BulletinLikeResponse> =>
  (await axiosInstance.post<BulletinLikeResponse>(`/api/bulletin/${postId}/like`)).data;
export const setBulletinPinned = async (postId: number, pinned: boolean): Promise<void> => {
  await axiosInstance.patch(`/api/bulletin/${postId}/pin`, { pinned });
};
export const archiveBulletinPost = async (postId: number): Promise<void> => { await axiosInstance.delete(`/api/bulletin/${postId}`); };
export const restoreBulletinPost = async (postId: number): Promise<void> => { await axiosInstance.patch(`/api/bulletin/${postId}/restore`); };
export const createBulletinPost = async (payload: { title: string; content: string; is_pinned: boolean; image_url: string | null; image_public_id: string | null; image_alt?: string | null; gallery?:PostImage[]; notifyUsers?: {total:number;email:number;requestId:string} }) =>
  (await axiosInstance.post<{ id: number }>("/api/bulletin", payload)).data;
export const createBulletinComment = async (postId: number, text: string,parent_id?:number|null,client_request_id?:string): Promise<ApiComment> =>
  (await axiosInstance.post<ApiComment>(`/api/bulletin/${postId}/comments`, { text,parent_id,client_request_id })).data;
export const deleteBulletinComment = async (postId: number, commentId: number): Promise<void> => { await axiosInstance.delete(`/api/bulletin/${postId}/comments/${commentId}`); };
export const fetchBulletinLikers = async (postId: number, signal?: AbortSignal): Promise<BulletinLiker[]> =>
  (await axiosInstance.get<{ data?: BulletinLiker[] }>(`/api/bulletin/${postId}/likes`, { signal })).data.data ?? [];

export interface Page<T>{data:T[];page:number;hasMore:boolean;latest_id?:number;}
export interface PostContent {title:string;content:string;image_url:string|null;image_public_id:string|null;image_alt:string|null;gallery:PostImage[];}
export const editBulletinPost=async(id:number,payload:PostContent&{content_revision:number})=>(await axiosInstance.patch(`/api/bulletin/${id}`,payload)).data;
export const fetchPostComments=async(id:number,parentId:number|null,page:number,signal?:AbortSignal,sort:CommentSort='helpful')=>(await axiosInstance.get<Page<ApiComment>>(`/api/bulletin/${id}/comments`,{params:{parentId,page,sort},signal})).data;
export const setPostReaction=async(id:number,reaction:ReactionKind|null):Promise<ReactionSummary>=>(reaction?await axiosInstance.put<ReactionSummary>(`/api/bulletin/${id}/reaction`,{reaction}):await axiosInstance.delete<ReactionSummary>(`/api/bulletin/${id}/reaction`)).data;
export const fetchPostReactors=async(id:number,reaction:ReactionKind|'all',page:number,signal?:AbortSignal)=>(await axiosInstance.get<Page<BulletinLiker&{reaction:ReactionKind}>>(`/api/bulletin/${id}/reactions`,{params:{reaction,page},signal})).data;

export const reportBulletinComment=async(postId:number,commentId:number,input:{reason:string;details?:string}={reason:"other"}):Promise<void>=>{await axiosInstance.post(`/api/bulletin/${postId}/comments/${commentId}/report`,input);};

export const setCommentHelpful=async(postId:number,commentId:number,selected:boolean):Promise<{helpful_count:number;helpful_by_me:boolean}> => (selected?await axiosInstance.put(`/api/bulletin/${postId}/comments/${commentId}/helpful`):await axiosInstance.delete(`/api/bulletin/${postId}/comments/${commentId}/helpful`)).data;
export const moderateComment=async(postId:number,commentId:number,action:'hidden'|'pinned',value:boolean)=>{await axiosInstance.patch(`/api/bulletin/${postId}/comments/${commentId}/moderation`,{action,value});};
export const setDiscussionLocked=async(postId:number,locked:boolean)=>{await axiosInstance.patch(`/api/bulletin/${postId}/discussion`,{locked});};
export const fetchCommentContext=async(postId:number,commentId:number,signal?:AbortSignal):Promise<{comment:ApiComment;ancestors:ApiComment[]}> => (await axiosInstance.get(`/api/bulletin/${postId}/comments/${commentId}/context`,{signal})).data;
export const fetchDiscussionUpdates=async(postId:number,afterId:number,signal?:AbortSignal):Promise<{latest_id:number;newest_other_id:number;new_count:number;comment_count?:number;comments_locked:boolean}> => (await axiosInstance.get(`/api/bulletin/${postId}/discussion-updates`,{params:{afterId},signal})).data;

export const setPostHelpful=async(id:number,selected:boolean):Promise<ReactionSummary> => (selected?await axiosInstance.put(`/api/bulletin/${id}/helpful`):await axiosInstance.delete(`/api/bulletin/${id}/helpful`)).data;
export const setPostInterest=async(id:number,selected:boolean):Promise<ReactionSummary> => (selected?await axiosInstance.put(`/api/bulletin/${id}/interest`):await axiosInstance.delete(`/api/bulletin/${id}/interest`)).data;
export const setPostSaved=async(id:number,selected:boolean):Promise<{saved_by_me:boolean}> => (selected?await axiosInstance.put(`/api/bulletin/${id}/save`):await axiosInstance.delete(`/api/bulletin/${id}/save`)).data;
export interface SavedBulletinPost {id:number;title:string;excerpt:string;image_url?:string|null;image_alt?:string;post_type:string;created_at:string;saved_at:string;unavailable:boolean;}
export const fetchSavedBulletinPosts=async(page=1,signal?:AbortSignal):Promise<Page<SavedBulletinPost>> => (await axiosInstance.get('/api/bulletin/saved',{params:{page},signal})).data;

export const fetchCommentLikers=async(postId:number,commentId:number,page:number,signal?:AbortSignal):Promise<Page<BulletinLiker>>=>(await axiosInstance.get(`/api/bulletin/${postId}/comments/${commentId}/likes`,{params:{page},signal})).data;
export interface PrivateComment {id:number;text:string;created_at:string;moderation_status:'published'|'pending';moderation_reason:string|null;case_status:string|null;appealed_at:string|null;}
export const fetchMyCommentReviews=async(postId:number,page:number,signal?:AbortSignal):Promise<Page<PrivateComment>>=>(await axiosInstance.get(`/api/bulletin/${postId}/my-comments`,{params:{page},signal})).data;
export const requestCommentReview=async(postId:number,commentId:number,reason:string)=>axiosInstance.post(`/api/bulletin/${postId}/comments/${commentId}/reconsider`,{reason});

export interface CommentSnapshot {id:number;comment:ApiComment|null;}
export const fetchCommentSnapshots=async(postId:number,ids:number[],signal?:AbortSignal):Promise<CommentSnapshot[]>=>{
 const chunks:number[][]=[];for(let index=0;index<ids.length;index+=500)chunks.push(ids.slice(index,index+500));
 const pages=await Promise.all(chunks.map(async batch=>(await axiosInstance.post<{data:CommentSnapshot[]}>(`/api/bulletin/${postId}/comment-snapshots`,{ids:batch},{signal})).data.data));return pages.flat();
};
