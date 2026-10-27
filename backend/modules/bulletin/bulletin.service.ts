import repository = require("./bulletin.repository");
import * as social from "./bulletin.social.repository";
import {normalizePostContent,validateImageDescriptions} from "./bulletin.content";
import {publishWithNotice} from "../notifications/publication-notification.service";
import type {
  BulletinFilters,
  BulletinPostRow,
  BulletinUser,
  CreateBulletinPostInput,
  ToggleLikeResult,
} from "./bulletin.types";

const CAN_POST_ROLES = ["staff", "admin", "super_admin"];
const ADMIN_ROLES = ["admin", "super_admin"];

const getPosts = async (
  userId: number | null,
  page = 1,
  limit = 4,
  archiveScope: BulletinFilters["archiveScope"] = "active",
  search = "",
  month = "",
  postType = "all",
  upcomingOnly = false,
) => repository.getPosts({ userId, page, limit, archiveScope, search, month, postType, upcomingOnly });

const getPostById = async (postId: number, userId: number | null) => {
  const post: BulletinPostRow | null = await repository.findPost(postId, userId);
  if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });
  const discussion=await social.comments(postId,null,1,userId);
  return { ...post, ...(await social.postReactionSummary(postId,userId)), comments:discussion.data,comments_has_more:discussion.hasMore };
};

const createPost = async (author: BulletinUser, {
  title,
  content,
  notifyUsers,
  image_url,
  image_public_id,
  image_alt,
  gallery,
  is_pinned,
  post_type,
  event_starts_at,
  event_ends_at,
  event_location,
  event_registration_url,
}: CreateBulletinPostInput) => {
  if (!CAN_POST_ROLES.includes(author.role) || (is_pinned && !ADMIN_ROLES.includes(author.role))) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  if (typeof title!=='string'||typeof content!=='string'||!title.trim()||!content.trim()) {
    throw Object.assign(new Error("title and content are required"), { status: 400 });
  }
  const normalized=normalizePostContent({title,content,image_url,image_public_id,image_alt,gallery});
  validateImageDescriptions(normalized);
  const postType: string = "announcement";
  const sqlDate = (value: unknown): string | null => value ? String(value).replace("T", " ") : null;
  if(notifyUsers && !ADMIN_ROLES.includes(author.role)) throw Object.assign(new Error("Forbidden"),{status:403});
  const record = {
    title: title.trim(),
    excerpt: content.trim().replace(/\s+/g, " ").slice(0, 500),
    content: content.trim(),
    imageUrl: normalized.image_url,
    imagePublicId: normalized.image_public_id,
    imageAlt: normalized.image_alt,
    gallery:normalized.gallery,
    authorId: author.id,
    pinned: is_pinned,
    postType,
    eventStartsAt: postType === "event" ? sqlDate(event_starts_at) : null,
    eventEndsAt: postType === "event" ? sqlDate(event_ends_at) : null,
    eventLocation: postType === "event" ? (event_location?.trim() || null) : null,
    eventRegistrationUrl: postType === "event" ? (event_registration_url?.trim() || null) : null,
  };
  if(notifyUsers)return publishWithNotice("bulletin",author.id,notifyUsers,record.title,record.excerpt,{url:record.imageUrl,publicId:record.imagePublicId,alt:record.imageAlt},async conn=>(await repository.createPost(record,conn)).id);
  return repository.createPost(record);
};

const deletePost = async (postId: number, requestingUser: BulletinUser): Promise<void> => {
  const post = await repository.findPostForDelete(postId);
  if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });
  const isOwner = post.author_id === requestingUser.id;
  const isAdmin = ["admin", "super_admin"].includes(requestingUser.role);
  if (!isOwner && !isAdmin) throw Object.assign(new Error("Forbidden"), { status: 403 });
  await repository.archivePost(postId, requestingUser.id);
  // Archived content and retained snapshots must keep their media restorable.
};

const restorePost = async (postId: number, requestingUser: BulletinUser): Promise<{ message: string }> => {
  const post = await repository.findPostForDelete(postId, true);
  if (!post) throw Object.assign(new Error("Archived post not found"), { status: 404 });
  const isOwner = post.author_id === requestingUser.id;
  const isAdmin = ["admin", "super_admin"].includes(requestingUser.role);
  if (!isOwner && !isAdmin) throw Object.assign(new Error("Forbidden"), { status: 403 });
  await repository.restorePost(postId);
  return { message: "Post restored successfully" };
};

const pinPost = async (postId: number, pinned: boolean, requestingUser: BulletinUser): Promise<{ pinned: boolean }> => {
  if (!await repository.getPostForPin(postId)) throw Object.assign(new Error("Post not found"), { status: 404 });
  if (!ADMIN_ROLES.includes(requestingUser.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  await repository.pinPost(postId, pinned);
  return { pinned };
};

const toggleLike = async (postId:number,userId:number):Promise<ToggleLikeResult>=>{const result=await social.setReaction(postId,userId,'like',true);return {liked:result.liked_by_me,total:result.likes};};
const getLikes = async (postId:number) => {const result=await social.readers(postId,'like',1);return {data:result.data};};
const addComment = async (postId:number,userId:number,text:string,parentId?:unknown,requestId?:string) => {
 const parent=parentId==null?null:Number(parentId);if(parent!==null&&(!Number.isSafeInteger(parent)||parent<1))throw Object.assign(new Error('Invalid parent comment'),{status:400});
 return social.addReply(postId,userId,text,parent,requestId);
};
const deleteComment = async (commentId:number,actor:BulletinUser,postId?:number) => {
 if(postId===undefined){const comment=await repository.findComment(commentId);if(!comment)throw Object.assign(new Error('Comment not found'),{status:404});postId=Number(comment.post_id);}
 if(!Number.isSafeInteger(postId)||postId<1)throw Object.assign(new Error('Invalid post ID'),{status:400});
 return social.removeComment(postId,commentId,actor);
};

export = {
  CAN_POST_ROLES,
  getPosts,
  getPostById,
  createPost,
  deletePost,
  restorePost,
  pinPost,
  toggleLike,
  getLikes,
  addComment,
  deleteComment,
};
