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
}

// Fetch posts from Blogger and search for TMDB ID
export async function searchBloggerForTmdbId(
  tmdbId: number,
  type: "movie" | "tv",
  season?: number
): Promise<BloggerVideoResult> {
  try {
    // Build search query - for TV shows include season number
    const searchQuery = type === "tv" && season 
      ? `${tmdbId} S${String(season).padStart(2, '0')}`
      : `${tmdbId}`;
    
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
    
    // Find a post with title matching the ID (or ID + season for TV)
    for (const post of data.items) {
      const content = post.content || "";
      const title = post.title || "";
      
      // Check if post title contains the TMDB ID
      const idMatch = title.includes(String(tmdbId));
      // For TV shows, also check for season match
      const seasonMatch = type !== "tv" || !season || 
        title.toLowerCase().includes(`s${String(season).padStart(2, '0')}`) ||
        title.toLowerCase().includes(`season ${season}`);
      
      if (idMatch && seasonMatch) {
        const result: BloggerVideoResult = {
          found: false,
          postTitle: post.title,
        };
        
        // Extract iframe src from content
        const iframeMatch = content.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
        if (iframeMatch && iframeMatch[1]) {
          result.found = true;
          result.iframeSrc = iframeMatch[1];
        }
        
        // Extract all download links containing "dldclv"
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
        
        // Return if we found either iframe or download link
        if (result.found || result.downloadLink) {
          result.found = result.found || !!result.downloadLink;
          console.log("Found Blogger content for TMDB ID:", tmdbId, result);
          return result;
        }
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
