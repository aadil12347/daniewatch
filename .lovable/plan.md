

## Complete Post Data Saving System - Implementation Plan

Now that the database schema has been updated, I'll implement the code changes to save ALL metadata when admin saves links, including complete episode data for ALL seasons.

---

### Summary of Changes

| Change | Description |
|--------|-------------|
| Update `useEntries.ts` | Add new fields (tagline, status, genres, cast_data, number_of_episodes) to interface and save functions |
| Enhance `UpdateLinksPanel.tsx` handleSave | Fetch credits, save ALL seasons' episodes, add progress indicator |
| Update `MetadataPrefillTool.tsx` | Add cast_data and genres to prefill operations |
| Improve data completeness | Ensure every save captures everything shown on detail pages |

---

### Files to Modify

#### 1. `src/hooks/useEntries.ts`

**Expand EntryData interface with all new fields:**

```typescript
interface EntryData {
  // Existing fields...
  
  // New complete metadata fields
  overview?: string | null;
  tagline?: string | null;
  runtime?: number | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;  // NEW
  status?: string | null;               // NEW
  genres?: { id: number; name: string }[] | null;  // NEW
  cast_data?: { id: number; name: string; character: string; profile_path: string | null }[] | null;  // NEW
  admin_edited?: boolean;
}
```

**Extend EntryMediaFields to include all metadata:**

```typescript
type EntryMediaFields = {
  poster_url?: string | null;
  backdrop_url?: string | null;
  logo_url?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  media_updated_at?: string | null;
  // New fields
  overview?: string | null;
  tagline?: string | null;
  runtime?: number | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  status?: string | null;
  genres?: { id: number; name: string }[] | null;
  cast_data?: { id: number; name: string; character: string; profile_path: string | null }[] | null;
};
```

---

#### 2. `src/components/admin/UpdateLinksPanel.tsx`

**Major enhancement to `handleSave`:**

For **Movies**:
1. Fetch `getMovieDetails()`, `getMovieImages()`, AND `getMovieCredits()`
2. Extract top 12 cast members
3. Save ALL fields: overview, tagline, runtime, status, genres, cast_data, images

For **Series**:
1. Fetch `getTVDetails()`, `getTVImages()`, AND `getTVCredits()`
2. Save ALL metadata fields
3. **Fetch ALL seasons' episodes** (not just selected season)
4. Show progress indicator: "Saving Season X of Y..."
5. Respect episode-level admin_edited flags

**New imports needed:**
```typescript
import { getMovieCredits, getTVCredits } from "@/lib/tmdb";
```

**Enhanced save flow for series:**
```typescript
// After saving main entry...
if (!adminEdited) {
  const validSeasons = tmdbResult.seasonDetails?.filter(s => s.season_number > 0) || [];
  
  for (let i = 0; i < validSeasons.length; i++) {
    const season = validSeasons[i];
    setSeasonSaveProgress(`Saving Season ${season.season_number} of ${validSeasons.length}...`);
    
    const seasonDetails = await getTVSeasonDetails(tmdbResult.id, season.season_number);
    
    // Check existing admin-edited episodes
    const { data: existingEps } = await supabase
      .from("entry_metadata")
      .select("episode_number, admin_edited")
      .eq("entry_id", String(tmdbResult.id))
      .eq("season_number", season.season_number);
    
    const adminEditedSet = new Set(
      (existingEps || []).filter(e => e.admin_edited).map(e => e.episode_number)
    );
    
    // Only update non-admin-edited episodes
    const episodesToSave = seasonDetails.episodes
      .filter(ep => !adminEditedSet.has(ep.episode_number))
      .map(ep => ({...}));
    
    if (episodesToSave.length > 0) {
      await saveEpisodeMetadata(String(tmdbResult.id), season.season_number, episodesToSave);
    }
    
    await delay(300); // Rate limit
  }
}
```

**New state for progress:**
```typescript
const [seasonSaveProgress, setSeasonSaveProgress] = useState<string | null>(null);
```

---

#### 3. `src/components/admin/MetadataPrefillTool.tsx`

**Enhance both prefillMovieEntry and prefillSeriesEntry to include cast data:**

For **Movies**:
```typescript
const prefillMovieEntry = async (entryId: string) => {
  const [details, images, credits] = await Promise.all([
    fetchWithRetry(() => getMovieDetails(Number(entryId))),
    fetchWithRetry(() => getMovieImages(Number(entryId))),
    fetchWithRetry(() => getMovieCredits(Number(entryId))),
  ]);

  const topCast = credits?.cast?.slice(0, 12).map(c => ({
    id: c.id,
    name: c.name,
    character: c.character,
    profile_path: c.profile_path,
  })) || null;

  const { error } = await supabase.from("entries").update({
    // Existing fields...
    genres: details.genres,
    status: details.status,
    cast_data: topCast,
  }).eq("id", entryId);
};
```

For **Series**:
```typescript
const prefillSeriesEntry = async (entryId: string) => {
  const [details, images, credits] = await Promise.all([
    fetchWithRetry(() => getTVDetails(Number(entryId))),
    fetchWithRetry(() => getTVImages(Number(entryId))),
    fetchWithRetry(() => getTVCredits(Number(entryId))),
  ]);

  const topCast = credits?.cast?.slice(0, 12).map(c => ({
    id: c.id,
    name: c.name,
    character: c.character,
    profile_path: c.profile_path,
  })) || null;

  const { error } = await supabase.from("entries").update({
    // Existing fields...
    number_of_episodes: details.number_of_episodes || null,
    status: details.status || null,
    genres: details.genres,
    cast_data: topCast,
  }).eq("id", entryId);
};
```

**Add new imports:**
```typescript
import { getMovieCredits, getTVCredits } from "@/lib/tmdb";
```

---

### Data Saved Per Entry Type

| Field | Movie | Series | Episode |
|-------|-------|--------|---------|
| title | Yes | Yes | - |
| poster_url | Yes | Yes | - |
| backdrop_url | Yes | Yes | - |
| logo_url | Yes | Yes | - |
| vote_average | Yes | Yes | Yes |
| vote_count | Yes | Yes | - |
| overview | Yes | Yes | Yes |
| tagline | Yes | Yes | - |
| runtime | Yes | - | Yes |
| genres | Yes | Yes | - |
| status | Yes | Yes | - |
| cast_data (top 12) | Yes | Yes | - |
| release_year | Yes | Yes | - |
| number_of_seasons | - | Yes | - |
| number_of_episodes | - | Yes | - |
| name | - | - | Yes |
| still_path | - | - | Yes |
| air_date | - | - | Yes |
| admin_edited | Yes | Yes | Yes |

---

### Save Flow for Series (Enhanced)

```text
Admin clicks SAVE for Series
       |
       v
+------------------------------------------+
| 1. Fetch TMDB data:                      |
|    - getTVDetails()                      |
|    - getTVImages()                       |
|    - getTVCredits() (top 12 cast)        |
+------------------------------------------+
       |
       v
+------------------------------------------+
| 2. Save to entries table:                |
|    - All metadata fields                 |
|    - Watch/download links (season)       |
|    - poster_url, backdrop_url, logo_url  |
|    - genres, cast_data (JSONB)           |
|    - status, number_of_episodes          |
+------------------------------------------+
       |
       v (if not admin_edited)
+------------------------------------------+
| 3. For EACH season:                      |
|    - Show "Saving Season X of Y..."      |
|    - Fetch getTVSeasonDetails()          |
|    - Check existing admin_edited eps     |
|    - Upsert non-edited episodes to       |
|      entry_metadata table                |
|    - 300ms delay between seasons         |
+------------------------------------------+
       |
       v
+------------------------------------------+
| 4. Show success toast:                   |
|    "Saved 5 seasons, 62 episodes"        |
+------------------------------------------+
```

---

### Estimated Code Changes

| File | Lines Modified/Added |
|------|---------------------|
| `src/hooks/useEntries.ts` | ~30 lines (interface expansion) |
| `src/components/admin/UpdateLinksPanel.tsx` | ~80 lines (enhanced save + progress) |
| `src/components/admin/MetadataPrefillTool.tsx` | ~40 lines (add credits fetch) |

---

### Rate Limiting

For series with many seasons (e.g., 15 seasons):
- 300ms delay between season fetches
- Progress indicator: "Saving Season 3 of 15..."
- Total time for 15 seasons: ~5 seconds
- Existing retry logic handles TMDB 429 errors

