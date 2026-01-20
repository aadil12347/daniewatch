import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type AdminContentVisibilityContextValue = {
  showBlockedPosts: boolean;
  setShowBlockedPosts: (next: boolean) => void;
  toggleShowBlockedPosts: () => void;
};

const AdminContentVisibilityContext = createContext<AdminContentVisibilityContextValue | null>(null);

const STORAGE_KEY = "admin_show_blocked_posts";

export const AdminContentVisibilityProvider = ({ children }: { children: React.ReactNode }) => {
  const [showBlockedPosts, setShowBlockedPostsState] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) return;
      setShowBlockedPostsState(stored === "1");
    } catch {
      // ignore
    }
  }, []);

  const setShowBlockedPosts = (next: boolean) => {
    setShowBlockedPostsState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const value = useMemo<AdminContentVisibilityContextValue>(
    () => ({
      showBlockedPosts,
      setShowBlockedPosts,
      toggleShowBlockedPosts: () => setShowBlockedPosts(!showBlockedPosts),
    }),
    [showBlockedPosts]
  );

  return <AdminContentVisibilityContext.Provider value={value}>{children}</AdminContentVisibilityContext.Provider>;
};

export const useAdminContentVisibility = () => {
  const ctx = useContext(AdminContentVisibilityContext);
  if (!ctx) {
    throw new Error("useAdminContentVisibility must be used within AdminContentVisibilityProvider");
  }
  return ctx;
};
