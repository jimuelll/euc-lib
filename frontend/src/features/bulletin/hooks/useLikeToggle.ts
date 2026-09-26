import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { BulletinPost } from "../types";
import { toggleBulletinLike } from "../api";

interface UseLikeToggleOptions {
  post: BulletinPost;
  onUpdate: (id: number, patch: Partial<BulletinPost>) => void;
}

export function useLikeToggle({ post, onUpdate }: UseLikeToggleOptions) {
  const [liked, setLiked]       = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.likes);
  const mutation = useMutation({
    mutationFn: ({ postId }: { postId: number; liked: boolean; total: number }) => toggleBulletinLike(postId),
    onMutate: ({ liked: next, total }) => {
      const previous = { liked, likeCount };
      setLiked(next); setLikeCount(total); onUpdate(post.id, { liked_by_me: next, likes: total });
      return previous;
    },
    onError: (_error, _variables, previous) => {
      if (previous) { setLiked(previous.liked); setLikeCount(previous.likeCount); onUpdate(post.id, { liked_by_me: previous.liked, likes: previous.likeCount }); }
    },
    onSuccess: (result) => { setLiked(result.liked); setLikeCount(result.total); onUpdate(post.id, { liked_by_me: result.liked, likes: result.total }); },
  });
  const busy = mutation.isPending;

  const toggle = () => {
    if (busy) return;
    const next  = !liked;
    const count = likeCount + (next ? 1 : -1);
    mutation.mutate({ postId: post.id, liked: next, total: count });
  };

  return { liked, likeCount, busy, toggle };
}
