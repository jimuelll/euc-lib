import { useState, useEffect, useCallback } from "react";
import axiosInstance from "@/utils/AxiosInstance";
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
}

export function useBulletinPosts({
  limit = 4,
  autoFetch = true,
}: UseBulletinPostsOptions = {}): UseBulletinPostsReturn {
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
    if (autoFetch) fetchPosts(currentPage);
  }, [currentPage, fetchPosts, autoFetch]);

  const updatePost = useCallback(
    (id: number, patch: Partial<BulletinPost>) => {
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
    },
    []
  );

  return {
    posts,
    loading,
    error,
    currentPage,
    totalPages,
    fetchPosts,
    setCurrentPage,
    updatePost,
  };
}