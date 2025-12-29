// Blogger API configuration
const BLOGGER_API_KEY = "AIzaSyAGF6GU4rVJd4R2hJ9KYP6bO-uFhPaP6vg";
const BLOGGER_ID = "1610942874392288026";

interface BloggerPost {
  id: string;
  title: string;
  content: string;
  url: string;
  published: string;
}

interface BloggerResponse {
  items?: BloggerPost[];
  nextPageToken?: string;
}

export interface BloggerVideoResult {
  found: boolean;
  iframeSrc?: string;
  downloadLink?: string;
  postTitle?: string;
  seasonDownloadLinks?: string[]; // All download links for a season (indexed by episode - 1)
}

// Parse TV show content to extract season-specific iframes and download links
function parseTVShowContent(content: string, season: number, episode?: number): { iframeSrc?: string; downloadLink?: string; seasonDownloadLinks?: string[] } {
  const result: { iframeSrc?: string; downloadLink?: string; seasonDownloadLinks?: string[] } = {};
  
  // Normalize content - replace common variations
  const normalizedContent = content.replace(/&nbsp;/g, ' ').replace(/<br\s*\/?>/gi, '\n');
  
  // Split content by season markers (case insensitive)
  // Look for patterns like "Season 1", "SEASON 1", "season 1", "S01", etc.
  const seasonRegex = /(?:season\s*(\d+)|s(\d+)(?!\d))/gi;
  const seasonMatches: { index: number; seasonNum: number }[] = [];
  
  let match;
  while ((match = seasonRegex.exec(normalizedContent)) !== null) {
    const seasonNum = parseInt(match[1] || match[2]);
    seasonMatches.push({ index: match.index, seasonNum });
  }
  
  if (seasonMatches.length === 0) {
    // No season markers found, try to extract first iframe and download link
    const iframeMatch = normalizedContent.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
    if (iframeMatch) {
      result.iframeSrc = iframeMatch[1];
    }
    const downloadMatches = normalizedContent.match(/https:\/\/dldclv[^\s"'<>]+/gi);
    if (downloadMatches && downloadMatches.length > 0) {
      result.downloadLink = downloadMatches[0];
      result.seasonDownloadLinks = downloadMatches;
    }
    return result;
  }
  
  // Find the section for the requested season
  const targetSeasonMatch = seasonMatches.find(m => m.seasonNum === season);
  if (!targetSeasonMatch) {
    return result;
  }
  
  // Find the end of this season's section (start of next season or end of content)
  const targetIndex = seasonMatches.indexOf(targetSeasonMatch);
  const nextSeasonMatch = seasonMatches[targetIndex + 1];
  
  const sectionStart = targetSeasonMatch.index;
  const sectionEnd = nextSeasonMatch ? nextSeasonMatch.index : normalizedContent.length;
  const seasonSection = normalizedContent.substring(sectionStart, sectionEnd);
  
  // Extract all iframe sources from this season's section
  const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const iframeSrcs: string[] = [];
  
  let iframeMatch;
  while ((iframeMatch = iframeRegex.exec(seasonSection)) !== null) {
    iframeSrcs.push(iframeMatch[1]);
  }
  
  // Episode is 1-indexed, array is 0-indexed
  if (episode && iframeSrcs.length > 0 && episode <= iframeSrcs.length) {
    result.iframeSrc = iframeSrcs[episode - 1];
  }
  
  // Extract all download links from this season's section
  const downloadMatches = seasonSection.match(/https:\/\/dldclv[^\s"'<>]+/gi);
  if (downloadMatches && downloadMatches.length > 0) {
    result.seasonDownloadLinks = downloadMatches;
    // If there are multiple download links (one per episode), try to get the right one
    if (episode && downloadMatches.length >= episode) {
      result.downloadLink = downloadMatches[episode - 1];
    } else if (episode) {
      // Otherwise just use the first download link for the season
      result.downloadLink = downloadMatches[0];
    }
  }
  
  return result;
}

// Fetch posts from Blogger and search for TMDB ID
export async function searchBloggerForTmdbId(
  tmdbId: number,
  type: "movie" | "tv",
  season?: number,
  episode?: number
): Promise<BloggerVideoResult> {
  try {
    // For movies, search by ID. For TV shows, just search by ID (season info is in the post content)
    const searchQuery = String(tmdbId);
    
    const url = `https://www.googleapis.com/blogger/v3/blogs/${BLOGGER_ID}/posts/search?q=${encodeURIComponent(searchQuery)}&key=${BLOGGER_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log("Blogger API error:", response.status);
      return { found: false };
    }
    
    const data: BloggerResponse = await response.json();
    
    if (!data.items || data.items.length === 0) {
      console.log("No Blogger posts found for TMDB ID:", tmdbId);
      return { found: false };
    }
    
    // Find a post with title matching the TMDB ID
    for (const post of data.items) {
      const content = post.content || "";
      const title = post.title || "";
      
      // Check if post title contains the TMDB ID
      if (!title.includes(String(tmdbId))) {
        continue;
      }
      
      const result: BloggerVideoResult = {
        found: false,
        postTitle: post.title,
      };
      
      if (type === "tv" && season && episode) {
        // Parse TV show content for season/episode specific links
        const tvResult = parseTVShowContent(content, season, episode);
        
        if (tvResult.iframeSrc) {
          result.found = true;
          result.iframeSrc = tvResult.iframeSrc;
        }
        if (tvResult.downloadLink) {
          result.downloadLink = tvResult.downloadLink;
        }
      } else {
        // For movies, extract first iframe and download link
        const iframeMatch = content.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
        if (iframeMatch && iframeMatch[1]) {
          result.found = true;
          result.iframeSrc = iframeMatch[1];
        }
        
        // Extract download link
        const downloadMatches = content.match(/https:\/\/dldclv[^\s"'<>]+/gi);
        if (downloadMatches && downloadMatches.length > 0) {
          result.downloadLink = downloadMatches[0];
        }
        
        // Also check for href links with dldclv
        const hrefMatch = content.match(/href=["'](https:\/\/dldclv[^"']+)["']/gi);
        if (hrefMatch && hrefMatch.length > 0) {
          const linkMatch = hrefMatch[0].match(/href=["']([^"']+)["']/i);
          if (linkMatch && linkMatch[1]) {
            result.downloadLink = linkMatch[1];
          }
        }
      }
      
      // Return if we found iframe or download link
      if (result.found || result.downloadLink) {
        result.found = result.found || !!result.downloadLink;
        console.log("Found Blogger content for TMDB ID:", tmdbId, result);
        return result;
      }
    }
    
    console.log("No matching content in Blogger posts for TMDB ID:", tmdbId);
    return { found: false };
  } catch (error) {
    console.error("Error searching Blogger:", error);
    return { found: false };
  }
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
