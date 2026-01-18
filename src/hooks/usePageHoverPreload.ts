import { useMemo } from "react";

import type { Movie } from "@/lib/tmdb";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { usePreloadImages } from "@/hooks/usePreloadImages";

type Options = {
  count?: number;
  threshold?: number;
  concurrency?: number;
  /** Enable preloading (usually once the page has fetched its list data). */
  enabled?: boolean;
};

/**
 * Page-level preload: preloads hover-character images for the first N cards so hover feels instant.
 * Intended to be used to gate the initial render (e.g. show page once 50% are ready).
 */
export const usePageHoverPreload = (items: Movie[], options: Options = {}) => {
  const {
    count = 20,
    threshold = 0.5,
    concurrency = 8,
    enabled = true,
  } = options;

  const { getHoverImageUrl, isLoading: isAvailabilityLoading } = useEntryAvailability();

  const firstIds = useMemo(() => items.slice(0, count).map((m) => m.id), [items, count]);

  const hoverUrls = useMemo(
    () => firstIds.map((id) => getHoverImageUrl(id)).filter(Boolean),
    [firstIds, getHoverImageUrl]
  );

  const { loaded, total } = usePreloadImages(hoverUrls, {
    enabled: enabled && !isAvailabilityLoading,
    concurrency,
  });

  const ready = total === 0 ? true : loaded / total >= threshold;

  return {
    ready,
    loaded,
    total,
    isLoading: isAvailabilityLoading || !ready,
  };
};
