

## Post Metadata Editor - Complete Admin Tool

This plan creates a comprehensive **Post Metadata Editor** in the Tools tab that allows admins to:
- Search and find any post by name or TMDB ID
- View and edit ALL metadata fields (title, poster, backdrop, logo, overview, tagline, genres, cast, etc.)
- Edit ALL seasons' episode metadata for series
- Manually sync individual entries or episodes with TMDB (bypassing admin_edited protection)
- Mark entries/episodes as admin-edited to protect from auto-updates during prefill

---

### Overview

The editor will be added to the existing **Tools tab** in the UpdateLinksPanel, providing a complete workflow for managing post metadata that TMDB doesn't have or has incorrectly.

```
+------------------------------------------------------------------+
| Tools Tab                                                         |
+------------------------------------------------------------------+
| [Manifest Update Tool]                                            |
| [Metadata Prefill Tool]                                           |
| [Post Metadata Editor]  <-- NEW                                   |
+------------------------------------------------------------------+
```

---

### UI Design

```
+------------------------------------------------------------------+
| Post Metadata Editor                                              |
| Search and edit complete metadata for any post in the database.   |
+------------------------------------------------------------------+
| Search: [________________________] [Search DB] [Search TMDB]      |
+------------------------------------------------------------------+
| Search Results (clickable cards):                                 |
| +----------------------------------------------------------+     |
| | [poster] The Office (2316) | Series | 2005 | In DB       |     |
| | [poster] Breaking Bad (1396) | Series | 2008 | In DB     |     |
| +----------------------------------------------------------+     |
+------------------------------------------------------------------+
| [Selected Post Details]                                           |
| +----------------------------------------------------------+     |
| | Title: [The Office___________]                            |     |
| | Type: Movie / Series                                      |     |
| | Year: [2005]  Status: [Ended]  Rating: [8.9]             |     |
| |                                                           |     |
| | [Poster URL] ____________ [preview]                       |     |
| | [Backdrop URL] ___________ [preview]                      |     |
| | [Logo URL] _______________ [preview]                      |     |
| |                                                           |     |
| | [Overview] ____________________________                   |     |
| | [Tagline] _____________________________                   |     |
| |                                                           |     |
| | Genres: [Comedy] [Drama] [add...]                         |     |
| |                                                           |     |
| | Cast (top 12):                                            |     |
| | [actor1] [actor2] [actor3] ...                            |     |
| |                                                           |     |
| | [x] Mark as Admin Edited (protects from auto-prefill)     |     |
| |                                                           |     |
| | [Sync All from TMDB] [Save Changes]                       |     |
| +----------------------------------------------------------+     |
+------------------------------------------------------------------+
| [Episode Metadata] (for series only)                              |
| Season: [1] [2] [3] ...  [Sync This Season] [Sync All Seasons]   |
| +----------------------------------------------------------+     |
| | E1: Pilot                                                 |     |
| |     [still] Description... [Edit] [Sync]                  |     |
| | E2: Diversity Day                                         |     |
| |     [still] Description... [Edit] [Sync]                  |     |
| | ...                                                       |     |
| +----------------------------------------------------------+     |
+------------------------------------------------------------------+
```

---

### New Component: `PostMetadataEditor.tsx`

A new component that provides:

1. **Dual Search Modes**:
   - **Search DB**: Query local `entries` table by name or ID
   - **Search TMDB**: Query TMDB API for content not yet in DB

2. **Complete Entry Metadata Editing**:
   - Title, poster URL, backdrop URL, logo URL
   - Overview, tagline
   - Rating (vote_average), status
   - Genres (editable list)
   - Cast data (top 12, editable)
   - Release year, number of seasons/episodes

3. **Episode Metadata Management** (for series):
   - Season selector
   - List of all episodes with expandable edit forms
   - Individual episode fields: name, overview, thumbnail, air_date, runtime, rating
   - "Sync Single Episode" button per episode
   - "Sync This Season" and "Sync All Seasons" bulk actions
   - Episode-level admin_edited flag

4. **Manual Sync Override**:
   - "Sync All from TMDB" button that fetches fresh data regardless of admin_edited flag
   - Previews changes before saving
   - Admin can review and selectively save

5. **Protection Mechanism**:
   - `admin_edited` checkbox on entry level
   - `admin_edited` checkbox on episode level
   - When checked, prefill tool skips these records

---

### Implementation Details

**File: `src/components/admin/PostMetadataEditor.tsx`**

```typescript
// Key state
const [searchQuery, setSearchQuery] = useState("");
const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
const [selectedEntry, setSelectedEntry] = useState<EntryData | null>(null);

// Metadata fields
const [title, setTitle] = useState("");
const [posterUrl, setPosterUrl] = useState("");
const [backdropUrl, setBackdropUrl] = useState("");
const [logoUrl, setLogoUrl] = useState("");
const [overview, setOverview] = useState("");
const [tagline, setTagline] = useState("");
const [genres, setGenres] = useState<Genre[]>([]);
const [castData, setCastData] = useState<CastMember[]>([]);
const [adminEdited, setAdminEdited] = useState(false);

// Episode management
const [selectedSeason, setSelectedSeason] = useState(1);
const [episodes, setEpisodes] = useState<EpisodeMetadata[]>([]);
```

**Key Functions:**

1. `handleSearchDB()` - Query entries table
2. `handleSearchTMDB()` - Query TMDB API via searchMergedGlobal
3. `handleSelectEntry()` - Load full entry data including episodes
4. `handleSyncFromTMDB()` - Fetch fresh TMDB data (ignores admin_edited)
5. `handleSyncSeason()` - Sync single season's episodes from TMDB
6. `handleSyncAllSeasons()` - Sync all seasons from TMDB
7. `handleSave()` - Save entry metadata to entries table
8. `handleSaveEpisodes()` - Save episode metadata to entry_metadata table

---

### Database Queries

**Search DB entries:**
```typescript
const { data } = await supabase
  .from("entries")
  .select("id, type, title, poster_url, release_year, admin_edited")
  .or(`title.ilike.%${query}%,id.eq.${query}`)
  .limit(20);
```

**Load full entry:**
```typescript
const { data } = await supabase
  .from("entries")
  .select("*")
  .eq("id", entryId)
  .single();
```

**Save entry metadata:**
```typescript
await supabase
  .from("entries")
  .update({
    title,
    poster_url,
    backdrop_url,
    logo_url,
    overview,
    tagline,
    genres,
    cast_data,
    status,
    admin_edited,
    // ... other fields
  })
  .eq("id", entryId);
```

---

### Integration with Tools Tab

Update `UpdateLinksPanel.tsx` to include the new component:

```typescript
// In the Tools tab
<TabsContent value="tools" className="space-y-4">
  <ManifestUpdateTool />
  <MetadataPrefillTool />
  <PostMetadataEditor />  {/* NEW */}
</TabsContent>
```

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/admin/PostMetadataEditor.tsx` | **Create** | New comprehensive metadata editor component (~600 lines) |
| `src/components/admin/UpdateLinksPanel.tsx` | Modify | Add import and include PostMetadataEditor in Tools tab |

---

### Feature Comparison

| Feature | Current EpisodeMetadataEditor | New PostMetadataEditor |
|---------|------------------------------|------------------------|
| Search entries | No (requires knowing ID) | Yes (by name or ID) |
| Search TMDB | No | Yes |
| Edit entry metadata | Limited | Full (all fields) |
| Edit genres | No | Yes |
| Edit cast | No | Yes |
| Edit episodes | Yes (one season) | Yes (all seasons) |
| Sync override | No | Yes (ignores admin_edited) |
| Bulk season sync | No | Yes |
| Preview images | Limited | Full (poster, backdrop, logo) |

---

### Workflow Examples

**Adding missing TMDB data:**
1. Admin searches for "The Office" in DB
2. Selects the entry
3. Notices overview is empty
4. Types custom overview
5. Checks "Admin Edited" 
6. Clicks Save

**Syncing outdated entry:**
1. Admin searches for a show
2. Clicks "Sync All from TMDB"
3. Reviews the fetched data
4. Makes adjustments if needed
5. Saves (admin_edited stays on if they want protection)

**Fixing episode thumbnails:**
1. Admin selects a series
2. Navigates to Season 2
3. Finds Episode 5 with missing thumbnail
4. Either enters custom URL or clicks "Sync" on that episode
5. Marks episode as admin_edited
6. Saves

---

### Technical Notes

1. **Search Performance**: DB search uses index on `id` and pattern match on `title`
2. **Image Previews**: Show thumbnail previews for poster, backdrop, logo, and episode stills
3. **Rate Limiting**: When syncing all seasons, maintain 300ms delay between TMDB calls
4. **Optimistic Updates**: Show loading states during save operations
5. **Validation**: Validate URLs before saving
6. **Error Handling**: Toast notifications for success/failure states

---

### Estimated Implementation

| Component | Lines | Complexity |
|-----------|-------|------------|
| PostMetadataEditor.tsx | ~600 | Medium-High |
| UpdateLinksPanel.tsx changes | ~5 | Low |
| **Total** | ~605 lines | |

