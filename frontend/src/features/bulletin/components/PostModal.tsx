import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Heart, Send, Loader2, Download, ZoomIn, Pin,
} from "lucide-react";
import { Link } from "react-router-dom";
import { usePostModal } from "./hooks/usePostModal";
import type { PostModalProps } from "./types/postModal.types";
import PostModalActions from "./PostModalActions";
import PostComments from "./PostComments";
import PostLikersDialog from "./PostLikersDialog";
import PostImageLightbox from "./PostImageLightbox";
import { getInitials } from "../utils";

const ModalSectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3">
    <div className="h-px w-4 bg-warning shrink-0" />
    <span className="text-xs font-bold uppercase tracking-[0.3em] text-warning" style={{ fontFamily: "var(--font-heading)" }}>
      {children}
    </span>
  </div>
);

export function PostModal(props: PostModalProps) {
  const model = usePostModal(props);
  const {
    user, post, onClose, onRequireLogin,
    liked, likeCount, likeBusy, likers, likersLoading, likersDialogOpen, setLikersDialogOpen,
    pinned, pinBusy, archiveBusy, archiveConfirm,
    comments, commentsLoading, commentText, setCommentText, commenting, commentError,
    lightboxOpen, setLightboxOpen, zoom, origin, downloadError, imgRef,
    handleLike, handlePin, handleArchive, handleComment, handleDeleteComment, handleDownload,
    openLikersDialog, toggleZoom, handleLightboxImageClick,
    canDeleteComment, canPin, canArchive,
  } = model;

  if (!post) return null;

  return (
    <>
      <Dialog open={!!post} onOpenChange={onClose}>
        <DialogContent
          className="[&>button:last-child]:hidden w-[calc(100vw-1rem)] max-w-2xl max-h-[92dvh] overflow-x-hidden overflow-y-auto p-0 gap-0 border-border shadow-2xl sm:w-[calc(100vw-2rem)]"
          style={{ borderRadius: 0 }}
        >
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
            <div className="relative z-10 flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5">
              <div className="flex-1 min-w-0">
                <ModalSectionLabel>Bulletin Board</ModalSectionLabel>

                <DialogHeader className="mt-2">
                  <DialogTitle
                    className="break-words pr-0 text-base font-bold leading-snug text-primary-foreground sm:pr-4 sm:text-lg"
                    style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}
                  >
                    {post.title}
                  </DialogTitle>
                </DialogHeader>

                <div className="mt-3 flex items-center gap-2.5 flex-wrap">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center bg-primary-foreground/15 border border-primary-foreground/25 text-primary-foreground text-xs font-bold"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {getInitials(post.author_name)}
                  </div>
                  <span
                    className="text-xs font-bold uppercase tracking-[0.08em] text-primary-foreground/70"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {post.author_name}
                  </span>
                  <span className="text-xs text-primary-foreground/40">{post.date}</span>

                  {pinned && (
                    <span
                      className="flex items-center gap-1 bg-warning px-2 py-0.5 text-xs font-bold uppercase tracking-[0.18em] text-foreground/80"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      <Pin className="h-2.5 w-2.5" /> Pinned
                    </span>
                  )}
                </div>
              </div>

              <PostModalActions
                canPin={canPin}
                pinned={pinned}
                pinBusy={pinBusy}
                handlePin={handlePin}
                canArchive={canArchive}
                archiveBusy={archiveBusy}
                archiveConfirm={archiveConfirm}
                handleArchive={handleArchive}
                onClose={onClose}
              />
            </div>
          </div>

          {post.image_url && (
            <div
              className="group relative w-full bg-muted cursor-zoom-in overflow-hidden border-b border-border shrink-0"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={post.image_url}
                alt={post.title}
                className="w-full object-contain"
                style={{ maxHeight: "48vh" }}
                loading="eager"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span
                  className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  <ZoomIn className="h-3 w-3" /> Expand
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                  className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-black/80 transition-colors"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  <Download className="h-3 w-3" /> Download
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-border">
            <div className="px-5 sm:px-6 py-5">
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {post.content}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-2.5 text-xs sm:px-6">
              <button
                type="button"
                onClick={() => void openLikersDialog()}
                className="flex items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
                aria-label={`View ${likeCount} likes`}
              >
                <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current text-primary" : ""}`} />
                <span>{likeCount} {likeCount === 1 ? "like" : "likes"}</span>
              </button>
            </div>

            <div className="flex items-stretch border-b border-border">
              <button
                onClick={handleLike}
                disabled={likeBusy}
                className={`flex min-w-0 flex-1 items-center justify-center gap-2.5 px-2 py-3 text-xs font-bold uppercase tracking-[0.12em] transition-colors ${
                  liked
                    ? "bg-primary/[0.04] text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <Heart className={`h-3.5 w-3.5 transition-all duration-150 ${liked ? "fill-current" : ""}`} />
                <span className="opacity-70">{liked ? "Liked" : "Like"}</span>
              </button>

            </div>

            <PostComments
              comments={comments}
              commentsLoading={commentsLoading}
              canDeleteComment={canDeleteComment}
              handleDeleteComment={handleDeleteComment}
            />
            <div className="px-5 sm:px-6 py-4 space-y-3">
              {commentError && (
                <div className="flex gap-0">
                  <div className="w-[3px] bg-destructive shrink-0" />
                  <p className="px-3 py-2 text-xs text-destructive bg-destructive/[0.04]">{commentError}</p>
                </div>
              )}

              <div className="flex gap-0 border border-warning/30 bg-warning/10">
                <div className="w-[3px] bg-warning shrink-0" />
                <p
                  className="px-3 py-2 text-xs leading-relaxed text-foreground/80"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.02em" }}
                >
                  Please comment responsibly. All interactions are subject to school rules and policies.
                </p>
              </div>

              <div className="flex gap-0 border border-border">
                <div className="w-10 shrink-0 flex items-center justify-center border-r border-border bg-muted/30">
                  <div
                    className="flex h-5 w-5 items-center justify-center bg-primary text-primary-foreground text-[8px] font-bold"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {user?.name ? getInitials(user.name) : "ME"}
                  </div>
                </div>
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleComment();
                    }
                  }}
                  onFocus={() => {
                    if (!user) {
                      onRequireLogin?.();
                    }
                  }}
                  readOnly={!user}
                  placeholder={user ? "Write a comment..." : "Login to join the conversation"}
                  maxLength={1000}
                  className="flex-1 min-w-0 h-11 px-3.5 text-sm text-foreground bg-background outline-none placeholder:text-muted-foreground/40 focus:ring-0 border-0"
                />
                <button
                  disabled={commenting || (!!user && !commentText.trim())}
                  onClick={handleComment}
                  className="w-11 h-11 flex items-center justify-center shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-border"
                >
                  {commenting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>

              {!user && (
                <div className="flex items-center justify-between gap-3 border border-border bg-secondary/20 px-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    Reacting and commenting on bulletin posts requires an account.
                  </p>
                  <Link
                    to="/login"
                    className="shrink-0 text-xs font-bold uppercase tracking-[0.15em] text-primary"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Login
                  </Link>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PostLikersDialog
        open={likersDialogOpen}
        onOpenChange={setLikersDialogOpen}
        loading={likersLoading}
        likers={likers}
      />

      <PostImageLightbox
        post={post}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imgRef={imgRef}
        zoom={zoom}
        origin={origin}
        handleImageClick={handleLightboxImageClick}
        toggleZoom={toggleZoom}
        handleDownload={handleDownload}
        downloadError={downloadError}
      />
    </>
  );
}
