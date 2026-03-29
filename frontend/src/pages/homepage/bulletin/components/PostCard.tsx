import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, BookOpen, Pin, Archive, Loader2 } from "lucide-react";
import { getInitials } from "../utils";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/utils/AxiosInstance";
import type { BulletinPost } from "../types";

interface PostCardProps {
  post: BulletinPost;
  onClick: () => void;
  variant?: "grid" | "list";
  /** Called after the post is successfully archived */
  onArchived?: (postId: number) => void;
}

export const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const ADMIN_ROLES = ["admin", "super_admin"];

export function PostCard({ post, onClick, variant = "grid", onArchived }: PostCardProps) {
  const isList = variant === "list";
  const { user } = useAuth();

  const canArchive =
    ADMIN_ROLES.includes(user?.role ?? "") || user?.id === post.author_id;

  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiveBusy, setArchiveBusy]       = useState(false);

  const handleArchiveClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // don't open modal
    if (archiveBusy) return;

    if (!archiveConfirm) {
      setArchiveConfirm(true);
      // Auto-reset the confirm state after 3 s if user doesn't act
      setTimeout(() => setArchiveConfirm(false), 3000);
      return;
    }

    setArchiveBusy(true);
    try {
      await axiosInstance.delete(`/api/bulletin/${post.id}`);
      onArchived?.(post.id);
    } catch { /* silent */ }
    finally { setArchiveBusy(false); setArchiveConfirm(false); }
  };

  return (
    <motion.div
      variants={cardVariants}
      className={`group relative flex w-full text-left bg-card border-b border-border transition-colors duration-150 hover:bg-secondary/40 ${
        isList ? "flex-row" : "flex-col"
      } ${post.is_pinned ? "border-l-[3px] border-l-warning" : ""}`}
    >
      {/* Clickable area — everything except the archive button */}
      <button
        onClick={onClick}
        className={`flex flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 ${
          isList ? "flex-row" : "flex-col"
        }`}
      >
        {/* Image panel */}
        <div
          className={`relative overflow-hidden bg-muted/50 shrink-0 ${
            isList ? "w-36 sm:w-48 md:w-56" : "w-full"
          }`}
          style={isList ? { minHeight: "140px" } : { aspectRatio: "16/9" }}
        >
          {post.image_url ? (
            <img
              src={post.image_url}
              alt={post.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center min-h-[140px]">
              <BookOpen className="h-6 w-6 text-muted-foreground/20" />
            </div>
          )}

          {post.is_pinned && (
            <div
              className="absolute top-0 left-0 flex items-center gap-1 bg-warning px-2 py-1"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <Pin className="h-2.5 w-2.5 text-foreground/80" />
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/80">
                Pinned
              </span>
            </div>
          )}
        </div>

        {/* Content panel */}
        <div className={`flex flex-1 flex-col min-w-0 ${isList ? "p-4 sm:p-5" : "p-4"}`}>
          {/* Author row */}
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center bg-primary text-primary-foreground text-[9px] font-bold"
              style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
            >
              {getInitials(post.author_name)}
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/70 truncate"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {post.author_name}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">{post.date}</span>
            </div>
          </div>

          {/* Title */}
          <p
            className={`font-bold leading-snug text-foreground group-hover:text-primary transition-colors ${
              isList ? "text-sm sm:text-base" : "text-sm"
            }`}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {post.title}
          </p>

          {isList && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {post.excerpt}
            </p>
          )}

          {/* Footer — stats */}
          <div className="mt-auto pt-3 border-t border-border/50 flex items-center gap-4">
            <span
              className={`flex items-center gap-1.5 text-[11px] font-bold transition-colors ${
                post.liked_by_me ? "text-primary" : "text-muted-foreground"
              }`}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span
                className={`inline-block w-[5px] h-[5px] shrink-0 transition-colors ${
                  post.liked_by_me ? "bg-warning" : "bg-border"
                }`}
              />
              {post.likes}
            </span>

            <span
              className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <MessageCircle className="h-3 w-3" />
              {post.comment_count}
            </span>

            <span
              className="ml-auto text-[10px] font-bold uppercase tracking-[0.15em] text-primary opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Read →
            </span>
          </div>
        </div>
      </button>

      {/* ── Archive hover action ── */}
      {canArchive && (
        <button
          onClick={handleArchiveClick}
          disabled={archiveBusy}
          title={archiveConfirm ? "Click again to confirm" : "Archive post"}
          className={`
            absolute top-2 right-2
            flex items-center gap-1.5 h-7 px-2
            text-[9px] font-bold uppercase tracking-[0.12em]
            border transition-all duration-150
            opacity-0 group-hover:opacity-100
            disabled:cursor-not-allowed
            ${archiveConfirm
              ? "border-destructive/60 bg-destructive/10 text-destructive opacity-100"
              : "border-border/60 bg-background/80 text-muted-foreground hover:border-destructive/60 hover:text-destructive hover:bg-destructive/5"
            }
          `}
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {archiveBusy
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Archive className="h-3 w-3" />
          }
          {archiveConfirm ? "Confirm?" : "Archive"}
        </button>
      )}
    </motion.div>
  );
}