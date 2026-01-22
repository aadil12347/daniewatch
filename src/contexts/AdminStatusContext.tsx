import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AdminStatus = {
  isAdmin: boolean;
  isOwner: boolean;
  isLoading: boolean;
};

const AdminStatusContext = createContext<AdminStatus | undefined>(undefined);

export const AdminStatusProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user || !isSupabaseConfigured) {
        if (cancelled) return;
        setIsAdmin(false);
        setIsOwner(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role, is_owner")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (error) throw error;
        if (cancelled) return;

        setIsAdmin(Boolean(data));
        setIsOwner(Boolean(data?.is_owner));
      } catch {
        if (cancelled) return;
        setIsAdmin(false);
        setIsOwner(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo(() => ({ isAdmin, isOwner, isLoading }), [isAdmin, isOwner, isLoading]);
  return <AdminStatusContext.Provider value={value}>{children}</AdminStatusContext.Provider>;
};

export const useAdminStatus = () => {
  const ctx = useContext(AdminStatusContext);
  if (!ctx) throw new Error("useAdminStatus must be used within an AdminStatusProvider");
  return ctx;
};
