

## Enhanced Metadata Management System with Pagination, Filtering, and Session Cache

This plan addresses all the requirements: fixing the 1000-post limit, adding advanced filtering/sorting, showing update progress, and implementing proper session-based caching for both admin and regular users.

---

### Summary of Changes

| Requirement | Solution |
|-------------|----------|
| Fetch ALL posts (beyond 1000) | Implement paginated Supabase fetch using `.range()` |
| Show which post is being updated | Add "Currently Processing" indicator + scrollable "Updated Posts" list |
| List of already updated posts | Maintain a running log of successfully updated posts with titles/IDs |
| Filter: with/without poster, backdrop | Add filter chips for missing metadata fields |
| Filter: year-wise, name search, ID search | Add search input + year dropdown filter |
| Sorting options | Sort by: year, name, ID, rating, missing data priority |
| Admin session cache | Keep cache per session; new session = fresh cache |
| User session cache | Update cache after every new session |

---

### Technical Details

#### Part 1: Fix 1000-Post Limit in Prefill Tool

**File:** `src/components/admin/MetadataPrefillTool.tsx`

Replace the current fetch with paginated fetching:

```typescript
// Paginated fetch to get ALL entries
const fetchAllEntries = async () => {
  const BATCH_SIZE = 1000;
  const allEntries: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    setFetchProgress(`Fetching entries ${from + 1} - ${from + BATCH_SIZE}...`);
    
    const { data, error } = await supabase
      .from("entries")
      .select("id, type, title, admin_edited, poster_url, backdrop_url, logo_url, release_year")
      .or("admin_edited.is.null,admin_edited.eq.false")
      .range(from, from + BATCH_SIZE - 1);

    if (error) throw error;
    if (data && data.length > 0) allEntries.push(...data);
    hasMore = data?.length === BATCH_SIZE;
    from += BATCH_SIZE;
  }

  return allEntries;
};
```

---

#### Part 2: Add Filtering and Sorting

**New state variables:**

```typescript
// Search & Filter state
const [searchQuery, setSearchQuery] = useState("");
const [selectedYear, setSelectedYear] = useState<string>("all");
const [filterMissing, setFilterMissing] = useState<string[]>([]); // ["poster", "backdrop", "logo"]
const [sortBy, setSortBy] = useState<"year" | "name" | "id" | "rating" | "missing">("year");

// Processing tracking
const [allEntries, setAllEntries] = useState<EntryWithMeta[]>([]);
const [updatedEntries, setUpdatedEntries] = useState<{id: string, title: string, success: boolean}[]>([]);
const [failedEntries, setFailedEntries] = useState<{id: string, title: string, error: string}[]>([]);
```

**Filter logic:**

```typescript
const filteredEntries = useMemo(() => {
  let result = allEntries;

  // Search by name or ID
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(e => 
      e.id.toString().includes(q) || 
      e.title?.toLowerCase().includes(q)
    );
  }

  // Filter by year
  if (selectedYear !== "all") {
    if (selectedYear === "null") {
      result = result.filter(e => !e.release_year);
    } else {
      result = result.filter(e => e.release_year === Number(selectedYear));
    }
  }

  // Filter by missing data
  if (filterMissing.includes("poster")) {
    result = result.filter(e => !e.poster_url);
  }
  if (filterMissing.includes("backdrop")) {
    result = result.filter(e => !e.backdrop_url);
  }
  if (filterMissing.includes("logo")) {
    result = result.filter(e => !e.logo_url);
  }

  // Sort
  return result.sort((a, b) => {
    switch (sortBy) {
      case "year": 
        return (b.release_year ?? 0) - (a.release_year ?? 0);
      case "name": 
        return (a.title ?? "").localeCompare(b.title ?? "");
      case "id": 
        return a.id.localeCompare(b.id);
      case "rating":
        return (b.vote_average ?? 0) - (a.vote_average ?? 0);
      case "missing":
        // Priority: most missing fields first
        const missingA = [!a.poster_url, !a.backdrop_url, !a.logo_url].filter(Boolean).length;
        const missingB = [!b.poster_url, !b.backdrop_url, !b.logo_url].filter(Boolean).length;
        return missingB - missingA;
      default: 
        return 0;
    }
  });
}, [allEntries, searchQuery, selectedYear, filterMissing, sortBy]);
```

---

#### Part 3: Enhanced UI with Progress Tracking

**New UI sections:**

```text
[Prefill All Metadata Tool]
├── [Filters Section]
│   ├── Search Input (by name or ID)
│   ├── Year Dropdown (2026, 2025, 2024..., No Year)
│   ├── Filter Chips: Missing Poster | Missing Backdrop | Missing Logo
│   └── Sort Dropdown: Year | Name | ID | Rating | Missing Data First
│
├── [Stats Bar]
│   ├── Total: 2,847 | Filtered: 423 | To Process: 423
│   └── [Button] Prefill Filtered | [Button] Prefill All
│
├── [Progress Section] (when running)
│   ├── Progress Bar (X / Total)
│   ├── Currently Processing: "Inception (550)" [movie]
│   └── Rate: ~3.2 posts/sec
│
├── [Updated Posts Log] (scrollable, max-height: 300px)
│   ├── [success] Inception (550) - Updated poster, backdrop, logo
│   ├── [success] Breaking Bad (1396) - Updated 5 seasons, 62 episodes
│   ├── [failed] Unknown Movie (999) - TMDB 404
│   └── ...
│
└── [Action Buttons]
    ├── [Pause] | [Resume] | [Stop]
    └── [Export Log] (download CSV of results)
```

---

#### Part 4: Session-Based Cache for Admin vs User

**New file:** `src/hooks/useAdminSessionCache.ts`

```typescript
const ADMIN_CACHE_PREFIX = "admin_";
const USER_CACHE_PREFIX = "user_";
const SESSION_KEY = "cache_session_id";

export function useAdminSessionCache() {
  const { isAdmin } = useAdminStatus();
  
  useEffect(() => {
    const currentSession = sessionStorage.getItem(SESSION_KEY);
    
    if (!currentSession) {
      // New session - generate session ID
      const newSessionId = Date.now().toString();
      sessionStorage.setItem(SESSION_KEY, newSessionId);
      
      // Clear user's old localStorage cache (they get fresh data each session)
      if (!isAdmin) {
        clearUserCache();
      }
      // Admin keeps session cache - it auto-clears when browser closes
    }
  }, [isAdmin]);
}

// For admin: use sessionStorage (cleared on tab close)
// For users: refresh localStorage cache on new session
```

**Modify:** `src/hooks/useDbManifest.ts`

```typescript
// Add admin-aware caching
const { isAdmin } = useAdminStatus();

// Admin: always use sessionStorage (fresh per browser session)
// User: use localStorage with session check (refresh on new session)

if (isAdmin) {
  // Admin cache in sessionStorage only
  const adminCacheKey = "admin_db_manifest";
  const cached = sessionStorage.getItem(adminCacheKey);
  // ...
} else {
  // User cache: check session flag, refresh if new session
  const sessionChecked = sessionStorage.getItem("user_manifest_session");
  if (!sessionChecked) {
    // New session - force fresh fetch
    localStorage.removeItem("db_manifest_cache");
    sessionStorage.setItem("user_manifest_session", "1");
  }
}
```

---

### Files to Create

| File | Description |
|------|-------------|
| `src/hooks/useAdminSessionCache.ts` | Session-aware cache management for admin vs user |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/MetadataPrefillTool.tsx` | Complete rewrite with pagination, filtering, sorting, progress UI |
| `src/hooks/useDbManifest.ts` | Add admin-aware caching logic |
| `src/hooks/useSessionCacheManager.ts` | Enhance to handle admin vs user distinction |
| `src/hooks/useHomepageCache.ts` | Add session-aware refresh for users |

---

### Enhanced MetadataPrefillTool UI Layout

```text
+-----------------------------------------------------------------------+
| [Prefill All Metadata]                                                |
| Fetch complete TMDB data for all entries. Shows progress and results. |
+-----------------------------------------------------------------------+
| [Search: _______________] [Year: All v] [Sort: Year v]                |
| [ ] Missing Poster  [ ] Missing Backdrop  [ ] Missing Logo            |
+-----------------------------------------------------------------------+
| Showing 423 of 2,847 entries | Admin Edited: 156 (skipped)            |
+-----------------------------------------------------------------------+
| [Prefill Filtered (423)]  [Prefill All (2,691)]  [Stop]               |
+-----------------------------------------------------------------------+
| Progress: ████████░░░░░░░░░░ 234 / 423 (55%)                          |
| Currently: Breaking Bad (1396) - Fetching Season 3 episodes...        |
+-----------------------------------------------------------------------+
| Recent Updates:                                            [Clear Log] |
| ┌─────────────────────────────────────────────────────────────────┐   |
| │ [✓] Inception (550) - Updated poster, backdrop, logo            │   |
| │ [✓] Breaking Bad (1396) - Updated 5 seasons (62 episodes)       │   |
| │ [✓] The Office (2316) - Updated 9 seasons (201 episodes)        │   |
| │ [✗] Unknown (99999) - TMDB Error: Not Found                     │   |
| │ [✓] Interstellar (157336) - Updated poster, backdrop            │   |
| │ ... (scrollable)                                                │   |
| └─────────────────────────────────────────────────────────────────┘   |
+-----------------------------------------------------------------------+
| Stats: Updated 234 | Failed 2 | Skipped 156 | Rate: 3.2/sec           |
+-----------------------------------------------------------------------+
```

---

### Cache Behavior Summary

| Scenario | Admin | User |
|----------|-------|------|
| Same session, navigate pages | Use sessionStorage cache | Use sessionStorage cache |
| New browser session (tab reopened) | Fresh fetch (sessionStorage cleared) | Fresh fetch + update localStorage |
| Tab switch (same session) | Keep cache | Keep cache |
| Force refresh (Ctrl+Shift+R) | Fresh fetch | Fresh fetch |
| After "Update Data" tool | Cache invalidated | Gets new data on next session |

---

### Estimated Changes

| File | Lines Added/Modified |
|------|---------------------|
| `src/components/admin/MetadataPrefillTool.tsx` | ~400 lines (major rewrite) |
| `src/hooks/useAdminSessionCache.ts` | ~80 lines (new file) |
| `src/hooks/useDbManifest.ts` | ~30 lines modified |
| `src/hooks/useSessionCacheManager.ts` | ~20 lines modified |
| `src/hooks/useHomepageCache.ts` | ~15 lines modified |

