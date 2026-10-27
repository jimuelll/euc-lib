export type ReactionKind='like'|'helpful'|'thanks'|'interested';
export interface PostImage {url:string;alt:string;public_id?:string;}
export interface ReactionSummary {helpful_count?:number;helpful_by_me?:boolean;saved_by_me?:boolean;interested_count?:number;interested_by_me?:boolean;reaction_counts:Record<ReactionKind,number>;reaction_total:number;my_reaction:ReactionKind|null;likes:number;liked_by_me:boolean;}
// ── Public-facing post shape ───────────────────────────────────────────────────

export interface BulletinPost {
  id: number;
  title: string;
  date: string;
  created_at?: string;
  content: string;
  image_url?: string;
  image_alt?:string;
  gallery?:PostImage[];
  image_public_id?:string|null;
  edited_at?:string|null;
  content_revision?:number;
  comments_locked?:boolean;
  reaction_counts?:Record<ReactionKind,number>;
  helpful_count?:number;
  helpful_by_me?:boolean;
  saved_by_me?:boolean;
  interested_count?:number;
  interested_by_me?:boolean;
  reaction_total?:number;
  my_reaction?:ReactionKind|null;
  likes: number;
  liked_by_me: boolean;
  comment_count: number;
  author_id: number;
  author_name: string;
  author_role: string;
  is_pinned: boolean;
  post_type: "announcement" | "event";
  event_starts_at?: string | null;
  event_ends_at?: string | null;
  event_location?: string | null;
  event_registration_url?: string | null;
  comments: BulletinComment[];
}

export interface BulletinComment {
  id: number;
  author: string;
  author_id: number;
  text: string;
  date: string;
}

// ── Raw API shape (MySQL row) ──────────────────────────────────────────────────

export interface ApiPost {
  id: number;
  title: string;
  content: string;
  image_url?: string;
  image_alt?:string;
  gallery?:string|PostImage[];
  image_public_id?:string|null;
  edited_at?:string|null;
  content_revision?:number;
  comments_locked?:boolean;
  reaction_counts?:Record<ReactionKind,number>;
  helpful_count?:number;
  helpful_by_me?:boolean;
  saved_by_me?:boolean;
  interested_count?:number;
  interested_by_me?:boolean;
  reaction_total?:number;
  my_reaction?:ReactionKind|null;
  is_pinned: number;
  created_at: string;
  author_id: number;
  author_name: string;
  author_role: string;
  likes: number;
  liked_by_me: number | boolean; // Legacy lists use 0/1; details use boolean.
  comment_count: number;
  post_type: "announcement" | "event";
  event_starts_at?: string | null;
  event_ends_at?: string | null;
  event_location?: string | null;
  event_registration_url?: string | null;
}

export type CommentSort='oldest'|'newest'|'helpful';
export interface ApiComment {
  moderation_status?: "published" | "pending";
  author_role?:string|null;
  hidden_at?:string|null;
  pinned_at?:string|null;
  helpful_count?:number;
  helpful_by_me?:boolean;
  client_request_id?:string|null;
  pending?:boolean;
  failed?:boolean;
  parent_id?:number|null;
  deleted_at?:string|null;
  reply_count?:number;
  id: number;
  author: string;
  author_id: number | null;
  text: string;
  created_at: string;
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export interface UpcomingEvent {
  id?: number;
  title: string;
  date: string;
  dateDay?: string;
  dateMonth?: string;
}
