import type { RowDataPacket } from "mysql2/promise";

export interface BulletinUser {
  id: number;
  role: string;
}

export interface BulletinPostRow extends RowDataPacket {
  id: number;
  title: string;
  content: string;
  image_url: string | null;
  image_public_id?: string | null;
  post_type: string;
  event_starts_at: Date | string | null;
  event_ends_at: Date | string | null;
  event_location: string | null;
  event_registration_url: string | null;
  is_pinned: boolean | number;
  created_at: Date | string;
  deleted_at?: Date | string | null;
  author_id: number;
  author_name?: string;
  author_role?: string;
  likes: number | string;
  comment_count?: number | string;
  liked_by_me: boolean | number;
}

export interface BulletinPostOwnerRow extends RowDataPacket {
  author_id: number;
  image_public_id: string | null;
}

export interface BulletinCommentRow extends RowDataPacket {
  id: number;
  text: string;
  created_at: Date | string;
  author?: string;
  author_id?: number;
  user_id?: number;
}

export interface BulletinCountRow extends RowDataPacket {
  total: number | string;
}

export interface BulletinMonthRow extends RowDataPacket {
  value: string;
}

export interface BulletinFilters {
  userId: number | null;
  page: number;
  limit: number;
  archiveScope: "active" | "archived" | "all";
  search: string;
  month: string;
  postType: string;
  upcomingOnly: boolean;
}

export interface CreateBulletinPostInput {
  title?: string | null;
  content?: string | null;
  image_url?: string | null;
  image_public_id?: string | null;
  is_pinned: boolean;
  post_type?: string;
  event_starts_at?: unknown;
  event_ends_at?: unknown;
  event_location?: string | null;
  event_registration_url?: string | null;
}

export interface CreatePostRepositoryInput {
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string | null;
  imagePublicId: string | null;
  authorId: number;
  pinned: boolean;
  postType: string;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  eventLocation: string | null;
  eventRegistrationUrl: string | null;
}

export interface ToggleLikeResult {
  liked: boolean;
  total: number | string;
}
