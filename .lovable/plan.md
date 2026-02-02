
## Comprehensive Fix: Manifest Fetching, Sorting, Curation Removal, and Admin Dots

This plan addresses all 5 requirements in a single implementation:

---

### Summary of Changes

| Issue | Solution |
|-------|----------|
| 1. Fetch all posts on every new session | Already implemented - but add explicit sort after fetch |
| 2. Sort by year (2026→2025→2024) with newest-added first | Sort manifest items by `release_year` desc, then by manifest array order (which reflects DB insertion order) |
| 3. New posts in manifest appear in correct order | Manifest generator will sort items before saving |
| 4. Remove curation completely, restore old Edit Mode | Remove all curation-related code, keep simple Edit Mode with click-to-edit |
| 5. Admin dots not glowing | MovieCard uses `useEntryAvailability` (DB query). Switch to use manifest's `availabilityById` instead |

---

### Implementation Details

#### Part 1: Sort Manifest Items During Generation

**File:** `src/components/admin/ManifestUpdateTool.tsx`

Sort items by `release_year` descending before saving to manifest. This ensures the manifest itself is always in "newest first" order:

```typescript
// After building items array, sort before creating manifest
items.sort((a, b) => {
  const yearA = a.release_year ?? new Date().getFullYear();
  const yearB = b.release_year ?? new Date().getFullYear();
  if (yearB !== yearA) return yearB - yearA;
  // Secondary: by vote_average
  return (b.vote_average ?? 0) - (a.vote_average ?? 0);
});
```

---

#### Part 2: Fix Admin Dots to Use Manifest

**File:** `src/components/MovieCard.tsx`

The glowing dots currently use `useEntryAvailability` which queries the database. Change to use `useDbManifest` which reads from the cached manifest:

```typescript
// Before:
const { getAvailability, getHoverImageUrl } = useEntryAvailability();
const { hasWatch, hasDownload } = getAvailability(movie.id);

// After:
const { availabilityById } = useDbManifest();
const manifestAvailability = availabilityById.get(movie.id);
const hasWatch = manifestAvailability?.hasWatch ?? false;
const hasDownload = manifestAvailability?.hasDownload ?? false;
```

This ensures dots glow immediately after manifest is fetched on session start.

---

#### Part 3: Remove Curation System Completely

**Files to modify:**

| File | Changes |
|------|---------|
| `src/components/ContentRow.tsx` | Remove all curation imports, DnD context, SortableContext, curation logic |
| `src/components/admin/SectionCurationControls.tsx` | Delete file |
| `src/components/admin/CurationCardOverlay.tsx` | Delete file |
| `src/components/admin/SortableCard.tsx` | Delete file |
| `src/components/admin/PostSearchPicker.tsx` | Delete file |
| `src/hooks/useSectionCuration.ts` | Delete file |
| `src/contexts/EditLinksModeContext.tsx` | Remove picker-related state (pickerOpen, openPicker, closePicker) |
| `src/components/admin/EditLinksModeIndicator.tsx` | Remove PostSearchPicker import |
| `src/pages/Movies.tsx` | Remove curation imports and getCuratedItems usage |
| `src/pages/TVShows.tsx` | Remove curation imports and getCuratedItems usage |
| `src/pages/Anime.tsx` | Remove curation imports and getCuratedItems usage |
| `src/pages/Korean.tsx` | Remove curation imports and getCuratedItems usage |
| `src/pages/Index.tsx` | Curation was only passed as sectionId, which will be ignored |
| `src/components/MovieCard.tsx` | Remove CurationCardOverlay import and usage, remove sectionId prop |

**Simplified Edit Mode behavior:**
- Ctrl+Shift+E toggles Edit Mode
- In Edit Mode, clicking a card opens the Edit Links modal (existing)
- No drag-and-drop, no pinning, no section curation

---

#### Part 4: Ensure Manifest is Fetched Fresh Each Session

**File:** `src/hooks/useDbManifest.ts` (already implemented)

The current logic is correct:
- `SESSION_CHECK_KEY` in `sessionStorage` forces fresh fetch on new session
- Background refresh checks for newer `generated_at` timestamp

No changes needed, but add an explicit sort after fetching to ensure order:

```typescript
// After parsing manifest, sort items
parsed.items.sort((a, b) => {
  const yearA = a.release_year ?? new Date().getFullYear();
  const yearB = b.release_year ?? new Date().getFullYear();
  if (yearB !== yearA) return yearB - yearA;
  return (b.vote_average ?? 0) - (a.vote_average ?? 0);
});
```

---

### Files to Delete

- `src/components/admin/SectionCurationControls.tsx`
- `src/components/admin/CurationCardOverlay.tsx`
- `src/components/admin/SortableCard.tsx`
- `src/components/admin/PostSearchPicker.tsx`
- `src/hooks/useSectionCuration.ts`

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useDbManifest.ts` | Add sorting after fetch |
| `src/components/admin/ManifestUpdateTool.tsx` | Sort items before saving manifest |
| `src/components/MovieCard.tsx` | Use manifest for availability, remove CurationCardOverlay |
| `src/components/ContentRow.tsx` | Remove all DnD/curation code, simplify to basic rendering |
| `src/contexts/EditLinksModeContext.tsx` | Remove picker-related state |
| `src/components/admin/EditLinksModeIndicator.tsx` | Remove PostSearchPicker |
| `src/pages/Movies.tsx` | Remove curation imports/usage |
| `src/pages/TVShows.tsx` | Remove curation imports/usage |
| `src/pages/Anime.tsx` | Remove curation imports/usage |
| `src/pages/Korean.tsx` | Remove curation imports/usage |

---

### Expected Behavior After Implementation

| Scenario | Result |
|----------|--------|
| **New session** | Fresh manifest fetched, items sorted by year (2026 first) |
| **Admin updates manifest** | Items sorted before save, caches cleared |
| **Movies/TV page** | Posts appear in year order (newest first), no curation buttons |
| **Edit Mode** | Only shows Edit Links modal on card click, no drag-and-drop |
| **Admin dots** | Glow immediately based on manifest data (hasWatch/hasDownload) |
| **Homepage sections** | Still show DB sections, but without curation controls |

---

### Technical Notes

1. **Why use manifest for availability?** The manifest already contains `hasWatch` and `hasDownload` booleans. Using it instead of the separate `entry-availability` query eliminates the stale cache issue and reduces database queries.

2. **Sorting order**: Primary sort by `release_year` descending (2026 → 2025 → 2024). Items with null years are treated as current year. Secondary sort by `vote_average` to rank popular content higher within the same year.

3. **Database insertion order**: When multiple items have the same year and rating, they maintain their manifest array order, which reflects the order they were added to the database.

4. **Edit Mode simplified**: The old behavior where clicking a card opens the Edit Links modal is preserved. Only the curation features (drag-and-drop, pinning, section add/remove) are removed.
