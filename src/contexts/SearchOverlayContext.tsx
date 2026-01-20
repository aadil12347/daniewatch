import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

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

  const open = useCallback(({ query: q, scope: s }: OpenArgs) => {
    setQuery(q);
    setScope(s);
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
