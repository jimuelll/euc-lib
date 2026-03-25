import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, BookOpen } from "lucide-react";
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
    <section className="py-16 sm:py-24">
      <div className="container px-4 sm:px-6">

        {/* ── Section header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-end justify-between gap-4 mb-10 sm:mb-12"
        >
          <div>
            {/* Eyebrow — gold rule + label, like a cornerstone inscription */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-6 bg-warning" />
              <p
                className="text-[10px] font-bold uppercase tracking-[0.28em] text-warning"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Library Bulletin
              </p>
            </div>

            <h2
              className="text-2xl sm:text-3xl font-bold text-foreground leading-tight tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Latest Announcements
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-relaxed">
              Stay informed about library news, events, and updates.
            </p>
          </div>

          {/* View all — restrained, directional */}
          <Link
            to="/bulletin"
            className="hidden sm:flex shrink-0 items-center gap-2 border border-border px-4 py-2 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </Link>
        </motion.div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2.5 h-4 w-4 animate-spin text-primary" />
            <span
              className="text-[11px] tracking-[0.15em] uppercase"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Loading…
            </span>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center py-20 border border-border">
            <div className="flex h-12 w-12 items-center justify-center border border-border bg-muted/40 mb-5">
              <BookOpen className="h-5 w-5 text-muted-foreground/30" />
            </div>
            <p
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              No Announcements Yet
            </p>
            <p className="text-xs text-muted-foreground/55 mt-1.5">
              Check back soon for library news.
            </p>
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
            className="grid grid-cols-1 sm:grid-cols-2 border-l border-t border-border"
          >
            {posts.map((post) => (
              <motion.div
                key={post.id}
                variants={{
                  hidden:   { opacity: 0, y: 16 },
                  visible:  { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                }}
                className="border-r border-b border-border"
              >
                <PostCard
                  post={post}
                  variant="grid"
                  onClick={() => setSelected(post)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Mobile see-all ── */}
        {!loading && posts.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-6 sm:hidden"
          >
            <Link
              to="/bulletin"
              className="flex w-full items-center justify-center gap-2 border border-border py-3 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              See All Posts
              <ArrowRight className="h-3 w-3" />
            </Link>
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