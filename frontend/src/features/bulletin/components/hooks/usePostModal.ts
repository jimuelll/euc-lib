import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "../../utils";
import type { ApiComment, BulletinComment } from "../../types";
import type { PostModalProps, PostLiker } from "../types/postModal.types";
import { archiveBulletinPost, createBulletinComment, deleteBulletinComment, fetchBulletinLikers, fetchBulletinPost, setBulletinPinned, toggleBulletinLike } from "../../api";

const ADMIN_ROLES = ["admin", "super_admin"];
const CAN_DELETE_ROLES = ["admin", "super_admin"];
const CAN_PIN_ROLES = ["admin", "super_admin"];

export const usePostModal = ({
  post,
  onClose,
  onLikeToggle,
  onCommentAdded,
  onPinToggle,
  onRequireLogin,
  onArchived,
}: PostModalProps) => {
  const { user } = useAuth();


  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likers, setLikers] = useState<PostLiker[]>([]);
  const [likersLoading, setLikersLoading] = useState(false);
  const [likersDialogOpen, setLikersDialogOpen] = useState(false);

  const [pinned, setPinned] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);

  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  const [comments, setComments] = useState<BulletinComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!post) return;
    setLiked(post.liked_by_me);
    setLikeCount(post.likes);
    setPinned(post.is_pinned);
    setCommentText("");
    setCommentError(null);
    setDownloadError(null);
    setLightboxOpen(false);
    setArchiveConfirm(false);
    setLikers([]);
    setLikersDialogOpen(false);
    loadComments(post.id);
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lightboxOpen) {
      setZoom(1);
      setOrigin({ x: 50, y: 50 });
    }
  }, [lightboxOpen]);

  const loadComments = async (postId: number) => {
    setCommentsLoading(true);
    try {
      const data = await fetchBulletinPost(postId);
      setComments(
        (data.comments ?? []).map((c: ApiComment): BulletinComment => ({
          id: c.id,
          author: c.author,
          author_id: c.author_id,
          text: c.text,
          date: formatDate(c.created_at),
        }))
      );
    } catch {
      // Non-blocking in the modal.
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleLike = async () => {
    if (!post || likeBusy) return;
    if (!user) {
      onRequireLogin?.();
      return;
    }

    setLikeBusy(true);
    const next = !liked;
    const count = likeCount + (next ? 1 : -1);
    setLiked(next);
    setLikeCount(count);

    try {
      const data = await toggleBulletinLike(post.id);
      setLiked(data.liked);
      setLikeCount(data.total);
      onLikeToggle(post.id, data.liked, data.total);
    } catch {
      setLiked(!next);
      setLikeCount(likeCount);
    } finally {
      setLikeBusy(false);
    }
  };

  const handlePin = async () => {
    if (!post || pinBusy) return;
    setPinBusy(true);
    const next = !pinned;
    setPinned(next);
    try {
      await setBulletinPinned(post.id, next);
      onPinToggle?.(post.id, next);
    } catch {
      setPinned(!next);
    } finally {
      setPinBusy(false);
    }
  };

  const handleArchive = async () => {
    if (!post || archiveBusy) return;
    if (!archiveConfirm) {
      setArchiveConfirm(true);
      return;
    }

    setArchiveBusy(true);
    try {
      await archiveBulletinPost(post.id);
      onArchived?.(post.id);
      onClose();
    } catch {
      // Silent for now to preserve existing behavior.
    } finally {
      setArchiveBusy(false);
      setArchiveConfirm(false);
    }
  };

  const handleComment = async () => {
    if (!post || commenting) return;
    if (!user) {
      onRequireLogin?.();
      return;
    }
    if (!commentText.trim()) return;

    setCommentError(null);
    setCommenting(true);
    try {
      const c = await createBulletinComment(post.id, commentText.trim());
      setComments((prev) => [...prev, {
        id: c.id,
        author: c.author,
        author_id: c.author_id,
        text: c.text,
        date: formatDate(c.created_at),
      }]);
      setCommentText("");
      onCommentAdded(post.id);
    } catch (err: any) {
      setCommentError(err.response?.data?.message ?? "Failed to post comment.");
    } finally {
      setCommenting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!post) return;
    try {
      await deleteBulletinComment(post.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      // Silent.
    }
  };

  const handleDownload = async () => {
    if (!post?.image_url) return;
    setDownloadError(null);
    try {
      // Ask Cloudinary to attach the original asset instead of fetching it
      // through the browser, which is unreliable for cross-origin downloads.
      const [baseUrl, assetPath] = post.image_url.split("/upload/");
      if (!baseUrl || !assetPath) throw new Error("Invalid Cloudinary URL");
      const a = Object.assign(document.createElement("a"), {
        href: `${baseUrl}/upload/fl_attachment/${assetPath}`,
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setDownloadError("Could not start the download. Open the image in a new tab and try again.");
    }
  };

  const openLikersDialog = async () => {
    if (!post) return;
    setLikersDialogOpen(true);
    setLikersLoading(true);
    try {
      setLikers(await fetchBulletinLikers(post.id));
    } catch {
      setLikers([]);
    } finally {
      setLikersLoading(false);
    }
  };

  const toggleZoom = () => {
    setZoom((current) => current > 1 ? 1 : 2.5);
    setOrigin({ x: 50, y: 50 });
  };

  const handleLightboxImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    if (zoom > 1) {
      setZoom(1);
      setOrigin({ x: 50, y: 50 });
    } else {
      setZoom(2.5);
      setOrigin({ x: xPct, y: yPct });
    }
  };

  const canDeleteComment = (c: BulletinComment) =>
    user?.id === c.author_id || CAN_DELETE_ROLES.includes(user?.role ?? "");
  const canPin = CAN_PIN_ROLES.includes(user?.role ?? "");
  const canArchive = ADMIN_ROLES.includes(user?.role ?? "") || user?.id === post?.author_id;


  return {
    user, post, onClose, onRequireLogin,
    liked, likeCount, likeBusy, likers, likersLoading, likersDialogOpen, setLikersDialogOpen,
    pinned, pinBusy, archiveBusy, archiveConfirm,
    comments, commentsLoading, commentText, setCommentText, commenting, commentError,
    lightboxOpen, setLightboxOpen, zoom, origin, downloadError, imgRef,
    handleLike, handlePin, handleArchive, handleComment, handleDeleteComment, handleDownload,
    openLikersDialog, toggleZoom, handleLightboxImageClick,
    canDeleteComment, canPin, canArchive,
  };
};
