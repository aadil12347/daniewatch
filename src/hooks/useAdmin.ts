import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// IMPORTANT SECURITY:
// - Roles are stored in the separate `user_roles` table.
// - Do NOT trust localStorage/sessionStorage or hardcoded emails for admin/owner checks.
// - Always validate via the database (and enforce access via RLS policies).

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'user';
  is_owner: boolean;
  email?: string;
  created_at: string;
}

export type RequestMeta = {
  tmdb_id: string;
  media_type: 'movie' | 'tv';
  poster_path?: string | null;
};

type AdminRequestRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  request_type: 'movie' | 'tv_season' | 'general';
  title: string;
  season_number: number | null;
  message: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  is_hidden_from_user?: boolean;
  closed_by?: 'user' | 'admin' | null;
  is_read?: boolean; // New column for tracking if admin has seen the request
  request_meta?: RequestMeta | RequestMeta[] | null;
};

export interface AdminRequest extends Omit<AdminRequestRow, 'request_meta'> {
  request_meta?: RequestMeta | null;
  unread_count?: number; // Calculated field
}

const normalizeRequestMeta = (meta: AdminRequestRow['request_meta']): RequestMeta | null => {
  if (!meta) return null;
  if (Array.isArray(meta)) return meta[0] ?? null;
  return meta;
};

const normalizeAdminRequest = (req: AdminRequestRow): AdminRequest => ({
  ...req,
  request_meta: normalizeRequestMeta(req.request_meta),
});

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allRequests, setAllRequests] = useState<AdminRequest[]>([]);
  const [admins, setAdmins] = useState<UserRole[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  // Check if user is admin/owner (database-driven; do not trust client-side checks)
  const checkAdminStatus = async () => {
    if (!user || !isSupabaseConfigured) {
      setIsAdmin(false);
      setIsOwner(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // NOTE: `is_owner` must exist on `user_roles` (boolean, default false)
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, is_owner')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) throw error;

      const adminStatus = !!data;
      setIsAdmin(adminStatus);
      setIsOwner(!!data?.is_owner);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
      setIsOwner(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all requests (admin only)
  const fetchAllRequests = async () => {
    if (!user || !isSupabaseConfigured) return;

    setRequestsError(null);

    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*, request_meta ( tmdb_id, media_type, poster_path )')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch unread message counts for all requests (from user, unread)
      const { data: unreadData, error: unreadError } = await supabase
        .from('request_messages')
        .select('request_id')
        .eq('sender_role', 'user')
        .is('read_at', null);

      if (unreadError) console.error('Error fetching unread counts:', unreadError);

      const unreadCounts = (unreadData || []).reduce((acc, msg) => {
        acc[msg.request_id] = (acc[msg.request_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const rows = (data as AdminRequestRow[]) || [];
      setAllRequests(rows.map(req => ({
        ...normalizeAdminRequest(req),
        unread_count: unreadCounts[req.id] || 0,
        is_read: req.is_read ?? false // Handle missing column gracefully-ish (might fail query if column doesn't exist)
      })));
      // If admin sees 0 rows, it's very often RLS policies blocking access.
      if ((data?.length ?? 0) === 0) {
        setRequestsError(
          'No requests returned. If users have submitted requests, this usually means Row Level Security (RLS) is blocking admin access on the requests table.'
        );
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to load requests.';
      setRequestsError(message);
      console.error('Error fetching all requests:', error);
    }
  };

  // Fetch all admins
  const fetchAdmins = async () => {
    if (!user || !isSupabaseConfigured) return;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAdmins(data as UserRole[] || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  // Update request status and send notification
  const updateRequestStatus = async (
    requestId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'rejected',
    adminResponse?: string
  ) => {
    if (!user || !isSupabaseConfigured) return { error: new Error('Not authenticated') };

    try {
      // Update first (single round-trip) and return the updated row for notification
      const { data: updated, error: updateError } = await supabase
        .from('requests')
        .update({
          status,
          ...(adminResponse !== undefined ? { admin_response: adminResponse } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select('*')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) throw new Error('Request not found or access denied.');

      // Create notification for user (best-effort)
      const notificationTitle =
        status === 'completed'
          ? 'Request Approved!'
          : status === 'rejected'
            ? 'Request Update'
            : 'Request Status Updated';

      const notificationMessage = adminResponse
        ? `Your request for "${updated.title}" has been ${status}. Admin response: ${adminResponse}`
        : `Your request for "${updated.title}" has been updated to: ${status}`;

      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: updated.user_id,
        title: notificationTitle,
        message: notificationMessage,
        type:
          status === 'completed'
            ? 'request_approved'
            : status === 'rejected'
              ? 'request_rejected'
              : 'request_updated',
        request_id: requestId,
      });

      if (notifError) console.error('Error creating notification:', notifError);

      await fetchAllRequests();
      return { error: null };
    } catch (error) {
      console.error('Error updating request:', error);
      return { error };
    }
  };

  // Update multiple requests status at once
  const updateMultipleRequestsStatus = async (
    requestIds: string[],
    status: 'pending' | 'in_progress' | 'completed' | 'rejected',
    adminResponse?: string
  ) => {
    if (!user || !isSupabaseConfigured || !isAdmin) {
      return { error: new Error('Not authorized') };
    }

    try {
      // Update all requests
      const { error: updateError } = await supabase
        .from('requests')
        .update({
          status,
          ...(adminResponse !== undefined ? { admin_response: adminResponse } : {}),
          updated_at: new Date().toISOString(),
        })
        .in('id', requestIds);

      if (updateError) throw updateError;

      // Fetch updated requests for notifications
      const { data: updatedRequests, error: fetchError } = await supabase
        .from('requests')
        .select('*')
        .in('id', requestIds);

      if (fetchError) throw fetchError;

      // Create notifications for each user
      if (updatedRequests) {
        const notificationTitle =
          status === 'completed'
            ? 'Request Approved!'
            : status === 'rejected'
              ? 'Request Update'
              : 'Request Status Updated';

        const notifications = updatedRequests.map((req) => ({
          user_id: req.user_id,
          title: notificationTitle,
          message: adminResponse
            ? `Your request for "${req.title}" has been ${status}. Admin response: ${adminResponse}`
            : `Your request for "${req.title}" has been updated to: ${status}`,
          type:
            status === 'completed'
              ? 'request_approved'
              : status === 'rejected'
                ? 'request_rejected'
                : 'request_updated',
          request_id: req.id,
        }));

        const { error: notifError } = await supabase.from('notifications').insert(notifications);
        if (notifError) console.error('Error creating notifications:', notifError);
      }

      await fetchAllRequests();
      return { error: null, count: requestIds.length };
    } catch (error) {
      console.error('Error updating multiple requests:', error);
      return { error };
    }
  };

  // Delete a single request
  const deleteRequest = async (requestId: string) => {
    if (!user || !isSupabaseConfigured || !isAdmin) {
      return { error: new Error('Not authorized') };
    }

    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;
      setAllRequests((prev) => prev.filter((r) => r.id !== requestId));
      return { error: null };
    } catch (error) {
      console.error('Error deleting request:', error);
      return { error };
    }
  };

  // Delete multiple requests
  const deleteRequests = async (requestIds: string[]) => {
    if (!user || !isSupabaseConfigured || !isAdmin) {
      return { error: new Error('Not authorized') };
    }

    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .in('id', requestIds);

      if (error) throw error;
      setAllRequests((prev) => prev.filter((r) => !requestIds.includes(r.id)));
      return { error: null };
    } catch (error) {
      console.error('Error deleting requests:', error);
      return { error };
    }
  };

  // Close Chat (Admin Permanent)
  const closeRequestChat = async (requestId: string) => {
    if (!user || !isSupabaseConfigured || !isAdmin) return { error: new Error('Not authorized') };

    try {
      const { error } = await supabase
        .from('requests')
        .update({
          closed_by: 'admin',
          status: 'completed' // Also mark as completed when admin closes
        })
        .eq('id', requestId);

      if (error) throw error;

      // Clear all admin-related caches
      try {
        sessionStorage.removeItem('admin_session_cache');
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes('admin') || key.includes('request')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.warn('Cache clear warning:', e);
      }

      setAllRequests((prev) => prev.map(r => r.id === requestId ? { ...r, closed_by: 'admin', status: 'completed' } : r));
      return { error: null };
    } catch (error) {
      console.error('Error closing chat (admin):', error);
      return { error };
    }
  };

  // Reopen Chat
  const reopenRequestChat = async (requestId: string) => {
    if (!user || !isSupabaseConfigured || !isAdmin) return { error: new Error('Not authorized') };

    try {
      const { error } = await supabase
        .from('requests')
        .update({ closed_by: null })
        .eq('id', requestId);

      if (error) throw error;

      // Clear all admin-related caches
      try {
        sessionStorage.removeItem('admin_session_cache');
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes('admin') || key.includes('request')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.warn('Cache clear warning:', e);
      }

      setAllRequests((prev) => prev.map(r => r.id === requestId ? { ...r, closed_by: null } : r));
      return { error: null };
    } catch (error) {
      console.error('Error reopening chat (admin):', error);
      return { error };
    }
  };

  // Mark request as seen (admin opened it)
  const markRequestAsSeen = async (requestId: string) => {
    if (!user || !isSupabaseConfigured || !isAdmin) return;

    try {
      const { error } = await supabase
        .from('requests')
        .update({ is_read: true })
        .eq('id', requestId);

      if (error) throw error;

      setAllRequests(prev => prev.map(r => r.id === requestId ? { ...r, is_read: true } : r));
    } catch (error) {
      // If column doesn't exist, this might fail silently or log, which is acceptable for now
      console.error('Error marking request as seen:', error);
    }
  };

  // Clear all requests
  const clearAllRequests = async () => {
    if (!user || !isSupabaseConfigured || !isAdmin) {
      return { error: new Error('Not authorized') };
    }

    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;
      setAllRequests([]);
      return { error: null };
    } catch (error) {
      console.error('Error clearing requests:', error);
      return { error };
    }
  };

  // Add new admin
  const addAdmin = async (email: string) => {
    if (!user || !isSupabaseConfigured || !isOwner) {
      return { error: new Error('Not authorized') };
    }

    try {
      // Find user by email - we need to search in auth.users which we can't access directly
      // Instead, we'll store the email and user_id will be set when they sign in
      // For now, we'll use a workaround by checking if user exists

      const { data: existingUser, error: searchError } = await supabase
        .rpc('get_user_id_by_email', { email_input: email });

      if (searchError) {
        // If function doesn't exist, inform user
        console.error('Error finding user:', searchError);
        return { error: new Error('User not found. They must sign in at least once first.') };
      }

      if (!existingUser) {
        return { error: new Error('User not found. They must sign in at least once first.') };
      }

      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: existingUser,
          role: 'admin',
          is_owner: false,
        }, { onConflict: 'user_id,role' });

      if (error) throw error;

      await fetchAdmins();
      return { error: null };
    } catch (error) {
      console.error('Error adding admin:', error);
      return { error };
    }
  };

  // Remove admin
  const removeAdmin = async (userId: string) => {
    if (!user || !isSupabaseConfigured || !isOwner) {
      return { error: new Error('Not authorized') };
    }

    try {
      // Check if trying to remove owner
      const adminToRemove = admins.find(a => a.user_id === userId);
      if (adminToRemove?.is_owner) {
        return { error: new Error('Cannot remove the owner admin') };
      }

      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (error) throw error;

      await fetchAdmins();
      return { error: null };
    } catch (error) {
      console.error('Error removing admin:', error);
      return { error };
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      fetchAllRequests();
      fetchAdmins();
    }
  }, [isAdmin]);

  // Real-time subscription for requests
  // Real-time subscription - DISABLED per user request to stop auto-refreshing
  /* 
  useEffect(() => {
    if (!isAdmin || !isSupabaseConfigured) return;
    
    // ... code disabled ...
  }, [isAdmin]); 
  */

  return {
    isAdmin,
    isOwner,
    isLoading,
    allRequests,
    requestsError,
    admins,
    updateRequestStatus,
    updateMultipleRequestsStatus,
    deleteRequest,
    deleteRequests,
    clearAllRequests,
    closeRequestChat,
    reopenRequestChat,
    markRequestAsSeen,
    addAdmin,
    removeAdmin,
    refetchRequests: fetchAllRequests,
    refetchAdmins: fetchAdmins,
  };
};
