

## Enhanced Post Metadata Editor - Complete Overhaul

This plan addresses all the requested changes to streamline the Post Metadata Editor and remove the Prefill Tool.

---

### Summary of Changes

| Change | Description |
|--------|-------------|
| Remove MetadataPrefillTool | Delete component and its import from UpdateLinksPanel |
| Genre Selector Modal | Dropdown with all genres, multi-select, search, add new |
| Default DB Search | Auto-search Database on Enter, TMDB search as secondary button |
| Advanced Filtering | Sort/filter by missing metadata, recently edited, etc. |
| Remove Admin Edited Checkbox | Auto-set on save, remove on TMDB sync |
| Season/Episode Management | Dropdown selector, add/remove seasons, episode count editing |
| State Persistence | Save editor state to sessionStorage to prevent data loss |

---

### Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/admin/MetadataPrefillTool.tsx` | **Delete** | Remove this component entirely |
| `src/components/admin/UpdateLinksPanel.tsx` | Modify | Remove MetadataPrefillTool import and usage |
| `src/components/admin/PostMetadataEditor.tsx` | **Major Rewrite** | Implement all new features |

---

### Search Behavior (Updated)

**Default: Database Search**
- Press Enter in search box → searches local database
- Shows entries matching title or ID
- Results show poster, title, type, year, and missing metadata indicators

**Secondary: TMDB Search**
- Click "Search TMDB" button to search external API
- Use when content doesn't exist in database yet
- Results show "In DB" badge for items already in database

```
+------------------------------------------------------------------+
| Search: [________________________] [Search TMDB]                  |
|         ↑ Enter = DB Search        ↑ Button for TMDB             |
+------------------------------------------------------------------+
```

---

### Detailed Changes

#### 1. Remove MetadataPrefillTool

**UpdateLinksPanel.tsx changes:**
- Remove import: `import { MetadataPrefillTool } from "./MetadataPrefillTool";`
- Remove from Tools tab: `<MetadataPrefillTool />`

---

#### 2. Genre Selector with Modal

**New behavior:** 
- Click "Genres" area to open a modal/popover
- Modal shows:
  - Search input at top
  - Grid of all TMDB genres (predefined list)
  - Checkboxes for multi-select
  - "Add New Genre" button for custom genres
- Selected genres shown as badges with remove (X) button

**Genre list (TMDB standard):**
```typescript
const TMDB_GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
  // TV-specific
  { id: 10759, name: "Action & Adventure" },
  { id: 10762, name: "Kids" },
  { id: 10763, name: "News" },
  { id: 10764, name: "Reality" },
  { id: 10765, name: "Sci-Fi & Fantasy" },
  { id: 10766, name: "Soap" },
  { id: 10767, name: "Talk" },
  { id: 10768, name: "War & Politics" },
];
```

---

#### 3. Advanced Filtering & Sorting

**Filter bar with:**
- **Filter by missing data:**
  - Without Poster
  - Without Backdrop
  - Without Logo
  - Without Overview
  - Without Genres
  - Without Cast
- **Filter by type:** Movies / Series / All
- **Sort by:**
  - Recently Edited (uses `media_updated_at`)
  - Year (desc/asc)
  - Name (A-Z)
  - Rating (desc)
  - Missing Data Count
- **Recently Edited periods:** All / Last 24h / 7 days / 30 days

---

#### 4. Remove Admin Edited Checkbox

**New automatic behavior:**
- **Auto-set:** When admin saves changes → `admin_edited = true`
- **Auto-clear:** When admin clicks "Sync from TMDB" → `admin_edited = false`
- Show read-only "Admin Edited" badge when true
- No manual checkbox needed

---

#### 5. Enhanced Season/Episode Management

**Season Management:**
```
Season: [Dropdown: Season 1 ▼] [+Add Season] [Delete Season]
```
- Dropdown selector for seasons
- Add new season with specified number
- Delete season with confirmation

**Episode Management:**
```
Episodes in Season 1: 12  [+Add Episode]

[1] Pilot                    [Edit] [Delete] [Sync]
[2] Diversity Day           [Edit] [Delete] [Sync]
...
```
- Show episode count
- Add/edit/delete individual episodes
- Edit episode number, name, overview, thumbnail, air_date, runtime
- Sync individual episodes from TMDB

---

#### 6. State Persistence

**Prevent data loss on focus change:**
```typescript
const EDITOR_CACHE_KEY = "postMetadataEditorState_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Save state on every change (debounced 200ms)
useEffect(() => {
  const handle = setTimeout(() => {
    sessionStorage.setItem(EDITOR_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      searchQuery, searchResults, selectedEntry,
      title, posterUrl, backdropUrl, logoUrl,
      overview, tagline, status, genres, castData,
      episodes, selectedSeason, filterOptions
    }));
  }, 200);
  return () => clearTimeout(handle);
}, [/* dependencies */]);

// Restore state on mount
useEffect(() => {
  const cached = sessionStorage.getItem(EDITOR_CACHE_KEY);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      // Restore all state fields
    }
  }
}, []);
```

---

### New UI Layout

```
+------------------------------------------------------------------+
| Post Metadata Editor                                              |
+------------------------------------------------------------------+
| Search: [________________________] [Search TMDB]                  |
|         Enter = Search Database                                   |
+------------------------------------------------------------------+
| Filters:                                                          |
| Type: [All ▼]  Sort: [Recently Edited ▼]  Edited: [All ▼]        |
| Missing: [ ]Poster [ ]Backdrop [ ]Logo [ ]Overview [ ]Genres     |
+------------------------------------------------------------------+
| Results: (scrollable grid of entry cards)                         |
| [poster] Title (ID) | Movie | 2024 | Missing: Logo, Overview     |
| [poster] Title (ID) | Series | 2023 | Complete                   |
+------------------------------------------------------------------+
| [Selected Entry Editor - appears when entry selected]             |
| +----------------------------------------------------------+     |
| | Title: [___________]  Type: Movie  Year: [____]          |     |
| | [Admin Edited] badge if true                              |     |
| +----------------------------------------------------------+     |
| | Images:                                                   |     |
| | Poster: [url________] [preview]                           |     |
| | Backdrop: [url______] [preview]                           |     |
| | Logo: [url__________] [preview]                           |     |
| +----------------------------------------------------------+     |
| | Overview: [textarea________________________]              |     |
| | Tagline: [______________________________]                 |     |
| | Status: [Dropdown ▼]  Rating: [___]                       |     |
| +----------------------------------------------------------+     |
| | Genres: [Comedy] [Drama] [+Edit Genres]                   |     |
| +----------------------------------------------------------+     |
| | Cast: (top 12 displayed)                                  |     |
| +----------------------------------------------------------+     |
| | [For Series Only]                                         |     |
| | Season: [1 ▼] [+Add] [Delete]  Episodes: 12 [+Add Ep]    |     |
| | [Episode list - expandable for editing]                   |     |
| | [Sync Season] [Sync All Seasons]                          |     |
| +----------------------------------------------------------+     |
| | [Sync from TMDB] [Save Changes]                           |     |
+------------------------------------------------------------------+
```

---

### Genre Modal Design

```
+---------------------------------------+
| Select Genres                     [X] |
+---------------------------------------+
| Search: [______________]              |
+---------------------------------------+
| [ ] Action          [ ] Animation     |
| [x] Comedy          [x] Drama         |
| [ ] Fantasy         [ ] Horror        |
| [ ] Mystery         [ ] Romance       |
| [ ] Sci-Fi          [ ] Thriller      |
| ... (scrollable grid)                 |
+---------------------------------------+
| Add Custom: [________] [+]            |
+---------------------------------------+
| Selected: Comedy, Drama               |
| [Apply] [Cancel]                      |
+---------------------------------------+
```

---

### Estimated Changes

| Component | Lines | Complexity |
|-----------|-------|------------|
| PostMetadataEditor.tsx | ~1500 (rewrite) | High |
| UpdateLinksPanel.tsx | -2 lines | Low |
| Delete MetadataPrefillTool.tsx | -814 lines | N/A |

