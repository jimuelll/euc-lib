import { useEffect, useMemo, useState } from "react";
import { ArchiveRestore, CalendarRange, Newspaper, Pin, RefreshCw, Archive, Image as ImageIcon } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { Button } from "@/components/ui/button";
import { AdminPage, AdminPanel, AdminStatCard, AdminStatGrid } from "./components/AdminPage";
import { CreatePostModal } from "../homepage/bulletin";

interface BulletinPostRecord {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  image_url?: string | null;
  is_pinned: boolean | number;
  created_at: string;
  deleted_at?: string | null;
  author_name: string;
  author_role: string;
  likes: number;
  comment_count: number;
}

interface BulletinResponse {
  data: BulletinPostRecord[];
  total: number;
  page: number;
  totalPages: number;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const STATUS_FILTERS = [
  { value: "all", label: "All posts" },
  { value: "active", label: "Published" },
  { value: "archived", label: "Archived" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

const AdminBulletin = () => {
  const [activePosts, setActivePosts] = useState<BulletinPostRecord[]>([]);
  const [archivedPosts, setArchivedPosts] = useState<BulletinPostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadPosts = async () => {
    setLoading(true);
    setError("");
    try {
      const [activeRes, archivedRes] = await Promise.all([
        axiosInstance.get<BulletinResponse>("/api/bulletin", {
          params: { page: 1, limit: 200 },
        }),
        axiosInstance.get<BulletinResponse>("/api/bulletin", {
          params: { page: 1, limit: 200, archived: true },
        }),
      ]);

      setActivePosts(activeRes.data.data ?? []);
      setArchivedPosts(archivedRes.data.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load bulletin posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const allPosts = useMemo(() => {
    return [...activePosts, ...archivedPosts].sort((a, b) => {
      if (Boolean(b.is_pinned) !== Boolean(a.is_pinned)) {
        return Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [activePosts, archivedPosts]);

  const monthOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allPosts.forEach((post) => {
      const key = post.created_at.slice(0, 7);
      if (!seen.has(key)) {
        seen.set(key, MONTH_FORMATTER.format(new Date(post.created_at)));
      }
    });

    return Array.from(seen.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([value, label]) => ({ value, label }));
  }, [allPosts]);

  const filteredPosts = useMemo(() => {
    return allPosts.filter((post) => {
      if (statusFilter === "active" && post.deleted_at) return false;
      if (statusFilter === "archived" && !post.deleted_at) return false;
      if (selectedMonth !== "all" && !post.created_at.startsWith(selectedMonth)) return false;
      return true;
    });
  }, [allPosts, selectedMonth, statusFilter]);

  const groupedPosts = useMemo(() => {
    const groups = new Map<string, { label: string; posts: BulletinPostRecord[] }>();

    filteredPosts.forEach((post) => {
      const key = post.created_at.slice(0, 7);
      if (!groups.has(key)) {
        groups.set(key, {
          label: MONTH_FORMATTER.format(new Date(post.created_at)),
          posts: [],
        });
      }
      groups.get(key)?.posts.push(post);
    });

    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([, value]) => value);
  }, [filteredPosts]);

  const handlePinToggle = async (postId: number, nextPinned: boolean) => {
    setBusyId(postId);
    try {
      await axiosInstance.patch(`/api/bulletin/${postId}/pin`, { pinned: nextPinned });
      await loadPosts();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to update pin status");
    } finally {
      setBusyId(null);
    }
  };

  const handleArchiveToggle = async (post: BulletinPostRecord) => {
    setBusyId(post.id);
    try {
      if (post.deleted_at) {
        await axiosInstance.patch(`/api/bulletin/${post.id}/restore`);
      } else {
        await axiosInstance.delete(`/api/bulletin/${post.id}`);
      }
      await loadPosts();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to update archive status");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminPage
      eyebrow="Content Management"
      title="Bulletin Posts"
      description="Review bulletin posts by month and year, pin live announcements, and toggle archive status without leaving the page."
      contentWidth="wide"
      actions={(
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={loadPosts} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button type="button" onClick={() => setShowCreate(true)}>
            <Newspaper className="mr-2 h-4 w-4" />
            New post
          </Button>
        </div>
      )}
    >
      <AdminStatGrid>
        <AdminStatCard label="Total Posts" value={loading ? "-" : String(allPosts.length)} icon={<Newspaper className="h-4 w-4" />} />
        <AdminStatCard label="Published" value={loading ? "-" : String(activePosts.length)} icon={<Pin className="h-4 w-4" />} />
        <AdminStatCard label="Archived" value={loading ? "-" : String(archivedPosts.length)} icon={<ArchiveRestore className="h-4 w-4" />} />
        <AdminStatCard label="Month Groups" value={loading ? "-" : String(monthOptions.length)} icon={<CalendarRange className="h-4 w-4" />} />
      </AdminStatGrid>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <AdminPanel
        title="Post register"
        description="All bulletin posts are grouped by their publish month and year, with status toggles and image previews available in each entry."
      >
        <div className="grid gap-4 xl:grid-cols-[240px_1fr]">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Status
              </p>
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    statusFilter === filter.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Month and year
              </p>
              <button
                type="button"
                onClick={() => setSelectedMonth("all")}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selectedMonth === "all"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                All months
              </button>
              {monthOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedMonth(option.value)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    selectedMonth === option.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {!loading && groupedPosts.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
                No bulletin posts match the current filters.
              </div>
            ) : null}

            {groupedPosts.map((group) => (
              <section key={group.label} className="space-y-4">
                <div className="flex items-center gap-3 border-b border-border pb-3">
                  <div className="h-px w-6 bg-primary/40" />
                  <p className="text-sm font-semibold text-foreground">{group.label}</p>
                </div>

                <div className="space-y-4">
                  {group.posts.map((post) => {
                    const isBusy = busyId === post.id;
                    const isArchived = Boolean(post.deleted_at);

                    return (
                      <article key={post.id} className="overflow-hidden rounded-md border border-border bg-background">
                        <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                          <div className="relative min-h-[180px] border-b border-border bg-muted/30 md:border-b-0 md:border-r">
                            {post.image_url ? (
                              <img
                                src={post.image_url}
                                alt={post.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full min-h-[180px] items-center justify-center text-muted-foreground/50">
                                <ImageIcon className="h-8 w-8" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-4 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex items-center border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                                    isArchived
                                      ? "border-border bg-muted/20 text-muted-foreground"
                                      : "border-primary/30 bg-primary/5 text-primary"
                                  }`}>
                                    {isArchived ? "Archived" : "Published"}
                                  </span>
                                  {Boolean(post.is_pinned) && !isArchived ? (
                                    <span className="inline-flex items-center border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-warning">
                                      Pinned
                                    </span>
                                  ) : null}
                                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                    {post.author_name} - {post.author_role.replace("_", " ")}
                                  </span>
                                </div>
                                <p className="text-base font-semibold text-foreground">{post.title}</p>
                                <p className="text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {!isArchived ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => handlePinToggle(post.id, !Boolean(post.is_pinned))}
                                  >
                                    <Pin className="mr-2 h-4 w-4" />
                                    {Boolean(post.is_pinned) ? "Unpin" : "Pin"}
                                  </Button>
                                ) : null}

                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={isBusy}
                                  onClick={() => handleArchiveToggle(post)}
                                >
                                  {isArchived ? (
                                    <ArchiveRestore className="mr-2 h-4 w-4" />
                                  ) : (
                                    <Archive className="mr-2 h-4 w-4" />
                                  )}
                                  {isArchived ? "Restore" : "Archive"}
                                </Button>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                              <span>
                                Published {DATE_TIME_FORMATTER.format(new Date(post.created_at))}
                              </span>
                              {isArchived && post.deleted_at ? (
                                <span>
                                  Archived {DATE_TIME_FORMATTER.format(new Date(post.deleted_at))}
                                </span>
                              ) : null}
                              <span>{post.likes} likes</span>
                              <span>{post.comment_count} comments</span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </AdminPanel>

      <CreatePostModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          loadPosts();
        }}
      />
    </AdminPage>
  );
};

export default AdminBulletin;
