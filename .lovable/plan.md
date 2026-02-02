
## Complete Metadata Management System Implementation

This plan removes all tools except "Update Manifest" and creates a comprehensive metadata management system with the features you requested.

---

### Database Already Set Up

You've confirmed these are complete:
1. `admin_edited` column on `entries` table
2. `entry_metadata` table for episode details  
3. RLS policies with `has_role` function
4. Index for faster lookups

---

### Summary of Changes

| Feature | Implementation |
|---------|----------------|
| Remove old backfill tools | Delete MetadataBackfillTool and ArtworkBackfillTool |
| Prefill All Posts tool | New component that fetches TMDB data for all entries, skips `admin_edited=true` |
| Prefill Single Post | Button in Update tab to refresh one post from TMDB |
| Auto-fetch on Save | When saving links, automatically fetch and save all TMDB metadata |
| Episode metadata storage | Save episode names, overviews, thumbnails to `entry_metadata` table |
| Admin-editable fields | Allow editing poster, backdrop, logo, overview, episode details |
| Skip admin-edited posts | Prefill tool respects `admin_edited` flag |
| Store URLs only | All images stored as URLs, never binary data |

---

### Files to Create

#### 1. `src/hooks/useEntryMetadata.ts`
Hook for CRUD operations on the `entry_metadata` table:
- `fetchEpisodeMetadata(entryId, seasonNumber)` - Get episodes from DB
- `saveEpisodeMetadata(entryId, seasonNumber, episodes[])` - Save/update episodes
- `markEntryAdminEdited(entryId, edited)` - Toggle admin_edited flag

#### 2. `src/components/admin/MetadataPrefillTool.tsx`
New bulk prefill tool that:
- Fetches all entries from database
- For each entry where `admin_edited = false`:
  - Fetches complete TMDB details (poster, backdrop, logo, overview, runtime, etc.)
  - For series: fetches ALL seasons and ALL episodes
  - Saves episode data to `entry_metadata` table
- Shows progress with processed/updated/skipped/failed counts
- Rate-limiting with retry logic for TMDB 429 errors
- Batch processing (5 entries at a time with delays)

#### 3. `src/components/admin/EpisodeMetadataEditor.tsx`
Component for editing episode details within a season:
- Shows list of episodes with expandable rows
- Editable fields per episode: name, overview, thumbnail URL
- "Mark as Admin Edited" checkbox to prevent auto-overwrite
- "Refresh from TMDB" button per episode

---

### Files to Modify

#### 1. `src/components/admin/UpdateLinksPanel.tsx`

**Remove imports:**
```typescript
// DELETE these lines:
import { MetadataBackfillTool } from "@/components/admin/MetadataBackfillTool";
import { ArtworkBackfillTool } from "@/components/admin/ArtworkBackfillTool";
```

**Add new imports:**
```typescript
import { MetadataPrefillTool } from "@/components/admin/MetadataPrefillTool";
import { EpisodeMetadataEditor } from "@/components/admin/EpisodeMetadataEditor";
import { useEntryMetadata } from "@/hooks/useEntryMetadata";
```

**Add new state for editable fields:**
```typescript
const [posterUrl, setPosterUrl] = useState("");
const [backdropUrl, setBackdropUrl] = useState("");
const [logoUrl, setLogoUrl] = useState("");
const [overview, setOverview] = useState("");
const [adminEdited, setAdminEdited] = useState(false);
const [showEpisodeEditor, setShowEpisodeEditor] = useState(false);
```

**Add editable metadata section** (after the link inputs):
- Poster URL input with preview thumbnail
- Backdrop URL input with preview
- Logo URL input with preview
- Overview textarea
- "Admin Edited" toggle switch
- For series: "Manage Episodes" button to open episode editor

**Modify `handleSave`:**
1. After saving links, fetch complete TMDB metadata
2. If user provided custom URLs, use those instead of TMDB
3. Save `admin_edited` flag if user edited any field
4. For series: fetch and save episode metadata to `entry_metadata`

**Add "Refresh from TMDB" button** in the result card that:
- Fetches fresh TMDB data
- Updates all fields (respects `admin_edited` for individual fields)

**Update Tools tab:**
```typescript
<TabsContent value="tools" className="space-y-4">
  <ManifestUpdateTool />
  <MetadataPrefillTool />  {/* NEW - replaces old tools */}
</TabsContent>
```

---

#### 2. `src/hooks/useEntries.ts`

**Update `EntryData` interface:**
```typescript
interface EntryData {
  // existing fields...
  overview?: string | null;
  tagline?: string | null;
  runtime?: number | null;
  number_of_seasons?: number | null;
  admin_edited?: boolean;
}
```

**Update save functions** to include new fields:
- `overview`, `tagline`, `runtime`, `number_of_seasons`
- `admin_edited` flag

---

#### 3. `src/pages/TVDetails.tsx`

**Add check for stored episode metadata:**
1. Before fetching from TMDB, query `entry_metadata` table
2. If episodes exist in DB, use those instead
3. Only fall back to TMDB if no stored data

```typescript
// In fetchData function, after getting show details:
const storedEpisodes = await fetchEpisodeMetadata(Number(id), firstSeason);
if (storedEpisodes && storedEpisodes.length > 0) {
  // Use stored episode data
  setEpisodes(storedEpisodes);
} else {
  // Fall back to TMDB
  const seasonRes = await getTVSeasonDetails(Number(id), firstSeason);
  setEpisodes(seasonRes.episodes);
}
```

---

### Files to Delete

1. `src/components/admin/MetadataBackfillTool.tsx`
2. `src/components/admin/ArtworkBackfillTool.tsx`

---

### UI Flow After Implementation

```text
Admin Dashboard > Update Links

[Update] Tab
├── Search by TMDB ID or Title
├── Result Card (with poster)
│   ├── Type toggle (Movie/Series)
│   ├── [Button] "Refresh from TMDB" (prefill this post)
│   └── [Badge] "Admin Edited" (if manually modified)
├── Link Inputs (existing)
│   ├── Watch Link(s)
│   └── Download Link(s)
├── NEW: Metadata Section
│   ├── Poster URL [input] + preview
│   ├── Backdrop URL [input] + preview
│   ├── Logo URL [input] + preview
│   ├── Overview [textarea]
│   ├── [Toggle] "Mark as Admin Edited" (skips auto-prefill)
│   └── For Series: [Button] "Manage Episodes"
│       └── Opens EpisodeMetadataEditor modal
└── [Button] Save (auto-fetches TMDB data if not admin-edited)

[Trash] Tab (unchanged)

[Tools] Tab
├── Update Manifest (kept)
└── Prefill All Metadata (NEW - replaces old tools)
    ├── [Button] "Prefill All Posts"
    ├── Skips admin_edited entries
    ├── Fetches movie/series details + all episodes
    └── Shows progress: Updated / Skipped / Failed
```

---

### Auto-Fetch on Save Flow

```text
1. Admin clicks "Save"
2. System saves links to entries table
3. If NOT admin_edited:
   a. Fetch TMDB details (poster, backdrop, logo, overview, etc.)
   b. For series: fetch all seasons + episodes
   c. Save metadata to entries table
   d. Save episodes to entry_metadata table
4. If admin_edited:
   a. Only save what admin explicitly edited
   b. Don't overwrite with TMDB data
5. Show success toast
```

---

### Prefill All Flow

```text
1. Admin clicks "Prefill All Posts"
2. Fetch all entries from database
3. For each entry:
   a. Check if admin_edited = true → SKIP
   b. Fetch TMDB details
   c. Update entries table with metadata
   d. For series: fetch all seasons/episodes
   e. Save episodes to entry_metadata table
4. Show final stats: Updated X / Skipped Y / Failed Z
```

---

### Technical Notes

1. **Rate Limiting**: TMDB allows ~40 requests/10 seconds. Implementation uses:
   - Batch processing (5 entries at a time)
   - 1 second delay between batches
   - Retry logic with exponential backoff for 429 errors

2. **Image URLs**: All stored as full URLs (e.g., `https://image.tmdb.org/t/p/w342/abc.jpg`)

3. **Admin Edit Flag Logic**:
   - Setting `admin_edited = true` on entry → skips during bulk prefill
   - Setting `admin_edited = true` on specific episode → that episode skipped
   - Admin can manually uncheck to allow auto-update again

4. **Episode Metadata Priority**:
   - TV Details page checks `entry_metadata` first
   - Falls back to live TMDB fetch if no stored data
   - Ensures DB-stored descriptions/thumbnails are used

5. **Backward Compatibility**:
   - Existing entries without `admin_edited` treated as `false`
   - Missing episodes in `entry_metadata` trigger TMDB fetch

---

### Estimated File Changes

| File | Lines | Action |
|------|-------|--------|
| `src/hooks/useEntryMetadata.ts` | ~120 | Create new |
| `src/components/admin/MetadataPrefillTool.tsx` | ~280 | Create new |
| `src/components/admin/EpisodeMetadataEditor.tsx` | ~200 | Create new |
| `src/components/admin/UpdateLinksPanel.tsx` | +150 | Modify (add metadata section) |
| `src/hooks/useEntries.ts` | +30 | Modify (add new fields) |
| `src/pages/TVDetails.tsx` | +40 | Modify (check DB first) |
| `src/components/admin/MetadataBackfillTool.tsx` | - | Delete |
| `src/components/admin/ArtworkBackfillTool.tsx` | - | Delete |
