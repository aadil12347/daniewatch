import React from 'react';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { setTutorialFlag } from './TutorialContext';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isRecoveryMode: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, username?: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache cleanup utility - ONLY called on explicit sign out
const clearAllCaches = () => {
  try {
    // List of keys to clear from sessionStorage (targeted instead of .clear())
    const sessionKeysToClear = [
      'admin_db_manifest_cache',
      'db_manifest_cache',
      'navbar_search_open',
      'manifest_session_checked',
      'admin_session_active'
    ];

    sessionKeysToClear.forEach(key => {
      sessionStorage.removeItem(key);
    });

    // Clear specific localStorage cache keys (preserve user preferences and auth)
    const cachePatterns = [
      'homepage_cache',
      'list_state_cache',
      'admin_session_cache',
      'page_preload_cache',
      'navbar_search_open',
      'admin',
      'request',
      'db_manifest_cache'
    ];

    Object.keys(localStorage).forEach(key => {
      // NEVER clear Supabase auth keys - these keep the user logged in
      if (key.includes('supabase') || key.includes('sb-')) {
        return;
      }
      if (cachePatterns.some(pattern => key.includes(pattern))) {
        localStorage.removeItem(key);
      }
    });

    console.log('✅ Targeted cache cleared for fresh session');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // REMOVED: Aggressive "new session" detection that was logging users out
  // on app updates/reloads. Session persistence is now handled entirely by
  // Supabase's auth storage in localStorage.

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only clear cache on explicit SIGN_OUT - NOT on SIGNED_IN or TOKEN_REFRESHED
        // TOKEN_REFRESHED is normal background activity and should never wipe caches
        // SIGNED_IN should not clear caches as user may have existing session data
        if (event === 'SIGNED_OUT') {
          clearAllCaches();
        }

        // Detect password recovery flow (user clicked reset link in email)
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoveryMode(true);
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Detect new OAuth users (Google sign-up) and trigger tutorial
        // Only if they haven't already completed the tutorial
        if (event === 'SIGNED_IN' && session?.user) {
          const hasCompletedTutorial = localStorage.getItem('daniewatch_tutorial_completed') === 'true';

          if (!hasCompletedTutorial) {
            const createdAt = new Date(session.user.created_at).getTime();
            const now = Date.now();
            const isNewUser = (now - createdAt) < 60000; // Created within 60 seconds

            // Check if OAuth provider (not email/password)
            const isOAuthUser = session.user.app_metadata?.provider !== 'email';

            if (isNewUser && isOAuthUser) {
              setTimeout(() => setTutorialFlag(), 0);
            }
          }
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUpWithEmail = async (email: string, password: string, username?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          username: username || email.split('@')[0],
          display_name: username || email.split('@')[0],
        },
      },
    });
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (!error) {
      setIsRecoveryMode(false);
    }
    return { error };
  };

  const signOut = async () => {
    clearAllCaches();
    setIsRecoveryMode(false);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isRecoveryMode,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      updatePassword,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
