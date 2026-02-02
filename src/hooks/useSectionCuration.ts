import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

interface ReorderItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
}

interface UseSectionCurationReturn {
  curatedItems: CuratedItem[];
  isLoading: boolean;
  addToSection: (tmdbId: number, mediaType: "movie" | "tv", metadata?: { title?: string; posterPath?: string }) => void;
  removeFromSection: (tmdbId: number, mediaType: "movie" | "tv") => void;
  pinToTop: (tmdbId: number, mediaType: "movie" | "tv", metadata?: { title?: string; posterPath?: string }) => void;
  unpinFromTop: (tmdbId: number, mediaType: "movie" | "tv") => void;
  resetSection: () => void;
  reorderSection: (orderedItems: ReorderItem[]) => void;
  getCuratedItems: (originalItems: Movie[]) => Movie[];
  hasCuration: boolean;
}

const QUERY_KEY_PREFIX = "section_curation";

export function useSectionCuration(sectionId: string | undefined): UseSectionCurationReturn {
  const { isAdmin } = useAdminStatus();
  const queryClient = useQueryClient();
  const queryKey = [QUERY_KEY_PREFIX, sectionId];

  // Fetch curated items using React Query
  const { data: curatedItems = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!sectionId) return [];

      const { data, error } = await supabase
        .from("section_curation")
        .select("tmdb_id, media_type, sort_order, is_pinned, title, poster_path")
        .eq("section_id", sectionId)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Failed to fetch section curation:", error);
        return [];
      }

      return (data || []).map((row) => ({
        tmdbId: row.tmdb_id,
        mediaType: row.media_type as "movie" | "tv",
        sortOrder: row.sort_order,
        isPinned: row.is_pinned ?? false,
        title: row.title,
        posterPath: row.poster_path,
      }));
    },
    enabled: !!sectionId,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

  // Add to section mutation
  const addMutation = useMutation({
    mutationFn: async ({ tmdbId, mediaType, metadata }: { tmdbId: number; mediaType: "movie" | "tv"; metadata?: { title?: string; posterPath?: string } }) => {
      if (!sectionId) throw new Error("No section ID");

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

      if (error) throw error;
    },
    onMutate: async ({ tmdbId, mediaType, metadata }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CuratedItem[]>(queryKey);

      queryClient.setQueryData<CuratedItem[]>(queryKey, (old = []) => {
        const existing = old.find((it) => it.tmdbId === tmdbId && it.mediaType === mediaType);
        if (existing) return old;

        return [
          {
            tmdbId,
            mediaType,
            sortOrder: 0,
            isPinned: false,
            title: metadata?.title ?? null,
            posterPath: metadata?.posterPath ?? null,
          },
          ...old.map((it) => ({ ...it, sortOrder: it.sortOrder + 1 })),
        ];
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Remove from section mutation
  const removeMutation = useMutation({
    mutationFn: async ({ tmdbId, mediaType }: { tmdbId: number; mediaType: "movie" | "tv" }) => {
      if (!sectionId) throw new Error("No section ID");

      const { error } = await supabase
        .from("section_curation")
        .delete()
        .eq("section_id", sectionId)
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType);

      if (error) throw error;
    },
    onMutate: async ({ tmdbId, mediaType }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CuratedItem[]>(queryKey);

      queryClient.setQueryData<CuratedItem[]>(queryKey, (old = []) =>
        old.filter((it) => !(it.tmdbId === tmdbId && it.mediaType === mediaType))
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Pin to top mutation
  const pinMutation = useMutation({
    mutationFn: async ({ tmdbId, mediaType, metadata }: { tmdbId: number; mediaType: "movie" | "tv"; metadata?: { title?: string; posterPath?: string } }) => {
      if (!sectionId) throw new Error("No section ID");

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

      if (error) throw error;
    },
    onMutate: async ({ tmdbId, mediaType, metadata }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CuratedItem[]>(queryKey);

      queryClient.setQueryData<CuratedItem[]>(queryKey, (old = []) => {
        const existing = old.find((it) => it.tmdbId === tmdbId && it.mediaType === mediaType);
        if (existing) {
          return old.map((it) =>
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
          ...old,
        ];
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Unpin mutation
  const unpinMutation = useMutation({
    mutationFn: async ({ tmdbId, mediaType }: { tmdbId: number; mediaType: "movie" | "tv" }) => {
      if (!sectionId) throw new Error("No section ID");

      const { error } = await supabase
        .from("section_curation")
        .update({ is_pinned: false, sort_order: 0 })
        .eq("section_id", sectionId)
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType);

      if (error) throw error;
    },
    onMutate: async ({ tmdbId, mediaType }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CuratedItem[]>(queryKey);

      queryClient.setQueryData<CuratedItem[]>(queryKey, (old = []) =>
        old.map((it) => (it.tmdbId === tmdbId && it.mediaType === mediaType ? { ...it, isPinned: false, sortOrder: 0 } : it))
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Reset section mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!sectionId) throw new Error("No section ID");

      const { error } = await supabase.from("section_curation").delete().eq("section_id", sectionId);

      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CuratedItem[]>(queryKey);

      queryClient.setQueryData<CuratedItem[]>(queryKey, []);

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Reorder section mutation
  const reorderMutation = useMutation({
    mutationFn: async (orderedItems: ReorderItem[]) => {
      if (!sectionId) throw new Error("No section ID");

      // Batch update all sort_orders
      const updates = orderedItems.map((item, index) =>
        supabase
          .from("section_curation")
          .update({ sort_order: index })
          .eq("section_id", sectionId)
          .eq("tmdb_id", item.tmdbId)
          .eq("media_type", item.mediaType)
      );

      await Promise.all(updates);
    },
    onMutate: async (orderedItems) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CuratedItem[]>(queryKey);

      queryClient.setQueryData<CuratedItem[]>(queryKey, (old = []) => {
        const itemMap = new Map(old.map((item) => [`${item.tmdbId}-${item.mediaType}`, item]));
        const reordered: CuratedItem[] = [];

        orderedItems.forEach((item, index) => {
          const key = `${item.tmdbId}-${item.mediaType}`;
          const existing = itemMap.get(key);
          if (existing) {
            reordered.push({ ...existing, sortOrder: index });
          }
        });

        // Include any items not in the ordered list
        old.forEach((item) => {
          const key = `${item.tmdbId}-${item.mediaType}`;
          if (!orderedItems.some((o) => `${o.tmdbId}-${o.mediaType}` === key)) {
            reordered.push(item);
          }
        });

        return reordered;
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Wrapper functions
  const addToSection = useCallback(
    (tmdbId: number, mediaType: "movie" | "tv", metadata?: { title?: string; posterPath?: string }) => {
      if (!sectionId || !isAdmin) return;
      addMutation.mutate({ tmdbId, mediaType, metadata });
    },
    [sectionId, isAdmin, addMutation]
  );

  const removeFromSection = useCallback(
    (tmdbId: number, mediaType: "movie" | "tv") => {
      if (!sectionId || !isAdmin) return;
      removeMutation.mutate({ tmdbId, mediaType });
    },
    [sectionId, isAdmin, removeMutation]
  );

  const pinToTop = useCallback(
    (tmdbId: number, mediaType: "movie" | "tv", metadata?: { title?: string; posterPath?: string }) => {
      if (!sectionId || !isAdmin) return;
      pinMutation.mutate({ tmdbId, mediaType, metadata });
    },
    [sectionId, isAdmin, pinMutation]
  );

  const unpinFromTop = useCallback(
    (tmdbId: number, mediaType: "movie" | "tv") => {
      if (!sectionId || !isAdmin) return;
      unpinMutation.mutate({ tmdbId, mediaType });
    },
    [sectionId, isAdmin, unpinMutation]
  );

  const resetSection = useCallback(() => {
    if (!sectionId || !isAdmin) return;
    resetMutation.mutate();
  }, [sectionId, isAdmin, resetMutation]);

  const reorderSection = useCallback(
    (orderedItems: ReorderItem[]) => {
      if (!sectionId || !isAdmin) return;
      reorderMutation.mutate(orderedItems);
    },
    [sectionId, isAdmin, reorderMutation]
  );

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
    reorderSection,
    getCuratedItems,
    hasCuration,
  };
}
