

## Homepage Session Caching

### Overview
Add session-level caching for the homepage so that:
1. **Within a session**: Homepage loads instantly from cache (no network requests)
2. **New session**: Fetch fresh data from TMDB and update the cache

### How It Works

**Current Behavior:**
- Homepage fetches 7 TMDB API calls every time it loads
- No caching between navigations within the same session

**New Behavior:**
- First visit: Fetch from TMDB, save to sessionStorage
- Same session revisits: Load instantly from cache
- New session (new tab/browser restart): Fetch fresh data and update cache

---

## Implementation Details

### 1. Create Homepage Cache Hook
**New file:** `src/hooks/useHomepageCache.ts`

A dedicated hook to manage homepage-specific caching:
- Save all 7 content lists to sessionStorage as a single object
- Include a timestamp for debugging/future expiration
- Provide `saveCache` and `getCache` functions

```text
Cache structure:
{
  trending: Movie[],
  popularMovies: Movie[],
  topRatedMovies: Movie[],
  popularTV: Movie[],
  topRatedTV: Movie[],
  animePopular: Movie[],
  koreanPopular: Movie[],
  timestamp: number
}
```

### 2. Update Index.tsx
**File:** `src/pages/Index.tsx`

Modify the data fetching logic:

1. **On mount**: Check if sessionStorage has cached homepage data
   - If yes: Use cached data immediately (skip network fetch)
   - If no: Fetch from TMDB as usual

2. **After successful fetch**: Save all content to sessionStorage

3. **Session detection**: Use the existing `sessionStorage` behavior (automatically clears when tab closes)

```text
Pseudocode:
useEffect(() => {
  // Try cache first
  const cached = getHomepageCache();
  if (cached) {
    setTrending(cached.trending);
    setPopularMovies(cached.popularMovies);
    // ... set all states
    setIsLoading(false);
    return;
  }

  // No cache, fetch fresh
  fetchFromTMDB().then(data => {
    setStates(data);
    saveHomepageCache(data);
  });
}, []);
```

---

## Session Behavior

| Scenario | Behavior |
|----------|----------|
| First visit to homepage | Fetch from TMDB, save to cache |
| Navigate away, come back (same tab) | Load instantly from cache |
| Refresh page (same session) | Load instantly from cache |
| Close tab, reopen | New session - fetch fresh data |
| Close browser, reopen | New session - fetch fresh data |

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useHomepageCache.ts` | New hook for homepage session caching |
| `src/pages/Index.tsx` | Integrate cache check on mount, save after fetch |

