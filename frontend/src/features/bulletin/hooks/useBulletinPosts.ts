import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useDebounce } from "@/hooks/use-debounce";
import { toPost } from "../utils";
import type { BulletinPost } from "../types";
import { fetchBulletinPosts, type BulletinListResponse } from "../api";
import { bulletinKeys, type BulletinFilters } from "../bulletin.keys";

interface UseBulletinPostsOptions {
  limit?: number;
  autoFetch?: boolean;
  type?: "announcement" | "event";
  upcoming?: boolean;
}

interface UseBulletinPostsReturn {
  posts: BulletinPost[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  search: string;
  setSearch: (value: string) => void;
  fetchPosts: (page: number, nextSearch?: string) => Promise<void>;
  setCurrentPage: (page: number) => void;
  updatePost: (id: number, patch: Partial<BulletinPost>) => void;
  setPinnedPost: (id: number, pinned: boolean) => void;
  removePost: (id: number) => void;
}

export function useBulletinPosts({
  limit = 4,
  autoFetch = true,
  type,
  upcoming = false,
}: UseBulletinPostsOptions = {}): UseBulletinPostsReturn {
  const { loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [manualEnabled, setManualEnabled] = useState(autoFetch);
  const updateSearch = useCallback((value: string) => { setSearch(value); setCurrentPage(1); }, []);
  const debouncedSearch = useDebounce(search, 300).trim();
  const filters = useMemo<BulletinFilters>(() => ({ page: currentPage, limit, search: debouncedSearch, type, upcoming }), [currentPage, limit, debouncedSearch, type, upcoming]);
  const query = useQuery({
    queryKey: bulletinKeys.list(filters),
    queryFn: ({ signal }) => fetchBulletinPosts({
      page: filters.page,
      limit: filters.limit,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.upcoming ? { upcoming: true } : {}),
    }, signal),
    enabled: manualEnabled && !authLoading,
    placeholderData: (previousData) => previousData,
  });

  const fetchPosts = useCallback(async (page: number, nextSearch?: string) => {
    const normalized = nextSearch?.trim();
    setManualEnabled(true);
    if (normalized !== undefined && normalized !== search) setSearch(normalized);
    if (page !== currentPage) setCurrentPage(page);
    if (page === currentPage && (normalized === undefined || normalized === debouncedSearch)) await query.refetch();
  }, [currentPage, debouncedSearch, query, search]);

  const updateCachedPosts = useCallback((change: (result: BulletinListResponse) => BulletinListResponse) => {
    queryClient.setQueriesData<BulletinListResponse>({ queryKey: bulletinKeys.lists() }, (result) => result ? change(result) : result);
  }, [queryClient]);
  const updatePost = useCallback((id: number, patch: Partial<BulletinPost>) => {
    updateCachedPosts((result) => ({
      ...result,
      data: result.data.map((post) => post.id === id ? {
        ...post,
        likes: patch.likes ?? post.likes,
        liked_by_me: patch.liked_by_me === undefined ? post.liked_by_me : Number(patch.liked_by_me),
        comment_count: patch.comment_count ?? post.comment_count,
        is_pinned: patch.is_pinned === undefined ? post.is_pinned : Number(patch.is_pinned),
      } : post),
    }));
  }, [updateCachedPosts]);
  const setPinnedPost = useCallback((id: number, pinned: boolean) => {
    updateCachedPosts((result) => ({
      ...result,
      data: result.data.map((post) => ({ ...post, is_pinned: pinned ? Number(post.id === id) : post.id === id ? 0 : post.is_pinned }))
        .sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned))),
    }));
  }, [updateCachedPosts]);
  const removePost = useCallback((id: number) => {
    updateCachedPosts((result) => ({ ...result, data: result.data.filter((post) => post.id !== id), total: Math.max(0, result.total - 1) }));
  }, [updateCachedPosts]);

  return {
    posts: query.data?.data.map(toPost) ?? [],
    loading: query.isPending && manualEnabled,
    error: query.isError ? "Could not load posts. Please try again." : null,
    currentPage,
    totalPages: query.data?.totalPages ?? 1,
    search,
    setSearch: updateSearch,
    fetchPosts,
    setCurrentPage,
    updatePost,
    setPinnedPost,
    removePost,
  };
}
