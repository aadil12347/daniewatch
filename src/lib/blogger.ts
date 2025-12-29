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

// Parse TV show content using DOM-based parsing to extract season-specific links
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
  
  // Parse HTML content into a DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  
  // Get all elements in document order
  const allElements = Array.from(doc.body.querySelectorAll('*'));
  
  // Find season markers by looking at text content of elements
  // Match "season 1", "Season 1", "SEASON 1", etc. but NOT "s01" in URLs
  const seasonMarkerRegex = new RegExp(`\\bseason\\s*${season}\\b`, 'i');
  
  let seasonStartIndex = -1;
  let seasonEndIndex = allElements.length;
  
  // Find where our target season starts
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    const textContent = el.textContent?.trim() || '';
    
    // Check if this element's direct text (not children) contains the season marker
    // This prevents matching URLs that contain "s01"
    const directText = Array.from(el.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent)
      .join('')
      .trim();
    
    if (seasonMarkerRegex.test(directText) || 
        (textContent.length < 20 && seasonMarkerRegex.test(textContent))) {
      seasonStartIndex = i;
      console.log(`Found season ${season} marker at element index ${i}:`, textContent);
      break;
    }
  }
  
  // If we found the season, look for the next season marker to define the end
  if (seasonStartIndex !== -1) {
    const nextSeasonRegex = new RegExp(`\\bseason\\s*(${season + 1}|${season + 2}|${season + 3})\\b`, 'i');
    
    for (let i = seasonStartIndex + 1; i < allElements.length; i++) {
      const el = allElements[i];
      const textContent = el.textContent?.trim() || '';
      
      const directText = Array.from(el.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent)
        .join('')
        .trim();
      
      if (nextSeasonRegex.test(directText) || 
          (textContent.length < 20 && nextSeasonRegex.test(textContent))) {
        seasonEndIndex = i;
        console.log(`Found next season marker at element index ${i}:`, textContent);
        break;
      }
    }
  }
  
  // If no season marker found, search the entire document
  const elementsToSearch = seasonStartIndex !== -1 
    ? allElements.slice(seasonStartIndex, seasonEndIndex)
    : allElements;
  
  console.log(`Searching ${elementsToSearch.length} elements for season ${season} content`);
  
  // Collect all iframes with "byse" in src (watch online links)
  const watchLinks: string[] = [];
  const iframes = elementsToSearch.filter(el => el.tagName === 'IFRAME');
  
  for (const iframe of iframes) {
    const src = iframe.getAttribute('src') || '';
    if (src.toLowerCase().includes('byse')) {
      const cleanSrc = src.replace(/&amp;/g, '&');
      if (!watchLinks.includes(cleanSrc)) {
        watchLinks.push(cleanSrc);
      }
    }
  }
  
  console.log(`Found ${watchLinks.length} watch online links (byse iframes) for season ${season}:`, watchLinks);
  
  if (watchLinks.length > 0) {
    result.seasonEpisodeLinks = watchLinks;
    if (episode && watchLinks.length >= episode) {
      result.iframeSrc = watchLinks[episode - 1];
      console.log(`Using watch link for episode ${episode}:`, result.iframeSrc);
    }
  }
  
  // Collect all anchor tags with "dldclv" in href (download links)
  const downloadLinks: string[] = [];
  const anchors = elementsToSearch.filter(el => el.tagName === 'A');
  
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href') || '';
    if (href.toLowerCase().includes('dldclv')) {
      const cleanHref = href.replace(/&amp;/g, '&');
      if (!downloadLinks.includes(cleanHref)) {
        downloadLinks.push(cleanHref);
      }
    }
  }
  
  console.log(`Found ${downloadLinks.length} download links (dldclv anchors) for season ${season}:`, downloadLinks);
  
  if (downloadLinks.length > 0) {
    result.seasonDownloadLinks = downloadLinks;
    if (episode && downloadLinks.length >= episode) {
      result.downloadLink = downloadLinks[episode - 1];
      console.log(`Using download link for episode ${episode}:`, result.downloadLink);
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
