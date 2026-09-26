import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "../../utils";
import type { ApiComment, BulletinComment } from "../../types";
import type { PostModalProps, PostLiker } from "../types/postModal.types";
import { archiveBulletinPost, createBulletinComment, deleteBulletinComment, fetchBulletinLikers, fetchBulletinPost, setBulletinPinned, toggleBulletinLike } from "../../api";
import { bulletinKeys } from "../../bulletin.keys";

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
  const queryClient = useQueryClient();


  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likersDialogOpen, setLikersDialogOpen] = useState(false);

  const [pinned, setPinned] = useState(false);

  const [archiveConfirm, setArchiveConfirm] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const postId = post?.id ?? 0;
  const commentsQuery = useQuery({ queryKey: bulletinKeys.post(postId), queryFn: ({ signal }) => fetchBulletinPost(postId, signal), enabled: Boolean(post) });
  const likersQuery = useQuery({ queryKey: bulletinKeys.likers(postId), queryFn: ({ signal }) => fetchBulletinLikers(postId, signal), enabled: Boolean(post) && likersDialogOpen });
  const comments: BulletinComment[] = (commentsQuery.data?.comments ?? []).map((comment) => ({
    id: comment.id, author: comment.author, author_id: comment.author_id, text: comment.text, date: formatDate(comment.created_at),
  }));
  const commentsLoading = commentsQuery.isFetching;
  const likers: PostLiker[] = likersQuery.data ?? [];
  const likersLoading = likersQuery.isFetching;
  const likeMutation = useMutation({
    mutationFn: ({ postId: id }: { postId: number; liked: boolean; total: number }) => toggleBulletinLike(id),
    onMutate: async ({ postId: id, liked: next, total }) => {
      const previous = { liked, likeCount };
      setLiked(next); setLikeCount(total);
      onLikeToggle(id, next, total);
      return previous;
    },
    onError: (_error, variables, previous) => {
      if (previous) { setLiked(previous.liked); setLikeCount(previous.likeCount); onLikeToggle(variables.postId, previous.liked, previous.likeCount); }
    },
    onSuccess: (result, variables) => { setLiked(result.liked); setLikeCount(result.total); onLikeToggle(variables.postId, result.liked, result.total); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: bulletinKeys.lists() }),
  });
  const pinMutation = useMutation({
    mutationFn: ({ postId: id, pinned: next }: { postId: number; pinned: boolean }) => setBulletinPinned(id, next),
    onMutate: async ({ postId: id, pinned: next }) => { const previous = pinned; setPinned(next); onPinToggle?.(id, next); return previous; },
    onError: (_error, variables, previous) => { if (previous !== undefined) { setPinned(previous); onPinToggle?.(variables.postId, previous); } },
    onSettled: () => queryClient.invalidateQueries({ queryKey: bulletinKeys.lists() }),
  });
  const archiveMutation = useMutation({
    mutationFn: archiveBulletinPost,
    onSuccess: (_result, id) => { onArchived?.(id); onClose(); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: bulletinKeys.lists() }),
  });
  const commentMutation = useMutation({
    mutationFn: ({ postId: id, text }: { postId: number; text: string }) => createBulletinComment(id, text),
    onSuccess: (comment, variables) => {
      queryClient.setQueryData(bulletinKeys.post(variables.postId), (previous: { comments: ApiComment[] } | undefined) => previous ? { ...previous, comments: [...previous.comments, comment] } : { comments: [comment] });
      setCommentText(""); onCommentAdded(variables.postId);
    },
  });
  const deleteCommentMutation = useMutation({
    mutationFn: ({ postId: id, commentId }: { postId: number; commentId: number }) => deleteBulletinComment(id, commentId),
    onSuccess: (_result, variables) => queryClient.setQueryData(bulletinKeys.post(variables.postId), (previous: { comments: ApiComment[] } | undefined) => previous ? { ...previous, comments: previous.comments.filter((comment) => comment.id !== variables.commentId) } : previous),
  });
  const likeBusy = likeMutation.isPending;
  const pinBusy = pinMutation.isPending;
  const archiveBusy = archiveMutation.isPending;
  const commenting = commentMutation.isPending;

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
    setLikersDialogOpen(false);
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lightboxOpen) {
      setZoom(1);
      setOrigin({ x: 50, y: 50 });
    }
  }, [lightboxOpen]);

  const handleLike = async () => {
    if (!post || likeMutation.isPending) return;
    if (!user) {
      onRequireLogin?.();
      return;
    }

    const next = !liked;
    const count = likeCount + (next ? 1 : -1);
    likeMutation.mutate({ postId: post.id, liked: next, total: count });
  };

  const handlePin = async () => {
    if (!post || pinMutation.isPending) return;
    const next = !pinned;
    pinMutation.mutate({ postId: post.id, pinned: next });
  };

  const handleArchive = async () => {
    if (!post || archiveBusy) return;
    if (!archiveConfirm) {
      setArchiveConfirm(true);
      return;
    }

    archiveMutation.mutate(post.id, { onSettled: () => setArchiveConfirm(false) });
  };

  const handleComment = async () => {
    if (!post || commentMutation.isPending) return;
    if (!user) {
      onRequireLogin?.();
      return;
    }
    if (!commentText.trim()) return;

    setCommentError(null);
    try { await commentMutation.mutateAsync({ postId: post.id, text: commentText.trim() }); }
    catch (err: any) { setCommentError(err.response?.data?.message ?? "Failed to post comment."); }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!post) return;
    try {
      await deleteCommentMutation.mutateAsync({ postId: post.id, commentId });
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
