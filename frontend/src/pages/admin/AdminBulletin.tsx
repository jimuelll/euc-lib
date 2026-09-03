import { useEffect, useMemo, useState } from "react";
import { ArchiveRestore, CalendarRange, Newspaper, Pin, RefreshCw, Archive, FileText } from "lucide-react";
import axiosInstance from "@/utils/AxiosInstance";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  months?: string[];
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
  const [posts, setPosts] = useState<BulletinPostRecord[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadPosts = async (requestedPage = 1) => {
    setLoading(true);
    setError("");
    try {
      const response = await axiosInstance.get<BulletinResponse>("/api/bulletin", {
        params: {
          page: requestedPage,
          limit: 20,
          scope: statusFilter === "all" ? "all" : undefined,
          archived: statusFilter === "archived" ? true : undefined,
          month: selectedMonth === "all" ? undefined : selectedMonth,
        },
      });
      const result = response.data;
      if (requestedPage > 1 && result.totalPages > 0 && requestedPage > result.totalPages) {
        await loadPosts(result.totalPages);
        return;
      }
      setPosts(result.data ?? []);
      setTotalPosts(result.total ?? 0);
      setCurrentPage(result.page ?? requestedPage);
      setTotalPages(result.totalPages ?? 0);
      setAvailableMonths(result.months ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load bulletin posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts(1);
  }, [statusFilter, selectedMonth]);

  const monthOptions = useMemo(() => {
    const seen = new Map<string, string>();
    availableMonths.forEach((value) => {
      if (!seen.has(value)) {
        seen.set(value, MONTH_FORMATTER.format(new Date(`${value}-01T00:00:00`)));
      }
    });

    return Array.from(seen.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([value, label]) => ({ value, label }));
  }, [availableMonths]);

  const groupedPosts = useMemo(() => {
    const groups = new Map<string, { label: string; posts: BulletinPostRecord[] }>();

    posts.forEach((post) => {
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
  }, [posts]);

  const handlePinToggle = async (postId: number, nextPinned: boolean) => {
    setBusyId(postId);
    try {
      await axiosInstance.patch(`/api/bulletin/${postId}/pin`, { pinned: nextPinned });
      await loadPosts(currentPage);
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
      await loadPosts(currentPage);
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
          <Button type="button" variant="outline" onClick={() => void loadPosts(currentPage)} disabled={loading}>
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
        <AdminStatCard label="Matching posts" value={loading ? "-" : String(totalPosts)} icon={<Newspaper className="h-4 w-4" />} />
        <AdminStatCard label="Current page" value={loading ? "-" : `${currentPage} / ${Math.max(1, totalPages)}`} icon={<Pin className="h-4 w-4" />} />
        <AdminStatCard label="View" value={STATUS_FILTERS.find((item) => item.value === statusFilter)?.label ?? "All posts"} icon={<ArchiveRestore className="h-4 w-4" />} />
        <AdminStatCard label="Month Groups" value={loading ? "-" : String(monthOptions.length)} icon={<CalendarRange className="h-4 w-4" />} />
      </AdminStatGrid>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <AdminPanel
        title="Post register"
        description="All bulletin posts are grouped by their publish month and year, with status toggles and image previews where available."
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
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-44 w-full rounded-md" />)}
              </div>
            ) : null}
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
                        <div className={`grid gap-0 ${post.image_url ? "md:grid-cols-[220px_1fr]" : "grid-cols-1"}`}>
                          {post.image_url ? (
                            <div className="relative min-h-[180px] border-b border-border bg-muted/30 md:border-b-0 md:border-r">
                              <img
                                src={post.image_url}
                                alt={post.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : null}

                          <div className="space-y-4 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  {!post.image_url ? (
                                    <span className="inline-flex items-center gap-1 border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                                      <FileText className="h-3 w-3" /> Text-only
                                    </span>
                                  ) : null}
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

            {!loading && totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages} · {totalPosts} posts</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => void loadPosts(currentPage - 1)}>Previous</Button>
                  <Button type="button" variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => void loadPosts(currentPage + 1)}>Next</Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </AdminPanel>

      <CreatePostModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          void loadPosts(1);
        }}
      />
    </AdminPage>
  );
};

export default AdminBulletin;
