import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, FileText, Pin, Archive, Loader2, CalendarDays, MapPin } from "lucide-react";
import { getInitials } from "../utils";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/utils/AxiosInstance";
import type { BulletinPost } from "../types";

interface PostCardProps {
  post: BulletinPost;
  onClick: () => void;
  variant?: "featured" | "grid" | "list";
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
  const isFeatured = variant === "featured";
  const hasImage = Boolean(post.image_url);
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
      className={`group relative flex w-full text-left border-b border-border bg-card transition-colors duration-200 hover:bg-secondary/55 ${
        isList ? "flex-row" : "flex-col"
      } ${post.is_pinned ? "border-l-[3px] border-l-warning" : ""}`}
    >
      {/* Clickable area — everything except the archive button */}
      <button
        onClick={onClick}
        className={`flex min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-warning ${
          isList ? "flex-row" : "flex-col"
        }`}
      >
        {/* Image posts keep their media panel; text-only posts use the full card for the announcement. */}
        {hasImage ? (
          <div
            style={isList ? { minHeight: "152px" } : undefined}
            className={`relative shrink-0 overflow-hidden bg-muted/50 ${
              isList ? "w-36 sm:w-48 md:w-56" : isFeatured ? "aspect-[16/8] w-full sm:aspect-[16/7]" : "aspect-[16/9] w-full"
            }`}
          >
            <img
              src={post.image_url!}
              alt={post.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              loading="lazy"
            />
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
        ) : (
          <div className={`relative shrink-0 overflow-hidden border-b border-border bg-primary/[0.035] ${isList ? "w-2 sm:w-3 border-b-0 border-r" : "h-2 w-full"}`}>
            <div className={isList ? "absolute inset-y-0 left-0 w-px bg-warning" : "absolute inset-x-0 top-0 h-px bg-warning"} />
          </div>
        )}

        {/* Content panel */}
        <div className={`flex min-w-0 flex-1 flex-col ${isList ? "p-4 sm:p-5" : isFeatured ? "p-5 sm:p-6" : "p-4 sm:p-5"}`}>
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

          {!hasImage && (
            <div className="mb-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-primary" style={{ fontFamily: "var(--font-heading)" }}>
              <FileText className="h-3.5 w-3.5" />
              Text announcement
              {post.is_pinned ? <span className="ml-auto flex items-center gap-1 text-warning"><Pin className="h-3 w-3" /> Pinned</span> : null}
            </div>
          )}

          {/* Title */}
          <p
            className={`font-bold leading-snug text-foreground group-hover:text-primary transition-colors ${
              isList ? "text-sm sm:text-base" : isFeatured ? "text-lg sm:text-xl" : "text-sm"
            }`}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {post.title}
          </p>

          {post.post_type === "event" ? (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.1em] text-warning" style={{ fontFamily: "var(--font-heading)" }}>
              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{post.event_starts_at ? new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(post.event_starts_at)) : "Date to be announced"}</span>
              {post.event_location ? <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{post.event_location}</span> : null}
            </div>
          ) : null}

          {(isList || !hasImage || isFeatured) && (
            <p className={`mt-2 text-xs leading-relaxed text-muted-foreground ${isFeatured ? "line-clamp-3 sm:text-sm" : "line-clamp-2"}`}>
              {post.excerpt}
            </p>
          )}

          {/* Footer — stats */}
          <div className="mt-auto flex items-center gap-4 border-t border-border/70 pt-3">
            <span
              className={`flex items-center gap-1.5 text-[11px] font-bold transition-colors ${
                post.liked_by_me ? "text-primary" : "text-muted-foreground"
              }`}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <Heart className={`h-3 w-3 transition-all duration-150 ${post.liked_by_me ? "fill-current text-primary" : ""}`} />
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
              className="ml-auto text-[10px] font-bold uppercase tracking-[0.15em] text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
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
