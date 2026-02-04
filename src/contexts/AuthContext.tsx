import React from 'react';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { setTutorialFlag } from './TutorialContext';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, username?: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache cleanup utility
const clearAllCaches = () => {
  try {
    // Clear all session storage
    sessionStorage.clear();

    // Clear specific localStorage cache keys (preserve user preferences)
    const cachePatterns = [
      'homepage_cache',
      'list_state_cache',
      'admin_session_cache',
      'page_preload_cache',
      'navbar_search_open'
    ];

    Object.keys(localStorage).forEach(key => {
      if (cachePatterns.some(pattern => key.includes(pattern))) {
        localStorage.removeItem(key);
      }
    });

    console.log('✅ Cache cleared for fresh session');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Clear cache on app initialization (new session)
  useEffect(() => {
    const sessionId = sessionStorage.getItem('app_session_id');
    if (!sessionId) {
      // New session detected
      clearAllCaches();
      sessionStorage.setItem('app_session_id', Date.now().toString());
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Clear cache on sign out
        if (event === 'SIGNED_OUT') {
          clearAllCaches();
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

  const signOut = async () => {
    clearAllCaches();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
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
