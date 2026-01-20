import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type SearchScope = "anime" | "korean" | "movies" | "tv" | "watchlist" | "global";

type OpenArgs = {
  query: string;
  scope: SearchScope;
};

type SearchOverlayState = {
  isOpen: boolean;
  query: string;
  scope: SearchScope;
  open: (args: OpenArgs) => void;
  close: () => void;
  setQuery: (q: string) => void;
};

const SearchOverlayContext = createContext<SearchOverlayState | null>(null);

export const getSearchScopeForPathname = (pathname: string): SearchScope => {
  if (pathname.startsWith("/anime")) return "anime";
  if (pathname.startsWith("/korean")) return "korean";
  if (pathname.startsWith("/watchlist")) return "watchlist";
  if (pathname === "/movies" || pathname.startsWith("/movie/")) return "movies";
  if (pathname === "/tv" || pathname.startsWith("/tv/")) return "tv";
  return "global";
};

export const SearchOverlayProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("global");

  const isOpenRef = useRef(false);
  const shouldPushHistoryRef = useRef(false);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Close overlay on browser/device back, without navigating away.
  useEffect(() => {
    if (!isOpen) return;

    const onPopState = () => {
      // If the overlay is open, treat back as "close search results".
      setIsOpen(false);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isOpen]);

  // Add a history entry when opening so that a single Back press closes the overlay.
  useEffect(() => {
    if (!isOpen) return;
    if (!shouldPushHistoryRef.current) return;

    shouldPushHistoryRef.current = false;

    try {
      window.history.pushState({ __searchOverlay: true }, "", window.location.href);
    } catch {
      // ignore
    }
  }, [isOpen]);

  const open = useCallback(({ query: q, scope: s }: OpenArgs) => {
    setQuery(q);
    setScope(s);
    if (!isOpenRef.current) {
      shouldPushHistoryRef.current = true;
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo<SearchOverlayState>(
    () => ({
      isOpen,
      query,
      scope,
      open,
      close,
      setQuery,
    }),
    [isOpen, query, scope, open, close]
  );

  return <SearchOverlayContext.Provider value={value}>{children}</SearchOverlayContext.Provider>;
};

export const useSearchOverlay = (): SearchOverlayState => {
  const ctx = useContext(SearchOverlayContext);
  if (!ctx) throw new Error("useSearchOverlay must be used within SearchOverlayProvider");
  return ctx;
};
