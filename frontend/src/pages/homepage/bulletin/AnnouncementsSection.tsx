import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { PostCard } from "./components/PostCard";
import { PostModal } from "./components/PostModal";
import { useBulletinPosts } from "./hooks/useBulletinPosts";
import type { BulletinPost } from "./types";

export function AnnouncementsSection() {
  const { posts, loading, updatePost } = useBulletinPosts({ limit: 4 });
  const [selected, setSelected] = useState<BulletinPost | null>(null);

  const handleLikeToggle = (postId: number, liked: boolean, total: number) => {
    updatePost(postId, { liked_by_me: liked, likes: total });
  };

  const handleCommentAdded = (postId: number) => {
    const post = posts.find((p) => p.id === postId);
    if (post) updatePost(postId, { comment_count: post.comment_count + 1 });
  };

  return (
    <section className="py-14 sm:py-20">
      <div className="container px-4 sm:px-6">

        {/* ── Section header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-end justify-between gap-4 mb-8 sm:mb-10"
        >
          <div>
            {/* Eyebrow label */}
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-500 mb-2">
              Library Bulletin
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              Latest Announcements
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
              Stay informed about library news, events, and updates.
            </p>
          </div>

          <Link to="/bulletin" className="shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="group gap-1.5 text-amber-700 hover:text-amber-800 hover:bg-amber-700/8 dark:text-amber-400 dark:hover:bg-amber-400/10 rounded-xl font-medium"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </motion.div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2.5 h-5 w-5 animate-spin" />
            <span className="text-sm">Loading announcements…</span>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-4">
              <BookOpen className="h-7 w-7 opacity-30" />
            </div>
            <p className="text-sm font-medium">No announcements yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Check back soon for library news.</p>
          </div>
        )}

        {/* ── Posts grid ── */}
        {!loading && posts.length > 0 && (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-24px" }}
            variants={{
              hidden:  {},
              visible: { transition: { staggerChildren: 0.07 } },
            }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5"
          >
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                variant="grid"
                onClick={() => setSelected(post)}
              />
            ))}
          </motion.div>
        )}

        {/* ── Divider + see more (mobile) ── */}
        {!loading && posts.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex items-center gap-4 sm:hidden"
          >
            <div className="h-px flex-1 bg-border/50" />
            <Link to="/bulletin">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-medium border-border/60"
              >
                See all posts
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
            <div className="h-px flex-1 bg-border/50" />
          </motion.div>
        )}

      </div>

      <PostModal
        post={selected}
        onClose={() => setSelected(null)}
        onLikeToggle={handleLikeToggle}
        onCommentAdded={handleCommentAdded}
      />
    </section>
  );
}