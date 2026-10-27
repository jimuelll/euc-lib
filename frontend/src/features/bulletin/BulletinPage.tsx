import { useState, useCallback, useEffect } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { ChevronLeft, ChevronRight, Plus, Lock, Search, ArrowRight } from "@/components/ui/library-glyphs";
import { useAuth } from "@/context/AuthContext";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchBulletinPost } from "./api";
import { toPost } from "./utils";
import { PostCard } from "./components/PostCard";
import { PostModal } from "./components/PostModal";
import { CreatePostModal } from "./components/CreatePostModal";
import { BulletinSidebar } from "./components/BulletinSidebar";
import { useBulletinPosts } from "./hooks/useBulletinPosts";
import type { BulletinPost } from "./types";
import { BulletinListSkeleton } from "@/components/ui/content-skeletons";
import "./bulletin-board.css";

const CAN_POST_ROLES = ["staff", "admin", "super_admin"];
const POSTS_PER_PAGE = 10;

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

  const [params,setParams]=useSearchParams();
  const location=useLocation();
  useEffect(()=>{if(!loading&&location.hash==="#upcoming-events")document.getElementById("upcoming-events")?.scrollIntoView?.();},[loading,location.hash]);
  const [linkedError,setLinkedError]=useState(false);
  const [selectedPost, setSelectedPost] = useState<BulletinPost | null>(null);
  const linkedPost=params.get("post");
  useEffect(()=>{if(!linkedPost)return;let active=true;setLinkedError(false);if(!/^[1-9][0-9]*$/.test(linkedPost)){setLinkedError(true);return;}fetchBulletinPost(Number(linkedPost)).then(post=>{if(active)setSelectedPost(toPost(post));}).catch(()=>{if(active)setLinkedError(true);});return()=>{active=false;};},[linkedPost]);
  const [showCreate, setShowCreate] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

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

  const featuredPost = !debouncedSearch.trim() && currentPage === 1
    ? posts.find((post) => post.is_pinned)
    : undefined;
  const notices = posts.filter((post) => post.id !== featuredPost?.id);
  const monthGroups = notices.reduce<Record<string, BulletinPost[]>>((groups, post) => {
    const date = new Date(post.date);
    const month = Number.isNaN(date.getTime()) ? "More notices" : date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    (groups[month] ??= []).push(post);
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main data-library-design className="bulletin-board">
        <div className="bulletin-container">
          <header className="bulletin-page-heading">
            <div>
              <h1>Bulletin Board</h1>
              <p>Library announcements, notices, and upcoming events.</p>
            </div>
            <div className="bulletin-toolbar">
              <label className="bulletin-search">
                <Search aria-hidden="true" />
                <span className="sr-only">Search title, content or author</span>
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, content or author" />
              </label>
              {canPost && <button type="button" className="bulletin-new-post" onClick={() => setShowCreate(true)}><Plus aria-hidden="true" />New post</button>}
            </div>
          </header>
          {linkedError&&<div className="bulletin-empty" role="alert">This bulletin post is unavailable or has been archived.</div>}
          <div className="bulletin-wall" aria-busy={loading}>
            {loading && <BulletinListSkeleton rows={POSTS_PER_PAGE} />}
            {error && !loading && <div className="bulletin-empty" role="alert"><p>{error}</p><button className="bulletin-outline-button" onClick={() => void fetchPosts(currentPage, debouncedSearch)}>Retry</button></div>}
            {!loading && !error && <>
              {!debouncedSearch.trim() && <div className={`bulletin-hero ${featuredPost ? "" : "without-feature"}`}>
                {featuredPost && <PostCard post={featuredPost} variant="notice-featured" onClick={() => setSelectedPost(featuredPost)} onArchived={handleArchived} />}
                <BulletinSidebar />
              </div>}
              {posts.length === 0 && <div className="bulletin-empty">
                <p>{search.trim() ? `No posts match “${search.trim()}”. Try a title, a word from the post, or an author name.` : "No posts yet. Library updates will appear here as they are published."}</p>
                {canPost && !search.trim() && <button className="bulletin-outline-button" onClick={() => setShowCreate(true)}><Plus aria-hidden="true" />Create the first post</button>}
              </div>}
              {debouncedSearch.trim() ? <section aria-label="Search results">
                {posts.length > 0 && <h2 className="bulletin-month">Search results <small>for “{debouncedSearch.trim()}”</small></h2>}
                <div className="bulletin-columns">{notices.map((post) => <PostCard key={post.id} post={post} variant="notice" onClick={() => setSelectedPost(post)} onArchived={handleArchived} />)}</div>
              </section> : Object.entries(monthGroups).map(([month, groupedPosts]) => <section key={month} aria-label={month}>
                <h2 className="bulletin-month">{month}<small>{groupedPosts.length} notice{groupedPosts.length === 1 ? "" : "s"}</small></h2>
                <div className="bulletin-columns">{groupedPosts.map((post) => <PostCard key={post.id} post={post} variant="notice" onClick={() => setSelectedPost(post)} onArchived={handleArchived} />)}</div>
              </section>)}
              {totalPages > 1 && <nav className="bulletin-pagination" aria-label="Bulletin pages">
                <button aria-label="Previous page" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></button>
                {getPageItems(currentPage, totalPages).map((item) => typeof item === "number" ? <button key={item} aria-label={`Page ${item}`} aria-current={currentPage === item ? "page" : undefined} onClick={() => setCurrentPage(item)}>{item}</button> : <span key={item}>…</span>)}
                <button aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></button>
              </nav>}
            </>}
          </div>
        </div>
      </main>

      <PostModal
        post={selectedPost}
        onClose={() => {setSelectedPost(null);if(linkedPost)setParams(previous=>{const next=new URLSearchParams(previous);next.delete("post");return next;});}}
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
                  className="text-xs font-bold uppercase tracking-[0.28em] text-warning"
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
                className="border border-border px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Maybe later
              </button>
              <Link
                to="/login"
                onClick={() => setShowLoginPrompt(false)}
                className="inline-flex items-center justify-center gap-2 bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
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
