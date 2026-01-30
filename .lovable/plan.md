

## Instant Homepage Loading

### Problem
The homepage is slow because it waits for **4 different conditions** before showing anything:
1. TMDB data fetch (cached, fast)
2. Supabase blocked posts query (network, slow)
3. Supabase entries query (network, slow) 
4. 50% of hover images preloaded (network, slow)

Even with cached TMDB data, the page shows skeletons for 2-5 seconds waiting for Supabase queries and image preloading.

### Solution: Progressive Rendering
Show content **instantly** as data becomes available, in priority order:

| Priority | Component | Data Source | Wait For |
|----------|-----------|-------------|----------|
| 1 (instant) | Hero Carousel | TMDB trending (cached) | Nothing - show immediately |
| 2 (instant) | Top 10 Row | TMDB trending (cached) | Nothing - show immediately |
| 3 (background) | Other Rows | TMDB (cached) | Nothing - render normally |
| 4 (progressive) | Blocked post filtering | Supabase | Applied after load |
| 5 (progressive) | Hover images | Supabase + CDN | Loaded on hover only |

---

## Technical Changes

### 1. Split Loading States in Index.tsx

**Remove blocking dependencies from `pageIsLoading`:**

```text
Before:
  pageIsLoading = isLoading || isModerationLoading || isAvailabilityLoading || !aboveFoldReady

After:
  // Primary content just needs TMDB data
  primaryContentReady = !isLoading && trending.length > 0
  
  // Secondary features load progressively (don't block UI)
  // Moderation and availability enhance but don't gate
```

### 2. Update HeroSection and ContentRow Props

Pass `hasData` flag separately from `isLoading`:

```text
<HeroSection 
  items={trending} 
  isLoading={!primaryContentReady}  // Only waits for TMDB
/>

<ContentRow
  title="Top 10 Today"
  items={trending.slice(0, 10)}  
  isLoading={!primaryContentReady}  // Show immediately with cache
/>
```

### 3. Remove Hover Image Pre-blocking

Hover images should preload in background, not block the page:

```text
Before:
  const aboveFoldReady = hoverTotal === 0 ? true : hoverLoaded / hoverTotal >= SHOW_THRESHOLD;
  const pageIsLoading = ... || !aboveFoldReady;

After:
  // Remove aboveFoldReady from blocking conditions
  // Hover images preload naturally when MovieCard is visible
```

### 4. Progressive Post Moderation

Apply blocked post filtering **after** content renders:

```text
// Initial render: show all items
// After moderation loads: filter blocked posts (causes minimal re-render)
const displayItems = isModerationLoading ? items : filterBlockedPosts(items);
```

### 5. Instant Route Ready Signal

Report content ready as soon as TMDB data is available:

```text
useRouteContentReady(!isLoading && trending.length > 0);
// Instead of waiting for all conditions
```

---

## Cache-First Experience

### First Visit (new session)
1. **0ms**: Page renders with skeletons
2. **200-500ms**: TMDB data arrives → Hero + Top 10 appear
3. **Background**: Other rows populate, moderation applies progressively

### Return Visit (same session)
1. **0ms**: Cache loaded → Hero + Top 10 appear **instantly**
2. **Background**: Moderation/availability queries run, apply filtering if needed

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Split loading states, remove hover preload blocking, show content instantly with cache |
| `src/hooks/useRouteContentReady.ts` | No changes needed - just called earlier |

---

## Expected Result
- **Same session**: Homepage appears in <50ms (from cache)
- **New session**: Hero + Top 10 appear in 200-500ms (TMDB response)
- **Progressive enhancement**: Blocked posts filter, hover images load in background

