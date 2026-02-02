import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAdminStatus } from "@/contexts/AdminStatusContext";

type EditLinksModeContextValue = {
  isEditLinksMode: boolean;
  setEditLinksMode: (next: boolean) => void;
  toggleEditLinksMode: () => void;

  isEditorOpen: boolean;
  editorTmdbId: string | null;
  openEditorForTmdbId: (tmdbId: string) => void;
  closeEditor: () => void;
};

const EditLinksModeContext = createContext<EditLinksModeContextValue | undefined>(undefined);

const STORAGE_KEY = "admin_edit_links_mode_v1";

const isTypingTarget = (el: Element | null) => {
  if (!el) return false;
  const tag = (el as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const htmlEl = el as HTMLElement;
  if (htmlEl.isContentEditable) return true;
  return false;
};

export function EditLinksModeProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAdminStatus();

  const [isEditLinksMode, _setEditLinksMode] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorTmdbId, setEditorTmdbId] = useState<string | null>(null);

  const hydratedRef = useRef(false);

  // Hydrate from sessionStorage once admin status is known.
  useEffect(() => {
    if (!isAdmin) {
      hydratedRef.current = false;
      _setEditLinksMode(false);
      setIsEditorOpen(false);
      setEditorTmdbId(null);
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }

    if (hydratedRef.current) return;
    hydratedRef.current = true;

    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      _setEditLinksMode(saved === "1");
    } catch {
      // ignore
    }
  }, [isAdmin]);

  // Persist edit mode for session (admin only).
  useEffect(() => {
    if (!isAdmin) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, isEditLinksMode ? "1" : "0");
    } catch {
      // ignore
    }
  }, [isAdmin, isEditLinksMode]);

  // Keyboard shortcut: Ctrl+Shift+E
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isAdmin) return;
      if (!e.ctrlKey || !e.shiftKey) return;
      if ((e.key || "").toLowerCase() !== "e") return;
      if (e.repeat) return;
      if (isTypingTarget(document.activeElement)) return;

      e.preventDefault();
      _setEditLinksMode((prev) => !prev);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAdmin]);

  const setEditLinksMode = useCallback(
    (next: boolean) => {
      if (!isAdmin) return;
      _setEditLinksMode(Boolean(next));
    },
    [isAdmin],
  );

  const toggleEditLinksMode = useCallback(() => {
    if (!isAdmin) return;
    _setEditLinksMode((prev) => !prev);
  }, [isAdmin]);

  const openEditorForTmdbId = useCallback(
    (tmdbId: string) => {
      if (!isAdmin) return;
      setEditorTmdbId(String(tmdbId));
      setIsEditorOpen(true);
    },
    [isAdmin],
  );

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
  }, []);

  const value = useMemo<EditLinksModeContextValue>(
    () => ({
      isEditLinksMode,
      setEditLinksMode,
      toggleEditLinksMode,

      isEditorOpen,
      editorTmdbId,
      openEditorForTmdbId,
      closeEditor,
    }),
    [closeEditor, editorTmdbId, isEditLinksMode, isEditorOpen, openEditorForTmdbId, setEditLinksMode, toggleEditLinksMode],
  );

  return <EditLinksModeContext.Provider value={value}>{children}</EditLinksModeContext.Provider>;
}

export function useEditLinksMode() {
  const ctx = useContext(EditLinksModeContext);
  if (!ctx) throw new Error("useEditLinksMode must be used within an EditLinksModeProvider");
  return ctx;
}
