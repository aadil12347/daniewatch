import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAdmin } from './useAdmin';
import { useAdminContentVisibility } from '@/contexts/AdminContentVisibilityContext';

const POST_MODERATION_STORAGE_KEY = 'post_moderation';

export interface PostModeration {
  tmdb_id: string;
  media_type: 'movie' | 'tv';
  is_blocked: boolean;
  is_pinned: boolean;
  pinned_page?: string; // 'home', 'movies', 'tvshows', 'anime', 'indian', 'korean'
  blocked_at?: string;
  pinned_at?: string;
  title?: string;
  poster_path?: string;
}

type PinnedPost = Omit<PostModeration, 'is_blocked'> & { is_blocked?: boolean };

type PostModerationRow = {
  tmdb_id: string;
  media_type: 'movie' | 'tv';
  is_blocked: boolean;
  blocked_at: string | null;
  title: string | null;
  poster_path: string | null;
};

const keyOf = (tmdbId: string, mediaType: 'movie' | 'tv') => `${mediaType}:${tmdbId}`;

export const usePostModeration = () => {
  const { isAdmin } = useAdmin();
  const { showBlockedPosts } = useAdminContentVisibility();

  // PINS: kept in localStorage (existing behavior)
  const [pinnedPosts, setPinnedPosts] = useState<PinnedPost[]>([]);

  // BLOCKS: stored globally in Supabase (new behavior)
  const [blockedRows, setBlockedRows] = useState<PostModerationRow[]>([]);

  const [isLoadingPins, setIsLoadingPins] = useState(true);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(true);

  const isLoading = isLoadingPins || isLoadingBlocked;

  // ---------- Pins (localStorage) ----------
  useEffect(() => {
    try {
      const stored = localStorage.getItem(POST_MODERATION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PostModeration[];
        // keep only pinned items from legacy storage
        setPinnedPosts(parsed.filter((p) => p.is_pinned));
      }
    } catch (error) {
      console.error('Error loading post moderation pins:', error);
    } finally {
      setIsLoadingPins(false);
    }
  }, []);

  const savePinsToStorage = useCallback((pins: PinnedPost[]) => {
    try {
      // Persist only pinned posts (blocks are now global in Supabase)
      localStorage.setItem(POST_MODERATION_STORAGE_KEY, JSON.stringify(pins));
    } catch (error) {
      console.error('Error saving post moderation pins:', error);
    }
  }, []);

  // ---------- Blocks (Supabase) ----------
  const refetchBlocked = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setBlockedRows([]);
      setIsLoadingBlocked(false);
      return;
    }

    setIsLoadingBlocked(true);
    try {
      const { data, error } = await supabase
        .from('post_moderation')
        .select('tmdb_id, media_type, is_blocked, blocked_at, title, poster_path')
        .eq('is_blocked', true);

      if (error) throw error;
      setBlockedRows((data as PostModerationRow[]) || []);
    } catch (e) {
      console.error('Error loading post moderation blocks:', e);
      // Fail closed would hide too much; fail open keeps content visible if moderation table is unreachable.
      setBlockedRows([]);
    } finally {
      setIsLoadingBlocked(false);
    }
  }, []);

  useEffect(() => {
    refetchBlocked();
  }, [refetchBlocked]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('post-moderation-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_moderation' }, () => {
        refetchBlocked();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchBlocked]);

  // ---------- Derived unified view (keeps old API working) ----------
  const moderatedPosts = useMemo<PostModeration[]>(() => {
    const map = new Map<string, PostModeration>();

    // Start with pins
    pinnedPosts.forEach((p) => {
      map.set(keyOf(p.tmdb_id, p.media_type), {
        tmdb_id: p.tmdb_id,
        media_type: p.media_type,
        is_blocked: false,
        is_pinned: true,
        pinned_page: p.pinned_page,
        pinned_at: p.pinned_at,
        title: p.title,
        poster_path: p.poster_path,
      });
    });

    // Merge blocks
    blockedRows.forEach((row) => {
      const k = keyOf(String(row.tmdb_id), row.media_type);
      const existing = map.get(k);
      map.set(k, {
        tmdb_id: String(row.tmdb_id),
        media_type: row.media_type,
        is_blocked: true,
        is_pinned: existing?.is_pinned ?? false,
        pinned_page: existing?.pinned_page,
        pinned_at: existing?.pinned_at,
        blocked_at: row.blocked_at ?? undefined,
        title: row.title ?? existing?.title,
        poster_path: row.poster_path ?? existing?.poster_path,
      });
    });

    return Array.from(map.values());
  }, [blockedRows, pinnedPosts]);

  // ---------- Queries ----------
  const isBlocked = useCallback(
    (tmdbId: number | string, mediaType: 'movie' | 'tv') => {
      const id = String(tmdbId);
      return blockedRows.some((p) => p.tmdb_id === id && p.media_type === mediaType && p.is_blocked);
    },
    [blockedRows]
  );

  const isPinned = useCallback(
    (tmdbId: number | string, mediaType: 'movie' | 'tv') => {
      const id = String(tmdbId);
      return pinnedPosts.some((p) => p.tmdb_id === id && p.media_type === mediaType && p.is_pinned);
    },
    [pinnedPosts]
  );

  const getPinnedPage = useCallback(
    (tmdbId: number | string, mediaType: 'movie' | 'tv') => {
      const id = String(tmdbId);
      const post = pinnedPosts.find((p) => p.tmdb_id === id && p.media_type === mediaType && p.is_pinned);
      return post?.pinned_page;
    },
    [pinnedPosts]
  );

  const blockPost = useCallback(
    async (tmdbId: number | string, mediaType: 'movie' | 'tv', title?: string, posterPath?: string) => {
      const id = String(tmdbId);

      if (!isSupabaseConfigured) {
        const err = new Error('Supabase not configured: cannot block globally');
        console.warn(err.message);
        throw err;
      }

      // Optimistic UI (admin sees it dulled instantly)
      setBlockedRows((prev) => {
        const exists = prev.some((p) => p.tmdb_id === id && p.media_type === mediaType);
        const nextRow: PostModerationRow = {
          tmdb_id: id,
          media_type: mediaType,
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          title: title ?? null,
          poster_path: posterPath ?? null,
        };
        return exists
          ? prev.map((p) => (p.tmdb_id === id && p.media_type === mediaType ? nextRow : p))
          : [nextRow, ...prev];
      });

      const { error } = await supabase.from('post_moderation').upsert(
        {
          tmdb_id: id,
          media_type: mediaType,
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          title: title ?? null,
          poster_path: posterPath ?? null,
        },
        { onConflict: 'tmdb_id,media_type' }
      );

      if (error) {
        console.error('Failed to block post:', error);
        // Recover from optimistic update
        await refetchBlocked();
        throw error;
      }
    },
    [refetchBlocked]
  );

  const unblockPost = useCallback(
    async (tmdbId: number | string, mediaType: 'movie' | 'tv') => {
      const id = String(tmdbId);

      if (!isSupabaseConfigured) {
        const err = new Error('Supabase not configured: cannot unblock globally');
        console.warn(err.message);
        throw err;
      }

      // Optimistic UI
      setBlockedRows((prev) => prev.filter((p) => !(p.tmdb_id === id && p.media_type === mediaType)));

      const { error } = await supabase.from('post_moderation').delete().eq('tmdb_id', id).eq('media_type', mediaType);

      if (error) {
        console.error('Failed to unblock post:', error);
        await refetchBlocked();
        throw error;
      }
    },
    [refetchBlocked]
  );

  // ---------- Mutations (pins => localStorage) ----------
  const pinPost = useCallback(
    (tmdbId: number | string, mediaType: 'movie' | 'tv', page: string, title?: string, posterPath?: string) => {
      const id = String(tmdbId);
      setPinnedPosts((prev) => {
        const existing = prev.find((p) => p.tmdb_id === id && p.media_type === mediaType);
        const updated: PinnedPost[] = existing
          ? prev.map((p) =>
              p.tmdb_id === id && p.media_type === mediaType
                ? {
                    ...p,
                    is_pinned: true,
                    pinned_page: page,
                    pinned_at: new Date().toISOString(),
                    title,
                    poster_path: posterPath,
                  }
                : p
            )
          : [
              ...prev,
              {
                tmdb_id: id,
                media_type: mediaType,
                is_pinned: true,
                pinned_page: page,
                pinned_at: new Date().toISOString(),
                title,
                poster_path: posterPath,
              },
            ];

        savePinsToStorage(updated);
        return updated;
      });
    },
    [savePinsToStorage]
  );

  const unpinPost = useCallback(
    (tmdbId: number | string, mediaType: 'movie' | 'tv') => {
      const id = String(tmdbId);
      setPinnedPosts((prev) => {
        const updated = prev
          .map((p) => (p.tmdb_id === id && p.media_type === mediaType ? { ...p, is_pinned: false } : p))
          .filter((p) => p.is_pinned);

        savePinsToStorage(updated);
        return updated;
      });
    },
    [savePinsToStorage]
  );

  // ---------- Lists ----------
  const getBlockedPosts = useCallback(() => {
    return moderatedPosts.filter((p) => p.is_blocked);
  }, [moderatedPosts]);

  const getPinnedPosts = useCallback(
    (page: string) => {
      return moderatedPosts.filter((p) => p.is_pinned && p.pinned_page === page);
    },
    [moderatedPosts]
  );

  const filterBlockedPosts = useCallback(
    <T extends { id: number; media_type?: string; first_air_date?: string }>(items: T[], defaultMediaType?: 'movie' | 'tv'): T[] => {
      // Admins can choose to hide blocked posts from lists
      if (isAdmin && showBlockedPosts) return items;

      return items.filter((item) => {
        const mediaType = (item.media_type || (item.first_air_date ? 'tv' : defaultMediaType || 'movie')) as 'movie' | 'tv';
        return !isBlocked(item.id, mediaType);
      });
    },
    [isAdmin, isBlocked, showBlockedPosts]
  );

  const sortWithPinnedFirst = useCallback(
    <T extends { id: number; media_type?: string; first_air_date?: string }>(items: T[], page: string, defaultMediaType?: 'movie' | 'tv'): T[] => {
      const pinnedForPage = getPinnedPosts(page);
      if (pinnedForPage.length === 0) return items;

      const pinnedItems: T[] = [];
      const nonPinnedItems: T[] = [];

      items.forEach((item) => {
        const mediaType = (item.media_type || (item.first_air_date ? 'tv' : defaultMediaType || 'movie')) as 'movie' | 'tv';
        const pinned = pinnedForPage.some((p) => p.tmdb_id === String(item.id) && p.media_type === mediaType);
        (pinned ? pinnedItems : nonPinnedItems).push(item);
      });

      return [...pinnedItems, ...nonPinnedItems];
    },
    [getPinnedPosts]
  );

  return {
    isLoading,
    isBlocked,
    isPinned,
    getPinnedPage,
    blockPost,
    unblockPost,
    pinPost,
    unpinPost,
    getBlockedPosts,
    getPinnedPosts,
    filterBlockedPosts,
    sortWithPinnedFirst,
    moderatedPosts,
  };
};
