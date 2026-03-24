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
    author_name:   raw.author_name,
    author_role:   raw.author_role,
    comments:      [],
    is_pinned:     Boolean(raw.is_pinned),
  };
}