import { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Heart, MessageCircle, Send, Loader2,
  Trash2, Download, X, ZoomIn, Pin, PinOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

export function PostModal({ post, onClose, onLikeToggle, onCommentAdded, onPinToggle }: PostModalProps) {
  const { user } = useAuth();

  const [liked, setLiked]         = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy]   = useState(false);

  const [pinned, setPinned]     = useState(false);
  const [pinBusy, setPinBusy]   = useState(false);

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

  // ── Fixed zoom: stop outer-div close from swallowing image clicks ──
  const handleLightboxImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation(); // prevent backdrop close
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
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[92dvh] overflow-y-auto p-0 gap-0 rounded-2xl border-border/60 shadow-2xl">

          {post.image_url && (
            <div
              className="group relative w-full bg-muted cursor-zoom-in overflow-hidden"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={post.image_url.replace("/upload/", "/upload/q_auto,f_auto/")}
                alt={post.title}
                className="w-full object-contain"
                style={{ maxHeight: "52vh" }}
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
              <div className="absolute inset-x-0 bottom-3 flex items-center justify-between px-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm">
                  <ZoomIn className="h-3 w-3" /> Click to expand
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                  className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
                >
                  <Download className="h-3 w-3" /> Download
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-0">

            {/* Author + title */}
            <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border/40">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary ring-2 ring-primary/20">
                  {getInitials(post.author_name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground leading-tight">{post.author_name}</p>
                  <p className="text-xs text-muted-foreground">{post.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  {pinned && (
                    <span className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                      <Pin className="h-2.5 w-2.5" /> Pinned
                    </span>
                  )}
                  {canPin && (
                    <button
                      onClick={handlePin}
                      disabled={pinBusy}
                      title={pinned ? "Unpin post" : "Pin post"}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      {pinBusy
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : pinned
                          ? <PinOff className="h-3.5 w-3.5" />
                          : <Pin className="h-3.5 w-3.5" />
                      }
                    </button>
                  )}
                </div>
              </div>

              <DialogHeader className="hidden">
                <DialogTitle>{post.title}</DialogTitle>
              </DialogHeader>

              <h3 className="text-lg sm:text-xl font-bold text-foreground leading-snug">{post.title}</h3>
            </div>

            {/* Content */}
            <div className="px-5 sm:px-6 py-4 border-b border-border/40">
              <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed whitespace-pre-line">
                {post.content}
              </p>
            </div>

            {/* Like / comment row */}
            <div className="flex items-center gap-5 px-5 sm:px-6 py-3.5 border-b border-border/40 bg-muted/20">
              <button
                onClick={handleLike}
                disabled={likeBusy}
                className={`flex items-center gap-2 text-sm font-medium transition-colors rounded-lg px-3 py-1.5 hover:bg-muted active:scale-95 ${
                  liked ? "text-rose-500" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Heart className={`h-4 w-4 transition-all duration-200 ${liked ? "fill-rose-500 scale-110" : ""}`} />
                <span>{likeCount}</span>
                <span className="text-xs font-normal opacity-70">{liked ? "Liked" : "Like"}</span>
              </button>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                <span>{comments.length}</span>
                <span className="text-xs opacity-70">Comments</span>
              </span>
            </div>

            {/* Comments */}
            <div className="px-5 sm:px-6 pt-4 pb-2 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Comments</h4>
              {commentsLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading comments…
                </div>
              )}
              {!commentsLoading && comments.length === 0 && (
                <p className="text-xs text-muted-foreground py-1">No comments yet. Be the first to leave one!</p>
              )}
              <div className="space-y-2.5">
                {!commentsLoading && comments.map((c) => (
                  <div key={c.id} className="flex gap-3 group/comment">
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                      <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                        {getInitials(c.author)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 rounded-xl bg-muted/50 px-3.5 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[12px] font-semibold text-foreground">{c.author}</span>
                          <span className="ml-2 text-[11px] text-muted-foreground">{c.date}</span>
                        </div>
                        {canDelete(c) && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="hidden group-hover/comment:flex shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors mt-0.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-foreground leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment input */}
            <div className="px-5 sm:px-6 pb-5 pt-3 space-y-2.5">
              {commentError && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{commentError}</p>
              )}
              <p className="text-[11px] text-muted-foreground/60">
                ⚠️ Comments are subject to school community guidelines.
              </p>
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-muted text-muted-foreground text-[9px] font-bold">
                    {user?.name ? getInitials(user.name) : "ME"}
                  </AvatarFallback>
                </Avatar>
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                  placeholder="Write a comment…"
                  maxLength={1000}
                  className="h-10 flex-1 min-w-0 rounded-full border border-border bg-muted/40 px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={!commentText.trim() || commenting}
                  onClick={handleComment}
                >
                  {commenting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox — backdrop closes only when not zoomed, image click zooms */}
      {lightboxOpen && post.image_url && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md"
          onClick={() => { if (zoom === 1) setLightboxOpen(false); }}
        >
          <img
            ref={imgRef}
            src={post.image_url.replace("/upload/", "/upload/q_auto,f_auto/")}
            alt={post.title}
            onClick={handleLightboxImageClick}
            className="max-h-[90dvh] max-w-[92vw] rounded-xl object-contain shadow-2xl select-none"
            style={{
              cursor: zoom > 1 ? "zoom-out" : "zoom-in",
              transform: `scale(${zoom})`,
              transformOrigin: `${origin.x}% ${origin.y}%`,
              transition: "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            draggable={false}
          />

          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-xs text-white/70 backdrop-blur-sm pointer-events-none transition-opacity duration-300"
            style={{ opacity: zoom > 1 ? 0 : 1 }}
          >
            Click image to zoom · Click background to close
          </div>

          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition-colors z-10"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownload}
            className="absolute right-4 top-16 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition-colors z-10"
            title="Download full resolution"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}