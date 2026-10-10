import type { User } from "@/context/AuthContext";
import type { ContentPayload, ContentSection } from "../publishing.service";

export interface PreviewSnapshot {
  section: ContentSection;
  documents: Partial<Record<ContentSection, ContentPayload>>;
  user: User | null;
  role: string;
  token: string | null;
}

export const previewPaths: Record<ContentSection, string> = {
  homepage: "/", about: "/about", bulletin: "/bulletin", events: "/bulletin#upcoming-events",
  subscriptions: "/services/subscriptions", guide: "/admin/user-guide",
};

const records = (value?: ContentPayload): ContentPayload[] =>
  (value?.items ?? []).filter((item: ContentPayload) => !item.deleted)
    .map((item: ContentPayload, index: number) => ({ ...item, id: item.id ?? -(index + 1) }));
const ordered = (items: ContentPayload[]) => [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

// Match the public API shapes so the production pages own all rendering.
export function resolvePreviewData(snapshot: PreviewSnapshot, path: string, params: Record<string, unknown> = {}): unknown {
  const { documents, role } = snapshot;
  if (path === "/api/site-content" && documents.homepage) return documents.homepage;
  if (path === "/api/about" && documents.about) return documents.about;
  if (path === "/api/subscriptions" && documents.subscriptions)
    return { data: ordered(records(documents.subscriptions).filter(item => item.is_active)) };
  if (path === "/api/events" && documents.events)
    return records(documents.events).filter(item => new Date(item.ends_at || item.starts_at).getTime() >= Date.now())
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  if (path === "/api/user-guide" && documents.guide)
    return ordered(records(documents.guide).filter(item => item.is_published && item.audience_roles?.includes(role)));
  if (path === "/api/bulletin" && documents.bulletin) {
    const search = String(params.search ?? "").trim().toLowerCase();
    const items: ContentPayload[] = records(documents.bulletin).filter(item => !item.archived)
      .map((item): ContentPayload => ({ created_at: new Date().toISOString(), author_id: snapshot.user?.id ?? 0,
        author_name: snapshot.user?.name ?? "Library", author_role: snapshot.user?.role ?? "admin",
        likes: 0, liked_by_me: 0, comment_count: 0, ...item }))
      .filter(item => !search || `${item.title} ${item.content}`.toLowerCase().includes(search))
      .filter(item => !params.type || item.post_type === params.type)
      .filter(item => !params.upcoming || (item.post_type === "event" && new Date(item.event_ends_at || item.event_starts_at).getTime() >= Date.now()))
      .sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned))
        || (a.post_type === "event" && b.post_type === "event" ? new Date(a.event_starts_at).getTime() - new Date(b.event_starts_at).getTime() : a.post_type === "event" ? 1 : b.post_type === "event" ? -1 : 0)
        || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const page = Math.max(1, Number(params.page) || 1), limit = Math.max(1, Number(params.limit) || 6);
    return { data: items.slice((page - 1) * limit, page * limit), total: items.length, page, totalPages: Math.ceil(items.length / limit) };
  }
  if (/^\/api\/bulletin\/-\d+$/.test(path)) return { comments: [] };
  if (/^\/api\/bulletin\/-\d+\/likes$/.test(path)) return { data: [] };
  return undefined;
}
