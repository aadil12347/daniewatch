import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Request {
  id: string;
  user_id: string;
  user_email: string | null;
  request_type: 'movie' | 'tv_season' | 'general';
  title: string;
  season_number: number | null;
  message: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  admin_response: string | null;
  tmdb_id: number | null;
  created_at: string;
  updated_at: string;
}

export const useRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRequests = async () => {
    if (!user || !isSupabaseConfigured) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data as Request[] || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createRequest = async (data: {
    request_type: 'movie' | 'tv_season' | 'general';
    title: string;
    season_number?: number;
    message: string;
    tmdb_id?: number;
  }) => {
    if (!user || !isSupabaseConfigured) return { error: new Error('Not authenticated') };

    try {
      // Insert the request with user email
      const { data: newRequest, error } = await supabase
        .from('requests')
        .insert({
          user_id: user.id,
          user_email: user.email,
          request_type: data.request_type,
          title: data.title,
          season_number: data.season_number || null,
          message: data.message,
          status: 'pending',
          tmdb_id: data.tmdb_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Create a notification for the user confirming submission
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Request Submitted',
        message: `Your request for "${data.title}" has been submitted and is pending review.`,
        type: 'request_updated',
        request_id: newRequest?.id || null,
      });

      await fetchRequests();
      return { error: null };
    } catch (error) {
      console.error('Error creating request:', error);
      return { error };
    }
  };

  const deleteRequest = async (requestId: string) => {
    if (!user || !isSupabaseConfigured) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', requestId)
        .eq('user_id', user.id);

      if (error) throw error;
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      return { error: null };
    } catch (error) {
      console.error('Error deleting request:', error);
      return { error };
    }
  };

  const clearAllRequests = async () => {
    if (!user || !isSupabaseConfigured) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      setRequests([]);
      return { error: null };
    } catch (error) {
      console.error('Error clearing requests:', error);
      return { error };
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  return {
    requests,
    isLoading,
    createRequest,
    deleteRequest,
    clearAllRequests,
    refetch: fetchRequests,
  };
};
