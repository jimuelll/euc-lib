import { useState, useEffect, useCallback } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import { useAuth } from "@/context/AuthContext";
import { toPost } from "../utils";
import type { BulletinPost } from "../types";

interface UseBulletinPostsOptions {
  limit?: number;
  autoFetch?: boolean;
}

interface UseBulletinPostsReturn {
  posts: BulletinPost[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  fetchPosts: (page: number) => Promise<void>;
  setCurrentPage: (page: number) => void;
  updatePost: (id: number, patch: Partial<BulletinPost>) => void;
  /** Optimistically remove a post from local state (e.g. after archive) */
  removePost: (id: number) => void;
}

export function useBulletinPosts({
  limit = 4,
  autoFetch = true,
}: UseBulletinPostsOptions = {}): UseBulletinPostsReturn {
  const { loading: authLoading } = useAuth();
  const [posts, setPosts]             = useState<BulletinPost[]>([]);
  const [loading, setLoading]         = useState(autoFetch);
  const [error, setError]             = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);

  const fetchPosts = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axiosInstance.get(
        `/api/bulletin?page=${page}&limit=${limit}`
      );
      setPosts(data.data.map(toPost));
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setError("Could not load posts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (!autoFetch || authLoading) return;
    fetchPosts(currentPage);
  }, [currentPage, fetchPosts, autoFetch, authLoading]);

  const updatePost = useCallback(
    (id: number, patch: Partial<BulletinPost>) => {
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
    },
    []
  );

  const removePost = useCallback((id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    posts,
    loading,
    error,
    currentPage,
    totalPages,
    fetchPosts,
    setCurrentPage,
    updatePost,
    removePost,
  };
}
