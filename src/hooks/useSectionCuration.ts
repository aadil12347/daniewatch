import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminStatus } from "@/contexts/AdminStatusContext";
import type { Movie } from "@/lib/tmdb";

interface CuratedItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  sortOrder: number;
  isPinned: boolean;
  title: string | null;
  posterPath: string | null;
}

interface UseSectionCurationReturn {
  curatedItems: CuratedItem[];
  isLoading: boolean;
  addToSection: (tmdbId: number, mediaType: "movie" | "tv", metadata?: { title?: string; posterPath?: string }) => Promise<void>;
  removeFromSection: (tmdbId: number, mediaType: "movie" | "tv") => Promise<void>;
  pinToTop: (tmdbId: number, mediaType: "movie" | "tv", metadata?: { title?: string; posterPath?: string }) => Promise<void>;
  unpinFromTop: (tmdbId: number, mediaType: "movie" | "tv") => Promise<void>;
  resetSection: () => Promise<void>;
  getCuratedItems: (originalItems: Movie[]) => Movie[];
  hasCuration: boolean;
}

export function useSectionCuration(sectionId: string | undefined): UseSectionCurationReturn {
  const { isAdmin } = useAdminStatus();
  const [curatedItems, setCuratedItems] = useState<CuratedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch curated items for the section
  useEffect(() => {
    if (!sectionId) {
      setCuratedItems([]);
      return;
    }

    let cancelled = false;

    const fetchCuration = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("section_curation")
          .select("tmdb_id, media_type, sort_order, is_pinned, title, poster_path")
          .eq("section_id", sectionId)
          .order("sort_order", { ascending: true });

        if (error) {
          console.error("Failed to fetch section curation:", error);
          return;
        }

        if (!cancelled && data) {
          setCuratedItems(
            data.map((row) => ({
              tmdbId: row.tmdb_id,
              mediaType: row.media_type as "movie" | "tv",
              sortOrder: row.sort_order,
              isPinned: row.is_pinned ?? false,
              title: row.title,
              posterPath: row.poster_path,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch section curation:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchCuration();

    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  const addToSection = useCallback(
    async (tmdbId: number, mediaType: "movie" | "tv", metadata?: { title?: string; posterPath?: string }) => {
      if (!sectionId || !isAdmin) return;

      // Optimistic update: add at position 0
      setCuratedItems((prev) => {
        const existing = prev.find((it) => it.tmdbId === tmdbId && it.mediaType === mediaType);
        if (existing) return prev;

        return [
          {
            tmdbId,
            mediaType,
            sortOrder: 0,
            isPinned: false,
            title: metadata?.title ?? null,
            posterPath: metadata?.posterPath ?? null,
          },
          ...prev.map((it) => ({ ...it, sortOrder: it.sortOrder + 1 })),
        ];
      });

      try {
        // First, bump all existing sort_orders up by 1
        const { data: existing } = await supabase
          .from("section_curation")
          .select("id, sort_order")
          .eq("section_id", sectionId);

        if (existing && existing.length > 0) {
          await Promise.all(
            existing.map((row) =>
              supabase
                .from("section_curation")
                .update({ sort_order: row.sort_order + 1 })
                .eq("id", row.id)
            )
          );
        }

        // Insert the new item at position 0
        const { error } = await supabase.from("section_curation").insert({
          section_id: sectionId,
          tmdb_id: tmdbId,
          media_type: mediaType,
          sort_order: 0,
          is_pinned: false,
          title: metadata?.title ?? null,
          poster_path: metadata?.posterPath ?? null,
        });

        if (error) {
          console.error("Failed to add to section:", error);
        }
      } catch (err) {
        console.error("Failed to add to section:", err);
      }
    },
    [sectionId, isAdmin]
  );

  const removeFromSection = useCallback(
    async (tmdbId: number, mediaType: "movie" | "tv") => {
      if (!sectionId || !isAdmin) return;

      // Optimistic update
      setCuratedItems((prev) => prev.filter((it) => !(it.tmdbId === tmdbId && it.mediaType === mediaType)));

      try {
        const { error } = await supabase
          .from("section_curation")
          .delete()
          .eq("section_id", sectionId)
          .eq("tmdb_id", tmdbId)
          .eq("media_type", mediaType);

        if (error) {
          console.error("Failed to remove from section:", error);
        }
      } catch (err) {
        console.error("Failed to remove from section:", err);
      }
    },
    [sectionId, isAdmin]
  );

  const pinToTop = useCallback(
    async (tmdbId: number, mediaType: "movie" | "tv", metadata?: { title?: string; posterPath?: string }) => {
      if (!sectionId || !isAdmin) return;

      // Optimistic update
      setCuratedItems((prev) => {
        const existing = prev.find((it) => it.tmdbId === tmdbId && it.mediaType === mediaType);
        if (existing) {
          return prev.map((it) =>
            it.tmdbId === tmdbId && it.mediaType === mediaType ? { ...it, isPinned: true, sortOrder: -1 } : it
          );
        }
        return [
          {
            tmdbId,
            mediaType,
            sortOrder: -1,
            isPinned: true,
            title: metadata?.title ?? null,
            posterPath: metadata?.posterPath ?? null,
          },
          ...prev,
        ];
      });

      try {
        const { error } = await supabase.from("section_curation").upsert(
          {
            section_id: sectionId,
            tmdb_id: tmdbId,
            media_type: mediaType,
            sort_order: -1,
            is_pinned: true,
            title: metadata?.title ?? null,
            poster_path: metadata?.posterPath ?? null,
          },
          { onConflict: "section_id,tmdb_id,media_type" }
        );

        if (error) {
          console.error("Failed to pin to top:", error);
        }
      } catch (err) {
        console.error("Failed to pin to top:", err);
      }
    },
    [sectionId, isAdmin]
  );

  const unpinFromTop = useCallback(
    async (tmdbId: number, mediaType: "movie" | "tv") => {
      if (!sectionId || !isAdmin) return;

      // Optimistic update
      setCuratedItems((prev) =>
        prev.map((it) => (it.tmdbId === tmdbId && it.mediaType === mediaType ? { ...it, isPinned: false, sortOrder: 0 } : it))
      );

      try {
        const { error } = await supabase
          .from("section_curation")
          .update({ is_pinned: false, sort_order: 0 })
          .eq("section_id", sectionId)
          .eq("tmdb_id", tmdbId)
          .eq("media_type", mediaType);

        if (error) {
          console.error("Failed to unpin from top:", error);
        }
      } catch (err) {
        console.error("Failed to unpin from top:", err);
      }
    },
    [sectionId, isAdmin]
  );

  const resetSection = useCallback(async () => {
    if (!sectionId || !isAdmin) return;

    // Optimistic update
    setCuratedItems([]);

    try {
      const { error } = await supabase.from("section_curation").delete().eq("section_id", sectionId);

      if (error) {
        console.error("Failed to reset section:", error);
      }
    } catch (err) {
      console.error("Failed to reset section:", err);
    }
  }, [sectionId, isAdmin]);

  const getCuratedItems = useCallback(
    (originalItems: Movie[]): Movie[] => {
      if (curatedItems.length === 0) return originalItems;

      const getKey = (m: Movie) => {
        const media = m.media_type || (m.first_air_date ? "tv" : "movie");
        return `${m.id}-${media}`;
      };

      // Build map of original items
      const originalByKey = new Map<string, Movie>();
      for (const m of originalItems) {
        originalByKey.set(getKey(m), m);
      }

      // Separate pinned and non-pinned curated items
      const pinnedCurated = curatedItems.filter((c) => c.isPinned).sort((a, b) => a.sortOrder - b.sortOrder);
      const regularCurated = curatedItems.filter((c) => !c.isPinned).sort((a, b) => a.sortOrder - b.sortOrder);

      // Build curated keys set
      const curatedKeys = new Set(curatedItems.map((c) => `${c.tmdbId}-${c.mediaType}`));

      // Build result: pinned first, then regular curated, then remaining original
      const result: Movie[] = [];

      // Add pinned items first
      for (const c of pinnedCurated) {
        const key = `${c.tmdbId}-${c.mediaType}`;
        const original = originalByKey.get(key);
        if (original) {
          result.push({ ...original, _isPinned: true } as Movie);
        } else {
          // Item not in original list - create stub from curation data
          result.push({
            id: c.tmdbId,
            media_type: c.mediaType,
            title: c.title || "Unknown",
            name: c.title || "Unknown",
            poster_path: c.posterPath,
            _isPinned: true,
            _isCurated: true,
          } as unknown as Movie);
        }
      }

      // Add regular curated items
      for (const c of regularCurated) {
        const key = `${c.tmdbId}-${c.mediaType}`;
        const original = originalByKey.get(key);
        if (original) {
          result.push({ ...original, _isCurated: true } as Movie);
        } else {
          result.push({
            id: c.tmdbId,
            media_type: c.mediaType,
            title: c.title || "Unknown",
            name: c.title || "Unknown",
            poster_path: c.posterPath,
            _isCurated: true,
          } as unknown as Movie);
        }
      }

      // Add remaining original items (not in curation)
      for (const m of originalItems) {
        if (!curatedKeys.has(getKey(m))) {
          result.push(m);
        }
      }

      return result;
    },
    [curatedItems]
  );

  const hasCuration = useMemo(() => curatedItems.length > 0, [curatedItems]);

  return {
    curatedItems,
    isLoading,
    addToSection,
    removeFromSection,
    pinToTop,
    unpinFromTop,
    resetSection,
    getCuratedItems,
    hasCuration,
  };
}
