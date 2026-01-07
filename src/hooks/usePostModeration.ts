import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAdmin } from './useAdmin';

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

export const usePostModeration = () => {
  const { isAdmin } = useAdmin();
  const [moderatedPosts, setModeratedPosts] = useState<PostModeration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage
  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(POST_MODERATION_STORAGE_KEY);
      if (stored) {
        setModeratedPosts(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading post moderation:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage
  const saveToStorage = useCallback((posts: PostModeration[]) => {
    try {
      localStorage.setItem(POST_MODERATION_STORAGE_KEY, JSON.stringify(posts));
    } catch (error) {
      console.error('Error saving post moderation:', error);
    }
  }, []);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Check if a post is blocked
  const isBlocked = useCallback((tmdbId: number | string, mediaType: 'movie' | 'tv') => {
    return moderatedPosts.some(
      p => p.tmdb_id === String(tmdbId) && p.media_type === mediaType && p.is_blocked
    );
  }, [moderatedPosts]);

  // Check if a post is pinned
  const isPinned = useCallback((tmdbId: number | string, mediaType: 'movie' | 'tv') => {
    return moderatedPosts.some(
      p => p.tmdb_id === String(tmdbId) && p.media_type === mediaType && p.is_pinned
    );
  }, [moderatedPosts]);

  // Get pinned page for a post
  const getPinnedPage = useCallback((tmdbId: number | string, mediaType: 'movie' | 'tv') => {
    const post = moderatedPosts.find(
      p => p.tmdb_id === String(tmdbId) && p.media_type === mediaType && p.is_pinned
    );
    return post?.pinned_page;
  }, [moderatedPosts]);

  // Block a post
  const blockPost = useCallback((
    tmdbId: number | string, 
    mediaType: 'movie' | 'tv',
    title?: string,
    posterPath?: string
  ) => {
    const id = String(tmdbId);
    setModeratedPosts(prev => {
      const existing = prev.find(p => p.tmdb_id === id && p.media_type === mediaType);
      let updated: PostModeration[];
      
      if (existing) {
        updated = prev.map(p => 
          p.tmdb_id === id && p.media_type === mediaType
            ? { ...p, is_blocked: true, blocked_at: new Date().toISOString(), title, poster_path: posterPath }
            : p
        );
      } else {
        updated = [...prev, {
          tmdb_id: id,
          media_type: mediaType,
          is_blocked: true,
          is_pinned: false,
          blocked_at: new Date().toISOString(),
          title,
          poster_path: posterPath,
        }];
      }
      
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Unblock a post
  const unblockPost = useCallback((tmdbId: number | string, mediaType: 'movie' | 'tv') => {
    const id = String(tmdbId);
    setModeratedPosts(prev => {
      const updated = prev.map(p => 
        p.tmdb_id === id && p.media_type === mediaType
          ? { ...p, is_blocked: false, blocked_at: undefined }
          : p
      ).filter(p => p.is_blocked || p.is_pinned); // Remove if neither blocked nor pinned
      
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Pin a post to a page
  const pinPost = useCallback((
    tmdbId: number | string, 
    mediaType: 'movie' | 'tv', 
    page: string,
    title?: string,
    posterPath?: string
  ) => {
    const id = String(tmdbId);
    setModeratedPosts(prev => {
      const existing = prev.find(p => p.tmdb_id === id && p.media_type === mediaType);
      let updated: PostModeration[];
      
      if (existing) {
        updated = prev.map(p => 
          p.tmdb_id === id && p.media_type === mediaType
            ? { ...p, is_pinned: true, pinned_page: page, pinned_at: new Date().toISOString(), title, poster_path: posterPath }
            : p
        );
      } else {
        updated = [...prev, {
          tmdb_id: id,
          media_type: mediaType,
          is_blocked: false,
          is_pinned: true,
          pinned_page: page,
          pinned_at: new Date().toISOString(),
          title,
          poster_path: posterPath,
        }];
      }
      
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Unpin a post
  const unpinPost = useCallback((tmdbId: number | string, mediaType: 'movie' | 'tv') => {
    const id = String(tmdbId);
    setModeratedPosts(prev => {
      const updated = prev.map(p => 
        p.tmdb_id === id && p.media_type === mediaType
          ? { ...p, is_pinned: false, pinned_page: undefined, pinned_at: undefined }
          : p
      ).filter(p => p.is_blocked || p.is_pinned); // Remove if neither blocked nor pinned
      
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Get all blocked posts
  const getBlockedPosts = useCallback(() => {
    return moderatedPosts.filter(p => p.is_blocked);
  }, [moderatedPosts]);

  // Get pinned posts for a specific page
  const getPinnedPosts = useCallback((page: string) => {
    return moderatedPosts.filter(p => p.is_pinned && p.pinned_page === page);
  }, [moderatedPosts]);

  // Filter out blocked posts from a list (for non-admins)
  const filterBlockedPosts = useCallback(<T extends { id: number; media_type?: string; first_air_date?: string }>(
    items: T[],
    defaultMediaType?: 'movie' | 'tv'
  ): T[] => {
    if (isAdmin) return items; // Admins see everything
    
    return items.filter(item => {
      const mediaType = (item.media_type || (item.first_air_date ? 'tv' : defaultMediaType || 'movie')) as 'movie' | 'tv';
      return !isBlocked(item.id, mediaType);
    });
  }, [isAdmin, isBlocked]);

  // Sort items with pinned posts first
  const sortWithPinnedFirst = useCallback(<T extends { id: number; media_type?: string; first_air_date?: string }>(
    items: T[],
    page: string,
    defaultMediaType?: 'movie' | 'tv'
  ): T[] => {
    const pinnedForPage = getPinnedPosts(page);
    
    if (pinnedForPage.length === 0) return items;
    
    const pinnedItems: T[] = [];
    const nonPinnedItems: T[] = [];
    
    items.forEach(item => {
      const mediaType = (item.media_type || (item.first_air_date ? 'tv' : defaultMediaType || 'movie')) as 'movie' | 'tv';
      const isPinnedItem = pinnedForPage.some(p => p.tmdb_id === String(item.id) && p.media_type === mediaType);
      
      if (isPinnedItem) {
        pinnedItems.push(item);
      } else {
        nonPinnedItems.push(item);
      }
    });
    
    return [...pinnedItems, ...nonPinnedItems];
  }, [getPinnedPosts]);

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
