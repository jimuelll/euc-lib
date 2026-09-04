import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { PostCard } from "./components/PostCard";
import { PostModal } from "./components/PostModal";
import { useBulletinPosts } from "./hooks/useBulletinPosts";
import type { BulletinPost } from "./types";
import { ContentCardsSkeleton } from "@/components/ui/content-skeletons";

export function AnnouncementsSection() {
  const { posts, loading, updatePost } = useBulletinPosts({ limit: 3, type: "announcement" });
  const [selected, setSelected] = useState<BulletinPost | null>(null);

  return (
    <section className="border border-border bg-card px-6 py-7 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="mb-3 block h-px w-7 bg-warning" />
          <h2 className="text-2xl font-bold leading-none tracking-[-.045em] text-foreground">Latest from the Bulletin</h2>
        </div>
        <Link to="/bulletin" className="inline-flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary hover:text-warning">
          View All <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading && <ContentCardsSkeleton cards={3} className="mt-5 md:grid-cols-3" />}
      {!loading && posts.length === 0 && (
        <div className="mt-5 flex min-h-36 items-center justify-center border border-border text-center text-sm text-muted-foreground"><BookOpen className="mr-3 h-4 w-4 text-warning" />No announcements yet.</div>
      )}
      {!loading && posts.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {posts.map((post) => <PostCard key={post.id} post={post} variant="grid" onClick={() => setSelected(post)} />)}
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
