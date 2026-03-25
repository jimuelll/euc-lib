import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Heart, MessageCircle, Send, Loader2,
  Trash2, Download, X, ZoomIn, Pin, PinOff,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/utils/AxiosInstance";
import { getInitials, formatDate } from "../utils";
import type { BulletinPost, ApiComment, BulletinComment } from "../types";

interface PostModalProps {
  post: BulletinPost | null;
  onClose: () => void;
  onLikeToggle: (postId: number, liked: boolean, total: number) => void;
  onCommentAdded: (postId: number) => void;
  onPinToggle?: (postId: number, pinned: boolean) => void;
}

const CAN_DELETE_ROLES = ["admin", "super_admin"];
const CAN_PIN_ROLES    = ["admin", "super_admin"];

// ── Section label — same as page header grammar ───────────────────────────────
const ModalSectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3">
    <div className="h-px w-4 bg-warning shrink-0" />
    <span
      className="text-[9px] font-bold uppercase tracking-[0.3em] text-warning"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </span>
  </div>
);

export function PostModal({ post, onClose, onLikeToggle, onCommentAdded, onPinToggle }: PostModalProps) {
  const { user } = useAuth();

  const [liked, setLiked]         = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy]   = useState(false);

  const [pinned, setPinned]   = useState(false);
  const [pinBusy, setPinBusy] = useState(false);

  const [comments, setComments]               = useState<BulletinComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const [commentText, setCommentText]   = useState("");
  const [commenting, setCommenting]     = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom]                 = useState(1);
  const [origin, setOrigin]             = useState({ x: 50, y: 50 });
  const imgRef                          = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!post) return;
    setLiked(post.liked_by_me);
    setLikeCount(post.likes);
    setPinned(post.is_pinned);
    setCommentText("");
    setCommentError(null);
    setLightboxOpen(false);
    loadComments(post.id);
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lightboxOpen) { setZoom(1); setOrigin({ x: 50, y: 50 }); }
  }, [lightboxOpen]);

  const loadComments = async (postId: number) => {
    setCommentsLoading(true);
    try {
      const { data } = await axiosInstance.get(`/api/bulletin/${postId}`);
      setComments(
        (data.comments ?? []).map((c: ApiComment): BulletinComment => ({
          id: c.id, author: c.author, author_id: c.author_id,
          text: c.text, date: formatDate(c.created_at),
        }))
      );
    } catch { /* non-blocking */ }
    finally { setCommentsLoading(false); }
  };

  const handleLike = async () => {
    if (!post || likeBusy) return;
    setLikeBusy(true);
    const next = !liked; const count = likeCount + (next ? 1 : -1);
    setLiked(next); setLikeCount(count);
    try {
      const { data } = await axiosInstance.post(`/api/bulletin/${post.id}/like`);
      setLiked(data.liked); setLikeCount(data.total);
      onLikeToggle(post.id, data.liked, data.total);
    } catch { setLiked(!next); setLikeCount(likeCount); }
    finally { setLikeBusy(false); }
  };

  const handlePin = async () => {
    if (!post || pinBusy) return;
    setPinBusy(true);
    const next = !pinned;
    setPinned(next);
    try {
      await axiosInstance.patch(`/api/bulletin/${post.id}/pin`, { pinned: next });
      onPinToggle?.(post.id, next);
    } catch { setPinned(!next); }
    finally { setPinBusy(false); }
  };

  const handleComment = async () => {
    if (!post || !commentText.trim() || commenting) return;
    setCommentError(null); setCommenting(true);
    try {
      const { data: c } = await axiosInstance.post(`/api/bulletin/${post.id}/comments`, { text: commentText.trim() });
      setComments((prev) => [...prev, {
        id: c.id, author: c.author, author_id: c.author_id,
        text: c.text, date: formatDate(c.created_at),
      }]);
      setCommentText(""); onCommentAdded(post.id);
    } catch (err: any) {
      setCommentError(err.response?.data?.message ?? "Failed to post comment.");
    } finally { setCommenting(false); }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!post) return;
    try {
      await axiosInstance.delete(`/api/bulletin/${post.id}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch { /* silent */ }
  };

  const handleDownload = async () => {
    if (!post?.image_url) return;
    try {
      const rawUrl = post.image_url.replace(/\/upload\/[^/]+\//, "/upload/");
      const res    = await fetch(rawUrl);
      const blob   = await res.blob();
      const url    = URL.createObjectURL(blob);
      const ext    = blob.type.split("/")[1] || "jpg";
      const a      = Object.assign(document.createElement("a"), {
        href: url,
        download: `${post.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${ext}`,
      });
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { window.open(post.image_url, "_blank"); }
  };

  const handleLightboxImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width)  * 100;
    const yPct = ((e.clientY - rect.top)  / rect.height) * 100;
    if (zoom > 1) { setZoom(1); setOrigin({ x: 50, y: 50 }); }
    else           { setZoom(2.5); setOrigin({ x: xPct, y: yPct }); }
  };

  const canDelete = (c: BulletinComment) =>
    user?.id === c.author_id || CAN_DELETE_ROLES.includes(user?.role ?? "");
  const canPin = CAN_PIN_ROLES.includes(user?.role ?? "");

  if (!post) return null;

  return (
    <>
      <Dialog open={!!post} onOpenChange={onClose}>
        <DialogContent
          className="w-[calc(100vw-2rem)] max-w-2xl max-h-[92dvh] overflow-y-auto p-0 gap-0 border-border shadow-2xl"
          style={{ borderRadius: 0 }}
        >

          {/* ── Header band ── */}
          <div className="bg-primary relative overflow-hidden shrink-0">
            <div className="h-[3px] w-full bg-warning" />
            <div className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(180deg, transparent, transparent 18px, white 18px, white 19px)",
              }}
            />
            <div className="relative z-10 flex items-start justify-between gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <ModalSectionLabel>Bulletin Board</ModalSectionLabel>

                <DialogHeader className="mt-2">
                  <DialogTitle
                    className="text-base sm:text-lg font-bold leading-snug text-primary-foreground pr-4"
                    style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
                  >
                    {post.title}
                  </DialogTitle>
                </DialogHeader>

                {/* Author row */}
                <div className="mt-3 flex items-center gap-2.5">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center bg-primary-foreground/15 border border-primary-foreground/25 text-primary-foreground text-[9px] font-bold"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {getInitials(post.author_name)}
                  </div>
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary-foreground/70"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {post.author_name}
                  </span>
                  <span className="text-[10px] text-primary-foreground/40">{post.date}</span>

                  {/* Pinned badge */}
                  {pinned && (
                    <span
                      className="ml-1 flex items-center gap-1 bg-warning px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/80"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      <Pin className="h-2.5 w-2.5" /> Pinned
                    </span>
                  )}
                </div>
              </div>

              {/* Header controls */}
              <div className="flex items-center gap-1 shrink-0">
                {canPin && (
                  <button
                    onClick={handlePin}
                    disabled={pinBusy}
                    title={pinned ? "Unpin post" : "Pin post"}
                    className="flex h-8 w-8 items-center justify-center text-primary-foreground/40 hover:text-warning hover:bg-primary-foreground/10 transition-colors"
                  >
                    {pinBusy
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : pinned
                        ? <PinOff className="h-3.5 w-3.5" />
                        : <Pin className="h-3.5 w-3.5" />
                    }
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center text-primary-foreground/40 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Cover image ── */}
          {post.image_url && (
            <div
              className="group relative w-full bg-muted cursor-zoom-in overflow-hidden border-b border-border shrink-0"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={post.image_url.replace("/upload/", "/upload/q_auto,f_auto/")}
                alt={post.title}
                className="w-full object-contain"
                style={{ maxHeight: "48vh" }}
                loading="eager"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span
                  className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  <ZoomIn className="h-3 w-3" /> Expand
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                  className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white hover:bg-black/80 transition-colors"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  <Download className="h-3 w-3" /> Download
                </button>
              </div>
            </div>
          )}

          {/* ── Body content ── */}
          <div className="divide-y divide-border">

            {/* Post content */}
            <div className="px-5 sm:px-6 py-5">
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {post.content}
              </p>
            </div>

            {/* Engagement row */}
            <div className="flex items-stretch border-b border-border">
              {/* Like */}
              <button
                onClick={handleLike}
                disabled={likeBusy}
                className={`flex flex-1 items-center justify-center gap-2.5 py-3 border-r border-border text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                  liked
                    ? "bg-primary/[0.04] text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <Heart className={`h-3.5 w-3.5 transition-all duration-150 ${liked ? "fill-current" : ""}`} />
                <span>{likeCount}</span>
                <span className="opacity-70">{liked ? "Liked" : "Like"}</span>
              </button>

              {/* Comment count */}
              <div
                className="flex flex-1 items-center justify-center gap-2.5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{comments.length}</span>
                <span className="opacity-70">Comments</span>
              </div>
            </div>

            {/* Comments section */}
            <div className="px-5 sm:px-6 pt-5 pb-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px w-4 bg-border shrink-0" />
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.28em] text-muted-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Comments
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {commentsLoading && (
                <div className="flex items-center gap-2 py-3 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em]"
                    style={{ fontFamily: "var(--font-heading)" }}>
                    Loading…
                  </span>
                </div>
              )}

              {!commentsLoading && comments.length === 0 && (
                <p className="py-2 text-[11px] text-muted-foreground/60">
                  No comments yet. Be the first to leave one.
                </p>
              )}

              {/* Comment list */}
              <div className="space-y-0 divide-y divide-border border border-border">
                {!commentsLoading && comments.map((c) => (
                  <div key={c.id} className="flex gap-0 group/comment hover:bg-secondary/30 transition-colors">
                    {/* Left column */}
                    <div className="w-10 shrink-0 flex flex-col items-center pt-3 border-r border-border gap-2">
                      <div
                        className="flex h-5 w-5 shrink-0 items-center justify-center bg-primary text-primary-foreground text-[8px] font-bold"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {getInitials(c.author)}
                      </div>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-baseline gap-2">
                          <span
                            className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            {c.author}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{c.date}</span>
                        </div>
                        {canDelete(c) && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="hidden group-hover/comment:flex shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment input */}
            <div className="px-5 sm:px-6 py-4 space-y-3">
              {commentError && (
                <div className="flex gap-0">
                  <div className="w-[3px] bg-destructive shrink-0" />
                  <p className="px-3 py-2 text-[11px] text-destructive bg-destructive/[0.04]">{commentError}</p>
                </div>
              )}

              <p
                className="text-[10px] text-muted-foreground/50"
                style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.02em" }}
              >
                Comments are subject to school community guidelines.
              </p>

              <div className="flex gap-0 border border-border">
                {/* Avatar cell */}
                <div className="w-10 shrink-0 flex items-center justify-center border-r border-border bg-muted/30">
                  <div
                    className="flex h-5 w-5 items-center justify-center bg-primary text-primary-foreground text-[8px] font-bold"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {user?.name ? getInitials(user.name) : "ME"}
                  </div>
                </div>
                {/* Input */}
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                  placeholder="Write a comment…"
                  maxLength={1000}
                  className="flex-1 min-w-0 h-11 px-3.5 text-sm text-foreground bg-background outline-none placeholder:text-muted-foreground/40 focus:ring-0 border-0"
                />
                {/* Send button */}
                <button
                  disabled={!commentText.trim() || commenting}
                  onClick={handleComment}
                  className="w-11 h-11 flex items-center justify-center shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-border"
                >
                  {commenting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

        </DialogContent>
      </Dialog>

      {/* ── Lightbox ── */}
      {lightboxOpen && post.image_url && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95"
          onClick={() => { if (zoom === 1) setLightboxOpen(false); }}
        >
          <img
            ref={imgRef}
            src={post.image_url.replace("/upload/", "/upload/q_auto,f_auto/")}
            alt={post.title}
            onClick={handleLightboxImageClick}
            className="max-h-[90dvh] max-w-[92vw] object-contain select-none"
            style={{
              cursor: zoom > 1 ? "zoom-out" : "zoom-in",
              transform: `scale(${zoom})`,
              transformOrigin: `${origin.x}% ${origin.y}%`,
              transition: "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            draggable={false}
          />

          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/10 px-4 py-2 text-[10px] text-white/60 pointer-events-none transition-opacity duration-300"
            style={{ opacity: zoom > 1 ? 0 : 1, fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}
          >
            CLICK IMAGE TO ZOOM · CLICK BACKDROP TO CLOSE
          </div>

          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownload}
            className="absolute right-4 top-14 flex h-8 w-8 items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            title="Download full resolution"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}