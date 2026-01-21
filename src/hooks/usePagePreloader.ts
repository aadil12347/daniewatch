 import { useEffect } from "react";
 import { useQueryClient } from "@tanstack/react-query";
import { getPopularMovies, getPopularTV, discoverTV } from "@/lib/tmdb";
 import { useDbManifest } from "./useDbManifest";
 
 const PRELOAD_COUNT = 5;
 
 export function usePagePreloader(enabled: boolean) {
   const queryClient = useQueryClient();
   const { manifest } = useDbManifest();
 
   useEffect(() => {
     if (!enabled || !manifest) return;
 
     const preloadPages = async () => {
       try {
         // Small delay to ensure home page renders first
         await new Promise(resolve => setTimeout(resolve, 1000));
 
         // Preload Movies page - top popular movies
        const moviesPromise = getPopularMovies(1).then((data) => {
           queryClient.setQueryData(
             ["movies", "popular", 1, []], 
             data.results.slice(0, PRELOAD_COUNT)
           );
         });
 
         // Preload TV Shows page - top popular TV
        const tvPromise = getPopularTV(1).then((data) => {
           queryClient.setQueryData(
             ["tv", "popular", 1, []], 
             data.results.slice(0, PRELOAD_COUNT)
           );
         });
 
         // Preload Anime page - Japanese animation
        const animePromise = discoverTV(1, [16]).then((data) => {
           const filtered = data.results
            .filter((item: any) => item.original_language === "ja")
             .slice(0, PRELOAD_COUNT);
           queryClient.setQueryData(["anime", "initial", 1], filtered);
         });
 
         // Preload Korean page - Korean content
        const koreanPromise = discoverTV(1, []).then((data) => {
           const filtered = data.results
             .filter((item: any) => item.original_language === "ko")
             .slice(0, PRELOAD_COUNT);
           queryClient.setQueryData(["korean", "initial", 1], filtered);
         });
 
         await Promise.all([moviesPromise, tvPromise, animePromise, koreanPromise]);
         
         console.log("✓ Page preloading complete");
       } catch (error) {
         console.warn("Page preload error:", error);
       }
     };
 
     preloadPages();
   }, [enabled, manifest, queryClient]);
 }