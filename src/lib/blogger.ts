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
  seasonEpisodeLinks?: string[]; // All watch online links for a season (indexed by episode - 1)
  seasonDownloadLinks?: string[]; // All download links for a season (indexed by episode - 1)
}

// Parse TV show content to extract season-specific watch online (byse) and download (dldclv) links
function parseTVShowContent(content: string, season: number, episode?: number): { 
  iframeSrc?: string; 
  downloadLink?: string; 
  seasonEpisodeLinks?: string[];
  seasonDownloadLinks?: string[] 
} {
  const result: { 
    iframeSrc?: string; 
    downloadLink?: string; 
    seasonEpisodeLinks?: string[];
    seasonDownloadLinks?: string[] 
  } = {};
  
  // Normalize content - replace common variations and decode HTML entities
  const normalizedContent = content
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&amp;/g, '&');
  
  // Split content by season markers (case insensitive)
  // Look for patterns like "Season 1", "SEASON 1", "season 1", "S01", etc.
  const seasonRegex = /(?:season\s*(\d+)|s(\d+)(?!\d))/gi;
  const seasonMatches: { index: number; seasonNum: number }[] = [];
  
  let match;
  while ((match = seasonRegex.exec(normalizedContent)) !== null) {
    const seasonNum = parseInt(match[1] || match[2]);
    seasonMatches.push({ index: match.index, seasonNum });
  }
  
  let sectionToSearch = normalizedContent;
  
  if (seasonMatches.length > 0) {
    // Find the section for the requested season
    const targetSeasonMatch = seasonMatches.find(m => m.seasonNum === season);
    if (!targetSeasonMatch) {
      console.log(`Season ${season} not found in content. Available seasons:`, seasonMatches.map(m => m.seasonNum));
      return result;
    }
    
    // Find the end of this season's section (start of next season or end of content)
    const targetIndex = seasonMatches.indexOf(targetSeasonMatch);
    const nextSeasonMatch = seasonMatches[targetIndex + 1];
    
    const sectionStart = targetSeasonMatch.index;
    const sectionEnd = nextSeasonMatch ? nextSeasonMatch.index : normalizedContent.length;
    sectionToSearch = normalizedContent.substring(sectionStart, sectionEnd);
  }
  
  // Extract all watch online links containing "byse" in the URL
  // Look for href attributes, src attributes, or raw URLs containing "byse"
  const watchLinks: string[] = [];
  
  // Method 1: Look for href/src attributes with byse URLs
  const attrRegex = /(?:href|src)=["']([^"']*byse[^"']*)/gi;
  let attrMatch;
  while ((attrMatch = attrRegex.exec(sectionToSearch)) !== null) {
    const link = attrMatch[1].replace(/&amp;/g, '&');
    if (!watchLinks.includes(link)) {
      watchLinks.push(link);
    }
  }
  
  // Method 2: Look for raw URLs containing byse (in case they're not in attributes)
  const urlRegex = /https?:\/\/[^\s"'<>]*byse[^\s"'<>]*/gi;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(sectionToSearch)) !== null) {
    const link = urlMatch[0].replace(/&amp;/g, '&');
    if (!watchLinks.includes(link)) {
      watchLinks.push(link);
    }
  }
  
  console.log(`Found ${watchLinks.length} watch online links (byse) for season ${season}:`, watchLinks);
  
  if (watchLinks.length > 0) {
    result.seasonEpisodeLinks = watchLinks;
    // Episode is 1-indexed, array is 0-indexed
    if (episode && watchLinks.length >= episode) {
      result.iframeSrc = watchLinks[episode - 1];
      console.log(`Using watch link for episode ${episode}:`, result.iframeSrc);
    }
  }
  
  // Extract all download links containing "dldclv" in the URL
  const downloadLinks: string[] = [];
  
  // Method 1: Look for href/src attributes with dldclv URLs
  const dlAttrRegex = /(?:href|src)=["']([^"']*dldclv[^"']*)/gi;
  let dlAttrMatch;
  while ((dlAttrMatch = dlAttrRegex.exec(sectionToSearch)) !== null) {
    const link = dlAttrMatch[1].replace(/&amp;/g, '&');
    if (!downloadLinks.includes(link)) {
      downloadLinks.push(link);
    }
  }
  
  // Method 2: Look for raw URLs containing dldclv (in case they're not in attributes)
  const dlUrlRegex = /https?:\/\/[^\s"'<>]*dldclv[^\s"'<>]*/gi;
  let dlUrlMatch;
  while ((dlUrlMatch = dlUrlRegex.exec(sectionToSearch)) !== null) {
    const link = dlUrlMatch[0].replace(/&amp;/g, '&');
    if (!downloadLinks.includes(link)) {
      downloadLinks.push(link);
    }
  }
  
  console.log(`Found ${downloadLinks.length} download links (dldclv) for season ${season}:`, downloadLinks);
  
  if (downloadLinks.length > 0) {
    result.seasonDownloadLinks = downloadLinks;
    // If there are multiple download links (one per episode), try to get the right one
    if (episode && downloadLinks.length >= episode) {
      result.downloadLink = downloadLinks[episode - 1];
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
      
      if (type === "tv" && season) {
        // Parse TV show content for season-specific links
        const tvResult = parseTVShowContent(content, season, episode);
        
        if (tvResult.iframeSrc) {
          result.found = true;
          result.iframeSrc = tvResult.iframeSrc;
        }
        if (tvResult.downloadLink) {
          result.downloadLink = tvResult.downloadLink;
        }
        if (tvResult.seasonEpisodeLinks) {
          result.seasonEpisodeLinks = tvResult.seasonEpisodeLinks;
        }
        if (tvResult.seasonDownloadLinks) {
          result.seasonDownloadLinks = tvResult.seasonDownloadLinks;
        }

        // If we have season links (for episode cards) we should consider this a match too
        if (result.seasonEpisodeLinks?.length || result.seasonDownloadLinks?.length) {
          result.found = true;
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
      
      // Return if we found iframe or download link or season links
      if (result.found || result.downloadLink || (result.seasonDownloadLinks && result.seasonDownloadLinks.length > 0)) {
        result.found = result.found || !!result.downloadLink || (result.seasonDownloadLinks && result.seasonDownloadLinks.length > 0);
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
