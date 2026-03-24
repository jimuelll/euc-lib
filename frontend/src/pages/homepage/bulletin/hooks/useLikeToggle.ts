import { useState } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import type { BulletinPost } from "../types";

interface UseLikeToggleOptions {
  post: BulletinPost;
  onUpdate: (id: number, patch: Partial<BulletinPost>) => void;
}

export function useLikeToggle({ post, onUpdate }: UseLikeToggleOptions) {
  const [liked, setLiked]       = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [busy, setBusy]         = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);

    // Optimistic
    const next  = !liked;
    const count = likeCount + (next ? 1 : -1);
    setLiked(next);
    setLikeCount(count);

    try {
      const { data } = await axiosInstance.post(`/api/bulletin/${post.id}/like`);
      setLiked(data.liked);
      setLikeCount(data.total);
      onUpdate(post.id, { liked_by_me: data.liked, likes: data.total });
    } catch {
      // revert
      setLiked(!next);
      setLikeCount(likeCount);
    } finally {
      setBusy(false);
    }
  };

  return { liked, likeCount, busy, toggle };
}