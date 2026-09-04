import type { ApiPost, BulletinPost } from "./types";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function toPost(raw: ApiPost): BulletinPost {
  return {
    id:            raw.id,
    title:         raw.title,
    date:          formatDate(raw.created_at),
    excerpt:       raw.excerpt,
    content:       raw.content,
    image_url:     raw.image_url,
    likes:         raw.likes,
    liked_by_me:   Boolean(raw.liked_by_me),
    comment_count: raw.comment_count,
    author_id:     raw.author_id,
    author_name:   raw.author_name,
    author_role:   raw.author_role,
    comments:      [],
    is_pinned:     Boolean(raw.is_pinned),
    post_type: raw.post_type ?? "announcement",
    event_starts_at: raw.event_starts_at,
    event_ends_at: raw.event_ends_at,
    event_location: raw.event_location,
    event_registration_url: raw.event_registration_url,
  };
}
