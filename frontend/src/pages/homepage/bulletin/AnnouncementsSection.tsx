import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Newspaper } from "lucide-react";
import { PostCard } from "./components/PostCard";
import { PostModal } from "./components/PostModal";
import { useBulletinPosts } from "./hooks/useBulletinPosts";
import type { BulletinPost } from "./types";
import { ContentCardsSkeleton } from "@/components/ui/content-skeletons";

export function AnnouncementsSection() {
  const { posts, loading, updatePost } = useBulletinPosts({ limit: 3, type: "announcement" });
  const [selected, setSelected] = useState<BulletinPost | null>(null);

  return (
    <section aria-labelledby="bulletin-heading" className="min-w-0 overflow-hidden border-y border-border bg-card">
      <div className="flex items-end justify-between gap-4 border-b border-border px-5 py-5 sm:px-7 sm:py-6">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-warning" style={{ fontFamily: "var(--font-heading)" }}>
            <Newspaper className="h-3.5 w-3.5" aria-hidden="true" /> Bulletin board
          </div>
          <h2 id="bulletin-heading" className="text-[1.65rem] font-bold leading-[1.05] tracking-[-.04em] text-foreground sm:text-3xl">Latest from the Bulletin</h2>
        </div>
        <Link to="/bulletin" className="inline-flex min-h-11 shrink-0 items-center gap-2 border-b border-primary px-1 text-xs font-bold uppercase tracking-[.12em] text-primary transition-colors hover:border-warning hover:text-warning focus-visible:ring-2 focus-visible:ring-warning">
          <span className="hidden sm:inline">View all posts</span><span className="sm:hidden">All</span><ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {loading && <ContentCardsSkeleton cards={3} className="px-5 py-5 sm:px-7 md:grid-cols-3" />}
      {!loading && posts.length === 0 && (
        <div className="flex min-h-44 flex-col items-center justify-center gap-3 px-5 py-8 text-center sm:px-7"><BookOpen className="h-5 w-5 text-warning" aria-hidden="true" /><p className="font-medium text-foreground">No announcements yet.</p><p className="max-w-xs text-sm leading-relaxed text-muted-foreground">New library updates will appear here as they are published.</p></div>
      )}
      {!loading && posts.length > 0 && (
        <div className="grid w-full min-w-0 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {posts.map((post) => (
            <div key={post.id} className="min-w-0">
              <PostCard post={post} variant="homepage" onClick={() => setSelected(post)} />
            </div>
          ))}
        </div>
      )}

      <PostModal
        post={selected}
        onClose={() => setSelected(null)}
        onLikeToggle={(postId, liked, likes) => updatePost(postId, { liked_by_me: liked, likes })}
        onCommentAdded={(postId) => {
          const post = posts.find((item) => item.id === postId);
          if (post) updatePost(postId, { comment_count: post.comment_count + 1 });
        }}
      />
    </section>
  );
}
