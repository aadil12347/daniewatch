import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";

export interface EntryAvailability {
  hasWatch: boolean;
  hasDownload: boolean;
}

interface MovieContent {
  watch_link?: string;
  download_link?: string;
}

interface SeriesSeasonContent {
  watch_links?: string[];
  download_links?: string[];
}

interface SeriesContent {
  [key: string]: SeriesSeasonContent;
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
          hasWatch = !!(content.watch_link && content.watch_link.trim());
          hasDownload = !!(content.download_link && content.download_link.trim());
        } else if (entry.type === 'series') {
          const content = entry.content as SeriesContent;
          Object.keys(content).forEach((key) => {
            if (key.startsWith('season_')) {
              const season = content[key];
              if (season.watch_links?.some(link => link && link.trim())) {
                hasWatch = true;
              }
              if (season.download_links?.some(link => link && link.trim())) {
                hasDownload = true;
              }
            }
          });
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
