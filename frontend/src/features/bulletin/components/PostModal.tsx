import { Sheet, SheetPortal, SheetOverlay, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { LibraryDesignProvider } from "@/components/ui/library-design";
import { Heart, MessageCircle, Send, Loader2, Download, ZoomIn } from "@/components/ui/library-glyphs";
import { Link } from "react-router-dom";
import { usePostModal } from "./hooks/usePostModal";
import type { PostModalProps } from "./types/postModal.types";
import PostModalActions from "./PostModalActions";
import PostComments from "./PostComments";
import PostLikersDialog from "./PostLikersDialog";
import PostImageLightbox from "./PostImageLightbox";
import { getInitials } from "../utils";
import "../post-drawer.css";

/** Retains the public component API; post reading uses a right-side drawer. */
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
    <LibraryDesignProvider>
      <Sheet open={!!post} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetPortal>
        <SheetOverlay className="post-drawer-backdrop" />
        <SheetPrimitive.Content data-library-design data-library-ui="sheet" className="bulletin-post-drawer">
          <div className="post-drawer-heading">
            <PostModalActions canPin={canPin} pinned={pinned} pinBusy={pinBusy} handlePin={handlePin} canArchive={canArchive} archiveBusy={archiveBusy} archiveConfirm={archiveConfirm} handleArchive={handleArchive} onClose={onClose} />
            <SheetTitle className="post-drawer-title">{post.title}</SheetTitle>
            <SheetDescription className="sr-only">Library bulletin post by {post.author_name}, published {post.date}.</SheetDescription>
            <div className="post-drawer-byline">
              {pinned && <span className="post-drawer-chip">Pinned</span>}
              <span className="post-drawer-avatar" aria-hidden="true">{getInitials(post.author_name)}</span>
              <b>{post.author_name}</b><span>{post.date}</span>
            </div>
            {post.image_url && <div className="post-drawer-media">
              <button type="button" className="post-drawer-image-open" onClick={() => setLightboxOpen(true)} aria-label={`Expand image for ${post.title}`}>
                <img src={post.image_url} alt={post.image_alt ?? post.title} />
                <span><ZoomIn aria-hidden="true" />Expand</span>
              </button>
              <button type="button" className="post-drawer-download" onClick={() => void handleDownload()} aria-label="Download post image"><Download aria-hidden="true" /></button>
            </div>}
            {downloadError && <p className="post-drawer-error" role="alert">{downloadError}</p>}
          </div>
          {Boolean(post.gallery?.length) && <div className="post-drawer-gallery" aria-label="Post gallery">{post.gallery?.map((image, index) => <img key={index} src={image.url} alt={image.alt} loading="lazy" />)}</div>}
          {post.content ? <div className="post-drawer-body">{post.content}</div> : <div className="post-drawer-body is-empty" />}
          <div className="post-drawer-reactions">
            <button type="button" className="post-drawer-like" onClick={() => void handleLike()} disabled={likeBusy} aria-pressed={liked}>
              {likeBusy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Heart aria-hidden="true" />}{liked ? "Liked" : "Like"} · {likeCount}
            </button>
            <span className="post-drawer-comment-count"><MessageCircle aria-hidden="true" />{comments.length} {comments.length === 1 ? "comment" : "comments"}</span>
            <button type="button" className="post-drawer-text-action" onClick={() => void openLikersDialog()} aria-label={`View ${likeCount} likes`}>View likes</button>
          </div>
          <PostComments comments={comments} commentsLoading={commentsLoading} canDeleteComment={canDeleteComment} handleDeleteComment={handleDeleteComment} />
          <div className="post-drawer-composer">
            {commentError && <p className="post-drawer-error" role="alert">{commentError}</p>}
            <form onSubmit={(event) => { event.preventDefault(); void handleComment(); }}>
              <label className="sr-only" htmlFor="post-drawer-comment">Write a comment</label>
              <input id="post-drawer-comment" value={commentText} onChange={(event) => setCommentText(event.target.value)} onFocus={() => { if (!user) onRequireLogin?.(); }} readOnly={!user} placeholder={user ? "Write a comment…" : "Login to join the conversation"} maxLength={1000} autoComplete="off" />
              <button type="submit" disabled={commenting || (!!user && !commentText.trim())} aria-label="Post comment">{commenting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}</button>
            </form>
            <small>Comments follow school rules and policies.{!user && <> <Link to="/login">Sign in to like or comment.</Link></>}</small>
          </div>
        </SheetPrimitive.Content>
        </SheetPortal>
      </Sheet>
      <PostLikersDialog open={likersDialogOpen} onOpenChange={setLikersDialogOpen} loading={likersLoading} likers={likers} />
      <LibraryDesignProvider enabled={false}>
        <PostImageLightbox post={post} open={lightboxOpen} onOpenChange={setLightboxOpen} imgRef={imgRef} zoom={zoom} origin={origin} handleImageClick={handleLightboxImageClick} toggleZoom={toggleZoom} handleDownload={handleDownload} downloadError={downloadError} />
      </LibraryDesignProvider>
    </LibraryDesignProvider>
  );
}
