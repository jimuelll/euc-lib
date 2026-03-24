// ── Public-facing post shape ───────────────────────────────────────────────────

export interface BulletinPost {
  id: number;
  title: string;
  date: string;
  excerpt: string;
  content: string;
  image_url?: string;
  likes: number;
  liked_by_me: boolean;
  comment_count: number;
  author_name: string;
  author_role: string;
  is_pinned: boolean; 
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
  excerpt: string;
  content: string;
  image_url?: string;
  is_pinned: number;
  created_at: string;
  author_name: string;
  author_role: string;
  likes: number;
  liked_by_me: number; // 0 | 1
  comment_count: number;
}

export interface ApiComment {
  id: number;
  author: string;
  author_id: number;
  text: string;
  created_at: string;
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export interface UpcomingEvent {
  title: string;
  date: string;
  time: string;
}