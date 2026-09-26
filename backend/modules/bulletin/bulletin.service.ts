import repository = require("./bulletin.repository");
import type {
  BulletinFilters,
  BulletinPostRow,
  BulletinUser,
  CreateBulletinPostInput,
  ToggleLikeResult,
} from "./bulletin.types";

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CAN_POST_ROLES = ["staff", "admin", "super_admin"];

const destroyCloudinaryImage = async (publicId: string | null | undefined): Promise<void> => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("[bulletin] Cloudinary destroy failed for", publicId, err);
  }
};

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
  return { ...post, comments: await repository.findComments(postId) };
};

const createPost = async (authorId: number, {
  title,
  content,
  image_url,
  image_public_id,
  is_pinned,
  post_type,
  event_starts_at,
  event_ends_at,
  event_location,
  event_registration_url,
}: CreateBulletinPostInput) => {
  if (!title?.trim() || !content?.trim()) {
    throw Object.assign(new Error("title and content are required"), { status: 400 });
  }
  const postType: string = "announcement";
  const sqlDate = (value: unknown): string | null => value ? String(value).replace("T", " ") : null;
  return repository.createPost({
    title: title.trim(),
    excerpt: content.trim().replace(/\s+/g, " ").slice(0, 500),
    content: content.trim(),
    imageUrl: image_url?.trim() ?? null,
    imagePublicId: image_public_id?.trim() ?? null,
    authorId,
    pinned: is_pinned,
    postType,
    eventStartsAt: postType === "event" ? sqlDate(event_starts_at) : null,
    eventEndsAt: postType === "event" ? sqlDate(event_ends_at) : null,
    eventLocation: postType === "event" ? (event_location?.trim() || null) : null,
    eventRegistrationUrl: postType === "event" ? (event_registration_url?.trim() || null) : null,
  });
};

const deletePost = async (postId: number, requestingUser: BulletinUser): Promise<void> => {
  const post = await repository.findPostForDelete(postId);
  if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });
  const isOwner = post.author_id === requestingUser.id;
  const isAdmin = ["admin", "super_admin"].includes(requestingUser.role);
  if (!isOwner && !isAdmin) throw Object.assign(new Error("Forbidden"), { status: 403 });
  await repository.archivePost(postId, requestingUser.id);
  await destroyCloudinaryImage(post.image_public_id);
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
  if (!CAN_POST_ROLES.includes(requestingUser.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  await repository.pinPost(postId, pinned);
  return { pinned };
};

const toggleLike = (postId: number, userId: number): Promise<ToggleLikeResult> => repository.toggleLike(postId, userId);

const getLikes = async (postId: number) => {
  const likes = await repository.getLikes(postId);
  if (!likes) throw Object.assign(new Error("Post not found"), { status: 404 });
  return { data: likes };
};

const addComment = async (postId: number, userId: number, text: string) => {
  if (!text?.trim()) throw Object.assign(new Error("Comment text is required"), { status: 400 });
  if (text.trim().length > 1000) throw Object.assign(new Error("Comment must be 1000 characters or fewer"), { status: 400 });
  return repository.addComment(postId, userId, text.trim());
};

const deleteComment = async (commentId: number, requestingUser: BulletinUser): Promise<void> => {
  const comment = await repository.findComment(commentId);
  if (!comment) throw Object.assign(new Error("Comment not found"), { status: 404 });
  const isOwner = comment.user_id === requestingUser.id;
  const isAdmin = ["admin", "super_admin"].includes(requestingUser.role);
  if (!isOwner && !isAdmin) throw Object.assign(new Error("Forbidden"), { status: 403 });
  await repository.deleteComment(commentId, requestingUser.id);
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
