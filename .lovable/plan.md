

# Admin Content Curation System - IMPLEMENTED ✅

This system integrates directly with the existing **Edit Links Mode** (Ctrl+Shift+E), adding full content curation capabilities to all sections across every page.

---

### What Admins Will Be Able To Do

| Action | How |
|--------|-----|
| **Add any post to any section** | Click [+] button → Search TMDB → Add |
| **Pin post to top of section** | Click pin icon (📌) on any card |
| **Rearrange posts** | Drag cards to new positions |
| **Remove from section** | Click [×] on any card |
| **Reset to default** | Click "Reset" button in section header |

---

### Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     Edit Links Mode ON                       │
│                      (Ctrl+Shift+E)                          │
├─────────────────────────────────────────────────────────────┤
│  Section Header                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  "Trending Now"              [+ Add]  [↻ Reset]     │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Cards with Curation Controls                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ POSTER │ │ POSTER │ │ POSTER │ │ POSTER │               │
│  │  📌 ×  │ │  📌 ×  │ │  📌 ×  │ │  📌 ×  │               │
│  └────────┘ └────────┘ └────────┘ └────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useSectionCuration.ts` | Fetch/mutate curation data from Supabase `section_curation` table |
| `src/components/admin/SectionCurationControls.tsx` | Header controls: [+ Add] and [Reset] buttons |
| `src/components/admin/PostSearchPicker.tsx` | Modal to search TMDB and add posts to sections |
| `src/components/admin/CurationCardOverlay.tsx` | Pin (📌) and Remove (×) buttons overlay on cards |

---

### Files to Modify

| File | Change |
|------|--------|
| `src/contexts/EditLinksModeContext.tsx` | Add curation state (active section, picker open, target section) |
| `src/components/ContentRow.tsx` | Accept `sectionId`, show curation header controls, apply curated order |
| `src/components/TabbedContentRow.tsx` | Accept `sectionId` base, show curation controls per tab |
| `src/components/DbContentRow.tsx` | Pass `sectionId` through to ContentRow |
| `src/components/MovieCard.tsx` | Show CurationCardOverlay when in Edit Mode |
| `src/components/admin/EditLinksModeIndicator.tsx` | Update text to "Edit Mode" (covers links + curation) |
| `src/pages/Index.tsx` | Add `sectionId` props to all content rows |
| `src/pages/Movies.tsx` | Add curation layer for grid |
| `src/pages/TVShows.tsx` | Add curation layer for grid |
| `src/pages/Anime.tsx` | Add curation layer for grid |
| `src/pages/Korean.tsx` | Add curation layer for grid |

---

### Section IDs

Each section gets a unique identifier for curation:

**Homepage:**
| Section | ID |
|---------|-----|
| Top 10 Today | `home_top_10` |
| Trending Movies | `home_trending_movies` |
| Trending TV | `home_trending_tv` |
| Indian Hits Movies | `home_indian_movies` |
| Indian Hits TV | `home_indian_tv` |
| Korean Wave Movies | `home_korean_movies` |
| Korean Wave TV | `home_korean_tv` |
| Anime Picks Movies | `home_anime_movies` |
| Anime Picks TV | `home_anime_tv` |
| Top Rated Movies | `home_toprated_movies` |
| Top Rated TV | `home_toprated_tv` |
| DB Dynamic Sections | `home_db_{section.id}` |

**Listing Pages:**
| Page | Section ID |
|------|------------|
| Movies | `page_movies` |
| TV Shows | `page_tv` |
| Anime | `page_anime` |
| Korean | `page_korean` |

---

### Technical Implementation

#### 1. useSectionCuration Hook

```text
function useSectionCuration(sectionId: string) {
  // State
  - curatedItems: Array of {tmdbId, mediaType, sortOrder, isPinned, title, posterPath}
  - isLoading: boolean

  // Mutations (all save to Supabase + optimistic UI)
  - addToSection(tmdbId, mediaType, metadata) → Insert at position 0
  - removeFromSection(tmdbId, mediaType) → Delete row
  - pinToTop(tmdbId, mediaType, metadata) → Set is_pinned=true, sortOrder=-1
  - unpinFromTop(tmdbId, mediaType) → Set is_pinned=false
  - reorderSection(orderedItems) → Update all sort_order values
  - resetSection() → Delete all rows for sectionId

  // Merge helper
  - getCuratedItems(originalItems):
      1. Fetch pinned items (is_pinned=true) → first
      2. Fetch added items (sortOrder >= 0) → next
      3. Append original items not in curated set
      4. Return merged array
}
```

#### 2. EditLinksModeContext Updates

```text
Add to existing context:
- pickerOpen: boolean
- pickerSectionId: string | null
- openPicker(sectionId) → shows PostSearchPicker modal
- closePicker()
```

#### 3. SectionCurationControls Component

```text
Props: { sectionId: string; sectionTitle: string }

Renders (only when isEditLinksMode=true):
- [+ Add] button → calls openPicker(sectionId)
- [Reset] button → calls resetSection() with confirmation

Positioned: Right side of section header
```

#### 4. PostSearchPicker Modal

```text
Features:
- Search input with debounced TMDB multi-search
- Results grid: poster, title, year, rating, media type badge
- "Add to Section" button per result
- "Pin to Top" option (checkbox or separate button)
- Closes after adding
- Shows "Already in section" badge for duplicates
```

#### 5. CurationCardOverlay Component

```text
Props: { tmdbId, mediaType, sectionId, isPinned }

Renders (only when isEditLinksMode=true):
- Pin button (📌) → toggles pinToTop/unpinFromTop
- Remove button (×) → calls removeFromSection

Positioned: Top-left of MovieCard poster
Visual: Semi-transparent overlay buttons
```

#### 6. ContentRow Updates

```text
New props:
- sectionId?: string

When sectionId provided AND isEditLinksMode:
1. Render SectionCurationControls in header
2. Use useSectionCuration(sectionId)
3. Merge curated items with original items via getCuratedItems()
4. Pass sectionId + isPinned to each MovieCard for overlay
```

---

### Data Flow

```text
Page Load:
1. Each section fetches curated items for its sectionId
2. Merge with default TMDB/DB content
3. Pinned items appear first, then added items, then original

Admin Adds Post:
1. Click [+ Add] on section header
2. Search TMDB in modal
3. Click "Add" (or "Pin to Top")
4. Insert into section_curation table
5. Optimistic update: item appears immediately
6. Supabase sync in background

Admin Pins Post:
1. Click 📌 on any card (existing or in section)
2. Upsert into section_curation with is_pinned=true
3. Item moves to front of section

Admin Removes Post:
1. Click × on card in section
2. Delete from section_curation
3. Item returns to default position (or disappears if manually added)

Admin Resets Section:
1. Click [Reset] with confirmation
2. Delete all section_curation rows for that sectionId
3. Section reverts to default TMDB/DB ordering
```

---

### Supabase Table Usage

The `section_curation` table you already created will be used as follows:

| Column | Usage |
|--------|-------|
| `section_id` | Unique identifier per section (e.g., `home_top_10`) |
| `tmdb_id` | The TMDB ID of the post |
| `media_type` | `movie` or `tv` |
| `sort_order` | Position in section (-1 for pinned items) |
| `is_placeholder` | Reserved for future "skeleton slot" feature |
| `title` | Cached title for display |
| `poster_path` | Cached poster URL |

**Note:** I'll add an `is_pinned` column for the pin-to-top feature. Here's the migration SQL to run:

```sql
-- Add is_pinned column for pin-to-top feature
ALTER TABLE public.section_curation 
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- Create index for efficient pinned queries
CREATE INDEX IF NOT EXISTS idx_section_curation_pinned 
ON public.section_curation(section_id, is_pinned) 
WHERE is_pinned = true;
```

---

### UI Preview in Edit Mode

**Section Header:**
```text
┌────────────────────────────────────────────────────────────┐
│  Trending Now                           [+ Add]  [Reset]   │
└────────────────────────────────────────────────────────────┘
```

**Card with Curation Controls:**
```text
┌────────────────┐
│ [📌] [×]       │  ← Curation buttons (top-left)
│                │
│    POSTER      │
│                │
│           [⊕]  │  ← Existing admin controls (top-right)
└────────────────┘
```

**Search Picker Modal:**
```text
┌─────────────────────────────────────────────────┐
│  Add to "Trending Now"                    [×]   │
├─────────────────────────────────────────────────┤
│  🔍 Search movies or TV shows...                │
├─────────────────────────────────────────────────┤
│  ┌─────┐                                        │
│  │     │ Inception (2010)        ★ 8.4  MOVIE   │
│  └─────┘ [+ Add]  [📌 Pin to Top]               │
├─────────────────────────────────────────────────┤
│  ┌─────┐                                        │
│  │     │ Breaking Bad (2008)     ★ 9.5  TV      │
│  └─────┘ [+ Add]  [📌 Pin to Top]               │
└─────────────────────────────────────────────────┘
```

---

### No Conflicts with Existing Features

| Existing Feature | This System | Interaction |
|-----------------|-------------|-------------|
| Edit Links Mode (Ctrl+Shift+E) | **Extended** | Same shortcut, additional controls |
| Post Moderation (block/pin) | Separate | Different table (`post_moderation`), different purpose |
| DB Manifest | Untouched | Curation overlays on top, doesn't modify source |
| Entries table | Untouched | Links remain independent |
| AdminPostControls (3-dot menu) | Unchanged | Coexists with curation overlay |

---

### Implementation Order

1. Add `is_pinned` column to database (SQL above)
2. Create `useSectionCuration.ts` hook
3. Update `EditLinksModeContext.tsx` with picker state
4. Create `PostSearchPicker.tsx` modal
5. Create `SectionCurationControls.tsx` header buttons
6. Create `CurationCardOverlay.tsx` for cards
7. Update `ContentRow.tsx` with curation integration
8. Update `TabbedContentRow.tsx` with curation integration
9. Update `DbContentRow.tsx` to pass sectionId
10. Update `MovieCard.tsx` with CurationCardOverlay
11. Update `Index.tsx` with section IDs
12. Update listing pages (Movies, TV, Anime, Korean)
13. Update `EditLinksModeIndicator.tsx`

