import { supabase } from "@/integrations/supabase/client";

export interface MediaLinkResult {
  source: "supabase" | "moviesapi" | "videasy";
  found: boolean;
  watchUrl?: string;
  downloadUrl?: string;
  seasonEpisodeLinks?: string[]; // All watch links for a season (indexed by episode - 1)
  seasonDownloadLinks?: string[]; // All download links for a season (indexed by episode - 1)
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
  [key: string]: SeriesSeasonContent; // e.g., "season_1", "season_2"
}

interface EntryContent {
  type?: "movie" | "series";
  content?: MovieContent | SeriesContent;
  // Movie fields (flat structure)
  watch_link?: string;
  download_link?: string;
}

// Extract src from iframe HTML
export function extractIframeSrc(iframeHtml: string): string | null {
  if (!iframeHtml) return null;
  
  // Check if it's already just a URL
  if (iframeHtml.startsWith("http")) {
    return iframeHtml;
  }
  
  const match = iframeHtml.match(/src=["']([^"']+)["']/i);
  return match ? match[1].replace(/&amp;/g, '&') : null;
}

// Get Videasy fallback URL
function getVideasyFallbackUrl(tmdbId: number, type: "movie" | "tv", season?: number, episode?: number): string {
  if (type === "movie") {
    return `https://player.videasy.net/movie/${tmdbId}`;
  } else {
    return `https://player.videasy.net/tv/${tmdbId}/${season || 1}/${episode || 1}`;
  }
}

// Get MoviesAPI (moviesapi.to) embed URL
function getMoviesApiUrl(tmdbId: number, type: "movie" | "tv", season?: number, episode?: number): string {
  if (type === "movie") {
    return `https://moviesapi.to/movie/${tmdbId}`;
  }

  const safeSeason = season || 1;
  const safeEpisode = episode || 1;
  return `https://moviesapi.to/tv/${tmdbId}-${safeSeason}-${safeEpisode}`;
}

// Main function to get media links with priority: Supabase → MoviesAPI → Videasy fallback
export async function getMediaLinks(
  tmdbId: number,
  type: "movie" | "tv",
  season?: number,
  episode?: number
): Promise<MediaLinkResult> {
  const result: MediaLinkResult = {
    source: "moviesapi",
    found: false,
  };

  try {
    // Check Supabase entries table
    const { data: entry, error } = await supabase
      .from("entries")
      .select("*")
      .eq("id", String(tmdbId))
      .maybeSingle();

    if (!error && entry) {
      const content = entry.content as EntryContent | null;
      
      if (content) {
        const entryType = entry.type || content.type;
        
        if (entryType === "movie" || type === "movie") {
          // Handle movie content
          const watchLink = content.watch_link || (content.content as MovieContent)?.watch_link;
          const downloadLink = content.download_link || (content.content as MovieContent)?.download_link;
          
          if (watchLink) {
            result.found = true;
            result.source = "supabase";
            result.watchUrl = extractIframeSrc(watchLink) || watchLink;
          }
          if (downloadLink) {
            result.downloadUrl = downloadLink;
            result.found = true;
            result.source = "supabase";
          }
        } else if (entryType === "series" || type === "tv") {
          // Handle series content
          const seasonKey = `season_${season || 1}`;
          const seriesContent = content.content as SeriesContent || content as unknown as SeriesContent;
          const seasonData = seriesContent[seasonKey] as SeriesSeasonContent;
          
          if (seasonData) {
            // Get all watch links for the season
            if (seasonData.watch_links && seasonData.watch_links.length > 0) {
              result.seasonEpisodeLinks = seasonData.watch_links.map(link => 
                extractIframeSrc(link) || link
              );
              result.found = true;
              result.source = "supabase";
              
              // Get specific episode link if requested
              if (episode && seasonData.watch_links.length >= episode) {
                result.watchUrl = extractIframeSrc(seasonData.watch_links[episode - 1]) || seasonData.watch_links[episode - 1];
              }
            }
            
            // Get all download links for the season
            if (seasonData.download_links && seasonData.download_links.length > 0) {
              result.seasonDownloadLinks = seasonData.download_links;
              result.found = true;
              result.source = "supabase";
              
              // Get specific episode download link if requested
              if (episode && seasonData.download_links.length >= episode) {
                result.downloadUrl = seasonData.download_links[episode - 1];
              }
            }
          }
        }
      }
      
      if (result.found) {
        console.log(`[MediaLinks] Found in Supabase for TMDB ${tmdbId}:`, result);
        return result;
      }
    }
  } catch (err) {
    console.log("[MediaLinks] Supabase check error:", err);
  }

  // Fallback #1: MoviesAPI
  result.watchUrl = getMoviesApiUrl(tmdbId, type, season, episode);
  result.source = "moviesapi";
  result.found = false;

  // Keep Videasy available as a last-resort fallback in the player UI
  const videasyFallback = getVideasyFallbackUrl(tmdbId, type, season, episode);

  console.log(`[MediaLinks] Using MoviesAPI fallback for TMDB ${tmdbId}:`, {
    moviesApi: result.watchUrl,
    videasyFallback,
  });
  return result;
}


// Function to trigger download
export function triggerDownload(url: string, filename?: string) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  if (filename) {
    link.download = filename;
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
