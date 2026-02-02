
## Fix Manifest Cache and Admin Link Indicators Not Updating

This plan addresses two issues:
1. New posts added to manifest not showing on website (24-hour aggressive cache)
2. Admin dots not glowing for new posts (availability data also cached)

---

### Root Cause Analysis

| Issue | Root Cause | Location |
|-------|------------|----------|
| **Manifest not updating** | 24-hour localStorage cache in `useDbManifest.ts`. When cache is valid, it never fetches new data. | `CACHE_DURATION = 24 * 60 * 60 * 1000` (line 48) |
| **Dots not glowing** | `useEntryAvailability.ts` has a 5-minute stale time. More importantly, the `getAvailability()` function is used but React Query data may be stale. | `staleTime: 5 * 60 * 1000` (line 113) |
| **No session invalidation** | When admin generates manifest, only `localStorage.removeItem("db_manifest_cache")` is called. But next visit still uses cache if session hasn't expired. | `ManifestUpdateTool.tsx` line 177 |
| **Background refresh too slow** | 5-second delay on background refresh means stale data shows first | `setTimeout(checkForUpdates, 5000)` (line 141) |

---

### Solution Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                     BEFORE (broken)                             │
├─────────────────────────────────────────────────────────────────┤
│  localStorage cache: 24 hours                                   │
│  Background refresh: 5 second delay                             │
│  Session check: none                                            │
│  Availability cache: 5 minutes (no refresh on manifest update)  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     AFTER (fixed)                               │
├─────────────────────────────────────────────────────────────────┤
│  localStorage cache: 30 minutes                                 │
│  Session check: Always fetch fresh on new browser session       │
│  Background refresh: Immediate (no delay)                       │
│  Admin update: Invalidates both manifest AND availability cache │
└─────────────────────────────────────────────────────────────────┘
```

---

### Implementation Steps

#### Step 1: Reduce Manifest Cache Duration + Add Session Check

**File:** `src/hooks/useDbManifest.ts`

**Changes:**
1. Reduce `CACHE_DURATION` from 24 hours to 30 minutes
2. Add `SESSION_CHECK_KEY` in sessionStorage - if new session, bypass localStorage cache
3. Remove 5-second delay on background refresh - check immediately
4. Add `refreshManifest()` function for manual refresh

```typescript
const CACHE_KEY = "db_manifest_cache";
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (was 24 hours)
const SESSION_CHECK_KEY = "manifest_session_checked";

// In load function:
const load = async () => {
  // Check if this is a new browser session
  const sessionChecked = sessionStorage.getItem(SESSION_CHECK_KEY);
  
  // Only use cache if session already checked it
  if (sessionChecked) {
    const cached = localStorage.getItem(CACHE_KEY);
    // ... existing cache logic
  }
  
  // Mark session as checked after first load
  sessionStorage.setItem(SESSION_CHECK_KEY, "1");
  
  // ... fetch from storage
};

// In background refresh effect:
useEffect(() => {
  if (!manifest || isFetching) return;

  const checkForUpdates = async () => {
    const fetched = await fetchManifest();
    if (fetched && fetched.generated_at !== manifest.generated_at) {
      console.log("[useDbManifest] New manifest version detected");
      setManifest(fetched);
    }
  };

  // Check immediately, no 5-second delay
  checkForUpdates();
}, [manifest?.generated_at, isFetching]);
```

---

#### Step 2: Clear Session Check After Admin Updates Manifest

**File:** `src/components/admin/ManifestUpdateTool.tsx`

After successful manifest upload, also:
1. Clear the session check flag so next load fetches fresh
2. Invalidate the React Query cache for entry availability

```typescript
// After line 177 (localStorage.removeItem("db_manifest_cache"))
localStorage.removeItem("db_manifest_cache");
sessionStorage.removeItem("manifest_session_checked");

// Invalidate availability cache so dots update
queryClient.invalidateQueries({ queryKey: ["entry-availability"] });
```

This requires:
- Import `useQueryClient` from React Query
- Get `queryClient` in the component

---

#### Step 3: Reduce Entry Availability Stale Time

**File:** `src/hooks/useEntryAvailability.ts`

Reduce stale time from 5 minutes to 1 minute so availability data refreshes more frequently:

```typescript
staleTime: 1 * 60 * 1000, // 1 minute (was 5 minutes)
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useDbManifest.ts` | Reduce cache to 30 min, add session check, immediate background refresh |
| `src/components/admin/ManifestUpdateTool.tsx` | Clear session flag + invalidate availability cache after update |
| `src/hooks/useEntryAvailability.ts` | Reduce stale time to 1 minute |

---

### Expected Behavior After Fix

| Scenario | Before | After |
|----------|--------|-------|
| **New visitor** | Uses 24-hour cache | Always fetches fresh on first visit |
| **Same session, second page** | Uses cache | Uses cache (30 min) |
| **Admin updates manifest** | Only admin sees update | All visitors get fresh data on next visit |
| **Admin dots on new posts** | Don't glow (stale cache) | Glow correctly (1-min stale + invalidation) |
| **Background refresh** | 5 second delay | Immediate check |

---

### Technical Notes

1. **Session check logic**: `sessionStorage` resets when browser tab closes. Each new session forces a fresh manifest fetch, ensuring users see recent updates.

2. **Why 30 minutes?**: Balances performance (fewer fetches) with freshness. Most admins work in sessions, so updates propagate within reasonable time.

3. **Invalidating availability cache**: When admin clicks "Update Data", we also invalidate the React Query cache for entry availability. This ensures the glowing dots update without requiring a page refresh.

4. **Immediate background refresh**: By removing the `setTimeout`, the app checks for manifest updates as soon as the initial data is loaded. If a newer version exists on the server, it updates silently.
