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
  type: "movie" | "tv"
): Promise<BloggerVideoResult> {
  try {
    // Search for posts containing the TMDB ID
    const searchQuery = `${tmdbId}`;
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
    
    // Find a post that matches the TMDB ID in title or content
    for (const post of data.items) {
      const content = post.content || "";
      const title = post.title || "";
      
      // Check if this post is for the correct TMDB ID
      if (title.includes(String(tmdbId)) || content.includes(String(tmdbId))) {
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
        
        // Extract download link containing "dldclv"
        const downloadMatch = content.match(/https:\/\/dldclv[^\s"'<>]+/gi);
        if (downloadMatch && downloadMatch[0]) {
          result.downloadLink = downloadMatch[0];
        }
        
        // Only return if we found an iframe
        if (result.found) {
          console.log("Found Blogger video for TMDB ID:", tmdbId, result);
          return result;
        }
      }
    }
    
    console.log("No iframe found in Blogger posts for TMDB ID:", tmdbId);
    return { found: false };
  } catch (error) {
    console.error("Error searching Blogger:", error);
    return { found: false };
  }
}
