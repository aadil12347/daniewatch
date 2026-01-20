import React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type AdminListFilterContextValue = {
  showOnlyDbLinked: boolean;
  setShowOnlyDbLinked: (next: boolean) => void;
  toggleShowOnlyDbLinked: () => void;
};

const AdminListFilterContext = createContext<AdminListFilterContextValue | null>(null);

const STORAGE_KEY = "admin_show_only_db_linked";

export const AdminListFilterProvider = ({ children }: { children: React.ReactNode }) => {
  const [showOnlyDbLinked, setShowOnlyDbLinkedState] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) return;
      setShowOnlyDbLinkedState(stored === "1");
    } catch {
      // ignore
    }
  }, []);

  const setShowOnlyDbLinked = (next: boolean) => {
    setShowOnlyDbLinkedState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const value = useMemo<AdminListFilterContextValue>(
    () => ({
      showOnlyDbLinked,
      setShowOnlyDbLinked,
      toggleShowOnlyDbLinked: () => setShowOnlyDbLinked(!showOnlyDbLinked),
    }),
    [showOnlyDbLinked]
  );

  return <AdminListFilterContext.Provider value={value}>{children}</AdminListFilterContext.Provider>;
};

export const useAdminListFilter = () => {
  const ctx = useContext(AdminListFilterContext);
  if (!ctx) {
    throw new Error("useAdminListFilter must be used within AdminListFilterProvider");
  }
  return ctx;
};
