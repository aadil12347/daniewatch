import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const OWNER_EMAIL = 'mdaniyalaadil@gmail.com';

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'user';
  is_owner: boolean;
  email?: string;
  created_at: string;
}

export interface AdminRequest {
  id: string;
  user_id: string;
  request_type: 'movie' | 'tv_season' | 'general';
  title: string;
  season_number: number | null;
  message: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string;
}

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allRequests, setAllRequests] = useState<AdminRequest[]>([]);
  const [admins, setAdmins] = useState<UserRole[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  // Check if user is admin
  const checkAdminStatus = async () => {
    if (!user || !isSupabaseConfigured) {
      setIsAdmin(false);
      setIsOwner(false);
      setIsLoading(false);
      return;
    }

    try {
      // Check if user is owner by email
      const userIsOwner = user.email === OWNER_EMAIL;
      setIsOwner(userIsOwner);

      // Check user_roles table
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking admin status:', error);
        // If owner but not in table yet, still consider admin
        setIsAdmin(userIsOwner);
      } else {
        setIsAdmin(!!data || userIsOwner);
      }

      // If owner and not in user_roles, auto-add
      if (userIsOwner && !data) {
        await supabase.from('user_roles').upsert(
          {
            user_id: user.id,
            role: 'admin',
            is_owner: true,
          },
          { onConflict: 'user_id,role' }
        );
      }
    } catch (error) {
      console.error('Error in checkAdminStatus:', error);
      setIsAdmin(false);
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
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllRequests((data as AdminRequest[]) || []);

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

  return {
    isAdmin,
    isOwner,
    isLoading,
    allRequests,
    requestsError,
    admins,
    updateRequestStatus,
    addAdmin,
    removeAdmin,
    refetchRequests: fetchAllRequests,
    refetchAdmins: fetchAdmins,
  };
};
