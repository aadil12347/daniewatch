import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import blogData from "@/data/blogMasterData.json";

interface BlogPost {
  id: string;
  title: string;
  category: "movie" | "series";
  data: {
    watch?: string;
    download?: string;
    [key: string]: unknown;
  };
}

interface MovieContent {
  watch_link: string;
  download_link: string;
}

interface SeasonContent {
  watch_links: string[];
  download_links: string[];
}

interface SeriesContent {
  [key: string]: SeasonContent;
}

interface EntryData {
  id: string;
  type: "movie" | "series";
  content: MovieContent | SeriesContent;
}

const transformPosts = (posts: BlogPost[]): EntryData[] => {
  return posts.map((post) => {
    if (post.category === "movie") {
      return {
        id: post.title, // title is the TMDB ID
        type: "movie" as const,
        content: {
          watch_link: post.data.watch || "",
          download_link: post.data.download || "",
        },
      };
    } else {
      // Series - data already contains season_X structure
      const seriesContent: SeriesContent = {};
      
      Object.keys(post.data).forEach((key) => {
        if (key.startsWith("season_")) {
          const seasonData = post.data[key] as SeasonContent;
          seriesContent[key] = {
            watch_links: seasonData.watch_links || [],
            download_links: seasonData.download_links || [],
          };
        }
      });

      return {
        id: post.title,
        type: "series" as const,
        content: seriesContent,
      };
    }
  });
};

export const runBulkImport = async (): Promise<{
  success: number;
  failed: number;
  total: number;
  failedIds: string[];
}> => {
  const posts = (blogData as { posts: BlogPost[] }).posts;
  const entries = transformPosts(posts);
  
  console.log(`Starting bulk import of ${entries.length} entries...`);
  
  const BATCH_SIZE = 25;
  let success = 0;
  let failed = 0;
  const failedIds: string[] = [];
  
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    const { error } = await supabase
      .from("entries")
      .upsert(batch, { onConflict: "id" });
    
    if (error) {
      console.error(`Batch ${batchNum} failed, trying individual inserts...`, error);
      
      // Fall back to individual inserts for this batch
      for (const entry of batch) {
        const { error: individualError } = await supabase
          .from("entries")
          .upsert(entry, { onConflict: "id" });
        
        if (individualError) {
          console.error(`Entry ${entry.id} failed:`, individualError.message);
          failed++;
          failedIds.push(entry.id);
        } else {
          success++;
        }
      }
    } else {
      success += batch.length;
      console.log(`Batch ${batchNum} completed: ${batch.length} entries`);
    }
  }
  
  console.log(`Bulk import completed: ${success} success, ${failed} failed out of ${entries.length} total`);
  if (failedIds.length > 0) {
    console.log(`Failed IDs: ${failedIds.join(', ')}`);
  }
  
  return { success, failed, total: entries.length, failedIds };
};
