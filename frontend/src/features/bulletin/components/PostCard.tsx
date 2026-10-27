import {LibraryIcon} from "@/components/ui/library-icon";
import PostTimestamp from "./PostTimestamp";
import "../post-card.css";
import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Pin, Archive, Loader2 } from "@/components/ui/library-glyphs";
import { getInitials } from "../utils";
import { useAuth } from "@/context/AuthContext";
import type { BulletinPost } from "../types";
import { archiveBulletinPost } from "../api";

interface PostCardProps {
  post: BulletinPost;
  onClick: () => void;
  variant?: "featured" | "grid" | "list" | "homepage" | "notice" | "notice-featured";
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
  const isLiked = Boolean(Number(post.helpful_by_me ?? post.liked_by_me));
  const likeCount = Number(post.helpful_count ?? post.reaction_total ?? post.likes);
  const likeLabel = `${likeCount} ${likeCount === 1 ? "like" : "likes"}${isLiked ? ", including you" : ""}`;
  const isList = variant === "list";
  const isFeatured = variant === "featured";
  const isHomepage = variant === "homepage";
  const hasImage = Boolean(post.image_url);
  const excerpt = post.content?.trim();
  const hasExcerpt = Boolean(excerpt && !/^[\s–—-]+$/.test(excerpt));
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
      await archiveBulletinPost(post.id);
      onArchived?.(post.id);
    } catch { /* silent */ }
    finally { setArchiveBusy(false); setArchiveConfirm(false); }
  };

  if (variant === "notice" || variant === "notice-featured") {
    const featured = variant === "notice-featured";
    return (
      <article className={`bulletin-slip ${featured ? "bulletin-featured" : ""} ${post.is_pinned ? "is-pinned" : ""} ${hasImage ? "has-image" : ""}`}>
        {post.is_pinned && <span className="bulletin-pin-tag">Pinned</span>}
        <button type="button" className="bulletin-slip-open" onClick={onClick}>
          {featured && hasImage && <img className="bulletin-slip-image" src={post.image_url} alt={post.image_alt ?? post.title} />}
          <div className="bulletin-slip-copy">
            <div className="bulletin-byline">
              <span className="bulletin-avatar" aria-hidden="true">{getInitials(post.author_name)}</span>
              <div className="bulletin-author"><b title={post.author_name}>{post.author_name}</b><span><PostTimestamp interactive={false} value={post.created_at||post.date} editedAt={post.edited_at}/></span></div>
            </div>
            {featured ? <h2>{post.title}</h2> : <h3>{post.title}</h3>}
            {!featured && hasImage && <img className="bulletin-slip-image" src={post.image_url} alt={post.image_alt ?? post.title} loading="lazy" />}
            {hasExcerpt && <p className="bulletin-excerpt">{excerpt}</p>}
            <div className="bulletin-slip-meta">
              <span className="bulletin-like-stat" data-liked={isLiked}><LibraryIcon name="like"/>{likeCount}<span className="sr-only"> {likeCount===1?"like":"likes"}{isLiked?", including you":""}</span></span>
              <span><MessageCircle aria-hidden="true" />{post.comment_count}<span className="sr-only"> comments</span></span>
              <span className="bulletin-read">Read post</span>
            </div>
          </div>
        </button>
      </article>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      data-post-variant={variant}
      data-post-image={hasImage ? "true" : "false"}
      className={`library-post-card group relative flex w-full text-left border-b border-border bg-card transition-colors duration-200 hover:bg-secondary/55 ${
        isList ? "flex-row" : isFeatured && hasImage ? "flex-col lg:flex-row" : "flex-col"
      } ${post.is_pinned ? isFeatured ? "border-l-2 border-l-warning" : "border-t-2 border-t-warning" : ""}`}
    >
      {/* Clickable area — everything except the archive button */}
      <button
        onClick={onClick}
        className={`library-post-open flex min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-warning ${
          isList ? "flex-row" : isFeatured && hasImage ? "flex-col lg:flex-row" : "flex-col"
        }`}
      >
        {/* Image posts keep their media panel; text-only posts use the full card for the announcement. */}
        {isHomepage ? null : hasImage ? (
          <div
            className={`relative shrink-0 overflow-hidden bg-muted/50 ${
              isList ? "h-40 w-36 sm:w-48 md:w-56" : isHomepage ? "m-4 mr-0 h-28 w-32 border border-border sm:m-5 sm:mr-0 sm:h-32 sm:w-40" : isFeatured ? "h-64 w-full lg:h-72 lg:w-[55%]" : "h-56 w-full"
            }`}
          >
            <img
              src={post.image_url!}
              alt={post.image_alt??post.title}
              className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              loading="lazy"
            />
            {post.is_pinned && (
            <div
              className="absolute top-0 left-0 flex items-center gap-1 border-b border-r border-warning/50 bg-background/90 px-2 py-1"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <Pin className="h-2.5 w-2.5 text-warning" />
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/80">
                Pinned
              </span>
            </div>
            )}
          </div>
        ) : isHomepage ? null : (
          <div className={`relative shrink-0 overflow-hidden border-b border-border bg-primary/[0.035] ${isList || isHomepage ? "h-full w-1.5 border-b-0 border-r" : "h-2 w-full"}`}>
            <div className={isList || isHomepage ? "absolute inset-y-0 left-0 w-px bg-warning" : "absolute inset-x-0 top-0 h-px bg-warning"} />
          </div>
        )}

        {/* Content panel */}
        <div className={`flex min-w-0 flex-1 flex-col ${isList ? "p-4 sm:p-5" : isHomepage ? "p-4 sm:p-5" : isFeatured ? `p-5 sm:p-6 ${hasImage ? "lg:w-[45%]" : "w-full"} lg:justify-center` : "p-4 sm:p-5"} ${canArchive && !isHomepage ? "pr-16 sm:pr-[4.5rem]" : ""}`}>
          {!hasImage && post.is_pinned ? (
            <div className="mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-[0.18em] text-warning" style={{ fontFamily: "var(--font-heading)" }}>
              <Pin className="h-3 w-3" /> Pinned
            </div>
          ) : null}

          {/* Author row */}
          <div className={`flex min-w-0 items-center gap-2.5 ${isHomepage ? `mb-3 ${canArchive ? "pr-10" : ""}` : "mb-3"}`}>
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center bg-primary text-primary-foreground text-xs font-bold"
              style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
            >
              {getInitials(post.author_name)}
            </div>
            <div className={`library-post-meta min-w-0 ${isHomepage ? "flex-1" : ""} ${isHomepage || isFeatured ? "flex flex-col items-start gap-0.5" : "flex items-baseline gap-2"}`}>
              <span
                title={isHomepage ? post.author_name : undefined}
                className={`text-xs font-bold uppercase tracking-[0.08em] text-foreground/70 ${isHomepage ? "w-full truncate" : isFeatured ? "break-words" : "truncate"}`}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {post.author_name}
              </span>
              <span className="text-xs text-muted-foreground shrink-0"><PostTimestamp interactive={false} value={post.created_at||post.date} editedAt={post.edited_at}/></span>
            </div>
          </div>

          {/* Title */}
          <p
            className={`library-post-title font-bold leading-snug text-foreground group-hover:text-primary transition-colors ${
              isList ? "text-sm sm:text-base" : isHomepage ? "text-base" : isFeatured ? "text-xl sm:text-2xl" : "text-sm"
            }`}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {post.title}
          </p>

          {isHomepage && hasImage && (
            <div className="library-post-image-band my-3 aspect-video w-full shrink-0 overflow-hidden border border-border bg-muted/50">
              <img src={post.image_url!} alt={post.image_alt ?? post.title} className="h-full w-full object-cover object-top" loading="lazy" />
            </div>
          )}

          {hasExcerpt && <p className={`library-post-excerpt mt-2 text-xs leading-relaxed text-muted-foreground ${isFeatured ? "line-clamp-3 sm:text-sm" : "line-clamp-2"}`}>
            {excerpt}
          </p>}

          {/* Footer — stats */}
          <div className={`library-post-footer mt-auto flex items-center gap-4 border-t border-border/70 ${isHomepage ? "pt-2.5" : "pt-3"}`}>
            <span
              className="bulletin-like-stat flex items-center gap-1.5 text-xs font-bold transition-colors text-muted-foreground"
              data-liked={isLiked}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <LibraryIcon name="like" aria-label={likeLabel} role="img" className="h-3 w-3"/>
              {likeCount}
            </span>

            <span
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <MessageCircle aria-label={`${post.comment_count} comments`} role="img" className="h-3 w-3" />
              {post.comment_count}
            </span>

            <span
              className="ml-auto text-xs font-bold uppercase tracking-[0.15em] text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Read →
            </span>
          </div>
        </div>
      </button>

      {/* A familiar post-header action: kept out of the reading area with reserved padding. */}
      {canArchive && (
        <button
          onClick={handleArchiveClick}
          disabled={archiveBusy}
          title={archiveConfirm ? "Click again to confirm" : "Archive post"}
          aria-label={archiveConfirm ? "Confirm archive" : "Archive post"}
          className={`
            absolute right-2 top-2
            flex h-11 w-11 items-center justify-center
            border transition-all duration-150 opacity-0
            group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100
            disabled:cursor-not-allowed
            ${archiveConfirm
              ? "border-destructive/60 bg-destructive/10 text-destructive opacity-100"
              : "border-border/60 bg-background text-muted-foreground hover:border-destructive/60 hover:text-destructive hover:bg-destructive/5"
            }
          `}
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {archiveBusy
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Archive className="h-3 w-3" />
          }
        </button>
      )}
    </motion.div>
  );
}
