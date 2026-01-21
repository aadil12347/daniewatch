 import { useEffect } from "react";
 
 const SESSION_ACTIVE_KEY = "dw_cache_session_active";
 
 export function useSessionCacheManager() {
   useEffect(() => {
     // When the app mounts, check if we need to clear old cache
     const sessionActive = sessionStorage.getItem(SESSION_ACTIVE_KEY);
     
     if (!sessionActive) {
       // New session - mark it as active
       sessionStorage.setItem(SESSION_ACTIVE_KEY, "1");
     }
 
     // Listen for when the user is about to leave the page
     const handleBeforeUnload = () => {
       // sessionStorage automatically clears when the tab closes
     };
 
     // Listen for visibility changes (tab switching)
     const handleVisibilityChange = () => {
       if (!document.hidden) {
         // Tab became visible again - refresh session timestamp
         sessionStorage.setItem(SESSION_ACTIVE_KEY, "1");
       }
     };
 
     window.addEventListener("beforeunload", handleBeforeUnload);
     document.addEventListener("visibilitychange", handleVisibilityChange);
 
     return () => {
       window.removeEventListener("beforeunload", handleBeforeUnload);
       document.removeEventListener("visibilitychange", handleVisibilityChange);
     };
   }, []);
 }