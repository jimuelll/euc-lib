import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ChevronLeft, ChevronRight, Plus, Lock, Search, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostCard, cardVariants } from "./components/PostCard";
import { PostModal } from "./components/PostModal";
import { CreatePostModal } from "./components/CreatePostModal";
import { BulletinSidebar } from "./components/BulletinSidebar";
import { useBulletinPosts } from "./hooks/useBulletinPosts";
import type { BulletinPost } from "./types";
import { ContentCardsSkeleton } from "@/components/ui/content-skeletons";

const CAN_POST_ROLES = ["staff", "admin", "super_admin"];
const POSTS_PER_PAGE = 6;

const getPageItems = (currentPage: number, totalPages: number): Array<number | "start-gap" | "end-gap"> => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const ordered = Array.from(pages).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items: Array<number | "start-gap" | "end-gap"> = [];
  ordered.forEach((page, index) => {
    const previous = ordered[index - 1];
    if (previous && page - previous > 1) items.push(page === totalPages ? "end-gap" : "start-gap");
    items.push(page);
  });
  return items;
};

const SectionLabel = ({ children, light = false }: { children: React.ReactNode; light?: boolean }) => (
  <div className="flex items-center gap-3">
    <div className={`h-px w-6 shrink-0 ${light ? "bg-warning" : "bg-warning"}`} />
    <span
      className={`text-[10px] font-bold uppercase tracking-[0.28em] ${light ? "text-warning" : "text-warning"}`}
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </span>
  </div>
);

export function BulletinPage() {
  const { user } = useAuth();
  const canPost = CAN_POST_ROLES.includes(user?.role ?? "");

  const {
    posts,
    loading,
    error,
    currentPage,
    totalPages,
    search,
    setSearch,
    fetchPosts,
    setCurrentPage,
    updatePost,
    setPinnedPost,
    removePost,
  } = useBulletinPosts({ limit: POSTS_PER_PAGE });

  const [selectedPost, setSelectedPost] = useState<BulletinPost | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setCurrentPage(1);
    fetchPosts(1, debouncedSearch);
  }, [debouncedSearch, fetchPosts, setCurrentPage]);

  const handleLikeToggle = useCallback((postId: number, liked: boolean, total: number) => {
    updatePost(postId, { liked_by_me: liked, likes: total });
    setSelectedPost((prev) =>
      prev?.id === postId ? { ...prev, liked_by_me: liked, likes: total } : prev
    );
  }, [updatePost]);

  const handleCommentAdded = useCallback((postId: number) => {
    updatePost(postId, {
      comment_count: (posts.find((p) => p.id === postId)?.comment_count ?? 0) + 1,
    });
  }, [updatePost, posts]);

  const handlePinToggle = useCallback((postId: number, pinned: boolean) => {
    setPinnedPost(postId, pinned);
    setSelectedPost((prev) =>
      prev?.id === postId ? { ...prev, is_pinned: pinned } : prev
    );
  }, [setPinnedPost]);

  const handleArchived = useCallback((postId: number) => {
    removePost(postId);
    setSelectedPost((prev) => (prev?.id === postId ? null : prev));
  }, [removePost]);

  const openLoginPrompt = useCallback(() => {
    setShowLoginPrompt(true);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="bg-primary relative overflow-hidden border-b border-warning/70">
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
        <div className="relative z-10 h-[2px] w-full bg-warning" />
        <div className="absolute inset-x-0 bottom-0 z-10 h-px bg-black/30" />

        <div className="container relative z-20 px-5 py-11 sm:px-8 sm:py-14 lg:px-12 xl:px-16">
          <SectionLabel light>Enverga-Candelaria Library</SectionLabel>

          <div className="mt-5 flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h1
                className="text-4xl sm:text-5xl font-bold tracking-[-.055em] leading-[.92] text-primary-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Bulletin Board
              </h1>
              <p className="mt-3 text-sm text-primary-foreground/50 max-w-lg leading-relaxed">
                Library announcements, notices, and upcoming events.
              </p>
            </div>

            {canPost && (
              <button
                onClick={() => setShowCreate(true)}
                className="shrink-0 flex items-center gap-2.5 px-5 py-2.5 border border-warning/50 text-warning hover:bg-warning/10 transition-colors duration-150"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em]">New Post</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="bg-background">
        <div className="container px-5 py-10 sm:px-8 sm:py-12 lg:px-12 xl:px-16">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <div className="flex-1 min-w-0">
              <div className="mb-5 flex flex-col gap-4 border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl">
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Search Posts
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Search by title, excerpt, post content, or author name.
                  </p>
                </div>

                <div className="relative w-full sm:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search bulletin posts"
                    className="h-11 border-border pl-10 text-sm focus-visible:ring-warning"
                  />
                </div>
              </div>

              {loading && (
                <div className="border border-border p-4"><ContentCardsSkeleton cards={6} className="md:grid-cols-2 xl:grid-cols-2" /></div>
              )}

              {error && !loading && (
                <div className="flex flex-col items-center gap-5 py-16 border border-destructive/20 bg-destructive/[0.02]">
                  <div className="flex gap-0">
                    <div className="w-[3px] bg-destructive shrink-0" />
                    <p
                      className="px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] text-destructive"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {error}
                    </p>
                  </div>
                  <button
                    onClick={() => fetchPosts(currentPage, debouncedSearch)}
                    className="px-5 py-2.5 border border-border text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && posts.length === 0 && (
                <div className="flex flex-col items-center py-20 border border-dashed border-border gap-5">
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {search.trim() ? "No matching posts" : "No posts yet"}
                  </p>
                  {canPost && !search.trim() && (
                    <button
                      onClick={() => setShowCreate(true)}
                      className="flex items-center gap-2 px-5 py-2.5 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
                        Create the first post
                      </span>
                    </button>
                  )}
                </div>
              )}

              {!loading && !error && posts.length > 0 && (
                <>
                  <div className="flex items-center justify-between pb-4 mb-0 border-b border-border">
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {posts.length} post{posts.length !== 1 ? "s" : ""} - Page {currentPage} of {totalPages}
                    </span>
                  </div>

                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: {},
                      visible: { transition: { staggerChildren: 0.06 } },
                    }}
                    className="border-x border-border"
                  >
                    {posts.map((post) => (
                      <motion.div key={post.id} variants={cardVariants}>
                        <PostCard
                          post={post}
                          variant="list"
                          onClick={() => setSelectedPost(post)}
                          onArchived={handleArchived}
                        />
                      </motion.div>
                    ))}
                  </motion.div>

                  {totalPages > 1 && (
                    <div className="flex border border-border">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                        className="h-10 w-10 flex items-center justify-center border-r border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>

                      <div className="flex flex-1 overflow-x-auto">
                        {getPageItems(currentPage, totalPages).map((item) => typeof item === "number" ? (
                          <button
                            key={item}
                            onClick={() => setCurrentPage(item)}
                            className={`h-10 min-w-[2.5rem] flex-1 flex items-center justify-center border-r border-border text-[11px] font-bold tracking-[0.1em] transition-colors ${
                              currentPage === item
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            {item}
                          </button>
                        ) : <span key={item} className="flex h-10 min-w-[2.5rem] items-center justify-center border-r border-border text-xs text-muted-foreground">…</span>)}
                      </div>

                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(currentPage + 1)}
                        className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <BulletinSidebar />
          </div>
        </div>
      </main>

      <PostModal
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onLikeToggle={handleLikeToggle}
        onCommentAdded={handleCommentAdded}
        onPinToggle={handlePinToggle}
        onRequireLogin={openLoginPrompt}
        onArchived={handleArchived}
      />

      <CreatePostModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchPosts(1, debouncedSearch);
          setCurrentPage(1);
        }}
      />

      <Dialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt}>
        <DialogContent className="max-w-md overflow-hidden border-border p-0 gap-0">
          <div className="bg-primary relative overflow-hidden px-5 py-5">
            <div className="absolute inset-x-0 top-0 h-[3px] bg-warning" />
            <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
              }}
            />
            <div className="relative z-10 flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 text-warning" />
              <DialogHeader className="text-left">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Requires Login
                </p>
                <DialogTitle
                  className="pt-2 text-lg font-bold text-primary-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Sign in to interact with posts
                </DialogTitle>
                <DialogDescription className="text-sm text-primary-foreground/65">
                  Likes and comments are available after you log in to your library account.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              You can still browse public bulletin posts, but reacting and joining the discussion needs an authenticated session.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowLoginPrompt(false)}
                className="border border-border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Maybe later
              </button>
              <Link
                to="/login"
                onClick={() => setShowLoginPrompt(false)}
                className="inline-flex items-center justify-center gap-2 bg-primary px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Login now
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
