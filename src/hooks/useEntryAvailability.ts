import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";

export interface EntryAvailability {
  hasWatch: boolean;
  hasDownload: boolean;
}

interface MovieContent {
  watchLink?: string;
  downloadLink?: string;
}

interface SeriesSeasonContent {
  watchLinks?: string[];
  downloadLinks?: string[];
}

interface SeriesContent {
  seasons: Record<string, SeriesSeasonContent>;
}

interface EntryData {
  id: string;
  type: 'movie' | 'series';
  content: MovieContent | SeriesContent;
}

export const useEntryAvailability = () => {
  const { isAdmin } = useAdmin();

  const { data: availabilityMap = new Map<string, EntryAvailability>() } = useQuery({
    queryKey: ['entry-availability'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('id, type, content');

      if (error) {
        console.error('[useEntryAvailability] Error fetching entries:', error);
        return new Map<string, EntryAvailability>();
      }

      const map = new Map<string, EntryAvailability>();

      (data as EntryData[] || []).forEach((entry) => {
        let hasWatch = false;
        let hasDownload = false;

        if (entry.type === 'movie') {
          const content = entry.content as MovieContent;
          hasWatch = !!(content.watchLink && content.watchLink.trim());
          hasDownload = !!(content.downloadLink && content.downloadLink.trim());
        } else if (entry.type === 'series') {
          const content = entry.content as SeriesContent;
          if (content.seasons) {
            Object.values(content.seasons).forEach((season) => {
              if (season.watchLinks?.some(link => link && link.trim())) {
                hasWatch = true;
              }
              if (season.downloadLinks?.some(link => link && link.trim())) {
                hasDownload = true;
              }
            });
          }
        }

        map.set(entry.id, { hasWatch, hasDownload });
      });

      return map;
    },
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const getAvailability = (tmdbId: number): EntryAvailability => {
    return availabilityMap.get(String(tmdbId)) || { hasWatch: false, hasDownload: false };
  };

  return { getAvailability, availabilityMap };
};
