

## Fix New Posts Not Showing at Top of Pages

New 2026/2025 posts are being added to the manifest but not appearing at the top of listing pages. This plan fixes the sorting logic to ensure newest items always appear first.

---

### Root Cause Analysis

| Issue | Root Cause | Impact |
|-------|------------|--------|
| **Many items not on Movies page** | Indian content (`hi`, `ta`, `te` languages) is correctly filtered to show only on the dedicated category pages | Expected behavior - not a bug |
| **Items with null year sort to bottom** | `sortYear = item.release_year ?? 0` makes null years become year 0 | New items without release_year appear at bottom instead of top |
| **Homepage sections not sorted** | `useDbSections.ts` filters items but doesn't sort by year before slicing | "Just Added" section shows items in random order, not newest-first |

---

### Solution

#### 1. Fix Null Year Sorting

**Files:** `Movies.tsx`, `TVShows.tsx`, `Anime.tsx`, `Korean.tsx`

Change the fallback for null release years from `0` to current year:

```typescript
// Before:
const sortYear = item.release_year ?? 0;

// After:
const sortYear = item.release_year ?? new Date().getFullYear();
```

This ensures newly added items without release year metadata appear at the **top** (treated as "this year") rather than the bottom (treated as year 0).

---

#### 2. Sort Homepage Sections by Year

**File:** `src/hooks/useDbSections.ts`

Add sorting before slicing to ensure newest items appear first:

```typescript
// Before (line 109-115):
const filtered = items
  .filter((item) => {
    const key = `${item.id}-${item.media_type}`;
    if (usedIds.has(key)) return false;
    return config.filter(item);
  })
  .slice(0, config.limit);

// After:
const filtered = items
  .filter((item) => {
    const key = `${item.id}-${item.media_type}`;
    if (usedIds.has(key)) return false;
    return config.filter(item);
  })
  .sort((a, b) => {
    // Sort by release year descending (newest first)
    const yearA = a.release_year ?? new Date().getFullYear();
    const yearB = b.release_year ?? new Date().getFullYear();
    if (yearB !== yearA) return yearB - yearA;
    // Secondary sort by rating
    return (b.vote_average ?? 0) - (a.vote_average ?? 0);
  })
  .slice(0, config.limit);
```

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Movies.tsx` | Line 116: `release_year ?? 0` → `release_year ?? new Date().getFullYear()` |
| `src/pages/TVShows.tsx` | Line 105: `release_year ?? 0` → `release_year ?? new Date().getFullYear()` |
| `src/pages/Anime.tsx` | Line 125: `release_year ?? 0` → `release_year ?? new Date().getFullYear()` |
| `src/pages/Korean.tsx` | Line 119: `release_year ?? 0` → `release_year ?? new Date().getFullYear()` |
| `src/hooks/useDbSections.ts` | Lines 109-115: Add `.sort()` before `.slice()` |

---

### Expected Behavior After Fix

| Page | Before | After |
|------|--------|-------|
| **Movies** | 2026 items may appear after older items | 2026 items appear first |
| **TV Shows** | Same issue | 2026 items appear first |
| **Anime** | Same issue | 2026 items appear first |
| **Korean** | Same issue | 2026 items appear first |
| **Homepage "Just Added"** | Random order within 2024+ items | Sorted by year desc, then rating |
| **Items with null year** | Sort to bottom (year = 0) | Sort to top (year = current) |

---

### Important Note About Content Scoping

Many of your newly added posts are Indian content (Hindi, Telugu languages). These are **correctly** filtered to only appear on the dedicated category pages:

| Content | Language | Where It Appears |
|---------|----------|------------------|
| "Mrs. Deshpande" | Hindi (`hi`) | Indian category page |
| "The Girlfriend" | Telugu (`te`) | Indian category page |
| "Haq" | Hindi (`hi`) | Indian category page |
| "HIM" | English (`en`) | Movies page (main) |

This is expected behavior - content is scoped to prevent overlap between category pages. To see Indian content, users should navigate to the Indian category page.

---

### Technical Notes

1. **`new Date().getFullYear()`** returns 2026 for the current date, ensuring newly added items with missing years sort to the very top

2. **Stable sorting** - JavaScript's sort is stable in modern engines, so items with the same year maintain their relative order

3. **Performance** - The sort operation is O(n log n) but operates on small arrays (typically <100 items per section), so no performance impact

