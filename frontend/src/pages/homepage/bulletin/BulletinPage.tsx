import { useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ChevronLeft, ChevronRight, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { PostCard, cardVariants } from "./components/PostCard";
import { PostModal } from "./components/PostModal";
import { CreatePostModal } from "./components/CreatePostModal";
import { BulletinSidebar } from "./components/BulletinSidebar";
import { useBulletinPosts } from "./hooks/useBulletinPosts";
import type { BulletinPost } from "./types";

const CAN_POST_ROLES = ["staff", "admin", "super_admin"];
const POSTS_PER_PAGE = 6;

export function BulletinPage() {
  const { user } = useAuth();
  const canPost  = CAN_POST_ROLES.includes(user?.role ?? "");

  const {
    posts, loading, error, currentPage, totalPages,
    fetchPosts, setCurrentPage, updatePost,
  } = useBulletinPosts({ limit: POSTS_PER_PAGE });

  const [selectedPost, setSelectedPost] = useState<BulletinPost | null>(null);
  const [showCreate, setShowCreate]     = useState(false);

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
    updatePost(postId, { is_pinned: pinned });
    setSelectedPost((prev) =>
      prev?.id === postId ? { ...prev, is_pinned: pinned } : prev
    );
  }, [updatePost]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-14">
        <div className="container">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
                Bulletin Board
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Library posts, announcements, and upcoming events.
              </p>
            </div>
            {canPost && (
              <Button
                size="sm"
                onClick={() => setShowCreate(true)}
                className="rounded-xl shrink-0"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New Post
              </Button>
            )}
          </div>

          {/* Policy notice */}
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
            <p className="text-xs text-primary/80">
              ⚠️ Please comment responsibly. All interactions are subject to school rules and policies.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-8 lg:flex-row">

            {/* Main */}
            <div className="flex-1 min-w-0">

              {loading && (
                <div className="flex items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading posts…</span>
                </div>
              )}

              {error && !loading && (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => fetchPosts(currentPage)}
                  >
                    Retry
                  </Button>
                </div>
              )}

              {!loading && !error && posts.length === 0 && (
                <div className="flex flex-col items-center py-20 text-muted-foreground">
                  <p className="text-sm">No posts yet.</p>
                  {canPost && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-4 rounded-xl"
                      onClick={() => setShowCreate(true)}
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> Create the first post
                    </Button>
                  )}
                </div>
              )}

              {!loading && !error && posts.length > 0 && (
                <>
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: {},
                      visible: { transition: { staggerChildren: 0.07 } },
                    }}
                    className="space-y-4"
                  >
                    {posts.map((post) => (
                      <motion.div key={post.id} variants={cardVariants}>
                        <PostCard
                          post={post}
                          variant="list"
                          onClick={() => setSelectedPost(post)}
                        />
                      </motion.div>
                    ))}
                  </motion.div>

                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <Button
                          key={i + 1}
                          variant={currentPage === i + 1 ? "default" : "outline"}
                          size="sm"
                          className="w-9 rounded-xl"
                          onClick={() => setCurrentPage(i + 1)}
                        >
                          {i + 1}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(currentPage + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
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
      />

      <CreatePostModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchPosts(1);
          setCurrentPage(1);
        }}
      />

      <Footer />
    </div>
  );
}