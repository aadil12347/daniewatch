import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { Movie } from '@/lib/tmdb';

interface WatchlistItem {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  vote_average: number;
  created_at: string;
}

export const useWatchlist = () => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch watchlist from Supabase
  const fetchWatchlist = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setWatchlist([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('watchlist')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWatchlist(data || []);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  // Check if item is in watchlist
  const isInWatchlist = useCallback((tmdbId: number, mediaType: 'movie' | 'tv') => {
    return watchlist.some(
      item => item.tmdb_id === tmdbId && item.media_type === mediaType
    );
  }, [watchlist]);

  // Add to watchlist
  const addToWatchlist = async (movie: Movie) => {
    if (!user) {
      toast({
        title: "Login required",
        variant: "destructive",
      });
      navigate('/auth');
      return false;
    }

    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const title = movie.title || movie.name || 'Unknown';

    // Optimistic update - add to local state immediately
    const newItem: WatchlistItem = {
      id: 'temp-' + movie.id,
      user_id: user.id,
      tmdb_id: movie.id,
      media_type: mediaType as 'movie' | 'tv',
      title: title,
      poster_path: movie.poster_path,
      vote_average: movie.vote_average || 0,
      created_at: new Date().toISOString(),
    };
    setWatchlist(prev => [newItem, ...prev]);

    toast({ title: "Added to watchlist" });

    try {
      const { error } = await supabase
        .from('watchlist')
        .insert({
          user_id: user.id,
          tmdb_id: movie.id,
          media_type: mediaType as 'movie' | 'tv',
          title: title,
          poster_path: movie.poster_path,
          vote_average: movie.vote_average || 0,
        });

      if (error && error.code !== '23505') {
        throw error;
      }

      // Background sync
      fetchWatchlist();
      return true;
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      // Revert optimistic update on error
      setWatchlist(prev => prev.filter(item => item.id !== 'temp-' + movie.id));
      toast({
        title: "Failed to save",
        variant: "destructive",
      });
      return false;
    }
  };

  // Remove from watchlist
  const removeFromWatchlist = async (tmdbId: number, mediaType: 'movie' | 'tv') => {
    if (!user) return false;

    // Optimistic update - remove from local state immediately
    const removedItems = watchlist.filter(
      item => item.tmdb_id === tmdbId && item.media_type === mediaType
    );
    setWatchlist(prev => prev.filter(
      item => !(item.tmdb_id === tmdbId && item.media_type === mediaType)
    ));

    toast({ title: "Removed from watchlist" });

    try {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('tmdb_id', tmdbId)
        .eq('media_type', mediaType);

      if (error) throw error;

      // Background sync
      fetchWatchlist();
      return true;
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      // Revert optimistic update on error
      setWatchlist(prev => [...removedItems, ...prev]);
      toast({
        title: "Failed to remove",
        variant: "destructive",
      });
      return false;
    }
  };

  // Toggle watchlist
  const toggleWatchlist = async (movie: Movie) => {
    const mediaType: 'movie' | 'tv' = movie.media_type === 'tv' || movie.first_air_date ? 'tv' : 'movie';
    
    if (isInWatchlist(movie.id, mediaType)) {
      return removeFromWatchlist(movie.id, mediaType);
    } else {
      return addToWatchlist(movie);
    }
  };

  // Convert watchlist items to Movie format for display
  const getWatchlistAsMovies = (): Movie[] => {
    return watchlist.map(item => ({
      id: item.tmdb_id,
      title: item.media_type === 'movie' ? item.title : undefined,
      name: item.media_type === 'tv' ? item.title : undefined,
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      media_type: item.media_type,
      overview: '',
      backdrop_path: null,
      genre_ids: [],
      release_date: item.media_type === 'movie' ? '' : undefined,
      first_air_date: item.media_type === 'tv' ? '' : undefined,
    }));
  };

  return {
    watchlist,
    loading,
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    getWatchlistAsMovies,
    refetch: fetchWatchlist,
  };
};
