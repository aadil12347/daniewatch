
## Complete Post Data Saving System

This plan ensures that when admin saves links, ALL data displayed on the detail page is captured and stored in the database - including complete episode metadata for ALL seasons.

---

### Summary of Changes

| Feature | Implementation |
|---------|----------------|
| Save complete movie metadata | Add tagline, runtime, overview to entries table |
| Save complete series metadata | Add tagline, number_of_episodes, overview |
| Save ALL seasons' episode data | Auto-fetch and save ALL seasons on series save |
| Use DB data on detail pages | Prioritize stored data over TMDB fetches |
| Cast storage (optional) | Store top cast in JSONB column for offline display |

---

### Database Schema Changes Required

Before implementation, add these columns to the `entries` table:

```sql
-- Add missing columns to entries table
ALTER TABLE entries ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS number_of_episodes INTEGER;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS genres JSONB; -- [{id: 1, name: "Action"}]
ALTER TABLE entries ADD COLUMN IF NOT EXISTS cast_data JSONB; -- Top 12 cast members
```

---

### Files to Modify

#### 1. `src/hooks/useEntries.ts`

**Expand EntryData interface:**

```typescript
interface EntryData {
  // Existing fields...
  
  // Complete metadata (what's shown on detail page)
  overview?: string | null;
  tagline?: string | null;
  runtime?: number | null;           // For movies
  number_of_seasons?: number | null; // For series
  number_of_episodes?: number | null; // For series
  status?: string | null;            // Released, Ended, Returning
  genres?: { id: number; name: string }[] | null;
  cast_data?: { id: number; name: string; character: string; profile_path: string | null }[] | null;
  admin_edited?: boolean;
}
```

**Update save functions to include all metadata fields.**

---

#### 2. `src/components/admin/UpdateLinksPanel.tsx`

**Major enhancement to `handleSave`:**

When saving a movie:
1. Fetch `getMovieDetails()` and `getMovieCredits()` 
2. Save all fields: overview, tagline, runtime, status, genres, cast (top 12)
3. Store poster, backdrop, logo URLs

When saving a series:
1. Fetch `getTVDetails()`, `getTVCredits()`, and `getTVImages()`
2. Save all fields: overview, tagline, status, genres, number_of_seasons, number_of_episodes, cast
3. **Fetch ALL seasons' episodes** in sequence with rate-limiting
4. Save each season's episode data to `entry_metadata` table

**New save flow for series:**

```typescript
// After saving main entry data...
if (tmdbResult.type === "series" && !adminEdited) {
  // Fetch and save ALL seasons
  const validSeasons = details.seasons?.filter(s => s.season_number > 0) || [];
  
  for (const season of validSeasons) {
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
      .map(ep => ({
        episode_number: ep.episode_number,
        name: ep.name || null,
        overview: ep.overview || null,
        still_path: ep.still_path ? getImageUrl(ep.still_path, "w300") : null,
        air_date: ep.air_date || null,
        runtime: ep.runtime || null,
        vote_average: ep.vote_average ?? null,
        admin_edited: false,
      }));
    
    if (episodesToSave.length > 0) {
      await saveEpisodeMetadata(String(tmdbResult.id), season.season_number, episodesToSave);
    }
    
    // Rate limit: 300ms between season fetches
    await new Promise(r => setTimeout(r, 300));
  }
}
```

**Add progress indicator** when saving series with many seasons.

---

#### 3. `src/pages/MovieDetails.tsx`

**Add database-first data loading:**

```typescript
// In fetchData:
// 1. First check if entry exists in database with complete data
const { data: dbEntry } = await supabase
  .from("entries")
  .select("*")
  .eq("id", id)
  .maybeSingle();

if (dbEntry && dbEntry.overview && dbEntry.poster_url) {
  // Use database data (faster, works offline)
  setMovie({
    id: Number(dbEntry.id),
    title: dbEntry.title,
    overview: dbEntry.overview,
    poster_path: dbEntry.poster_url,
    backdrop_path: dbEntry.backdrop_url,
    vote_average: dbEntry.vote_average,
    runtime: dbEntry.runtime,
    tagline: dbEntry.tagline,
    genres: dbEntry.genres || [],
    // ... map other fields
  });
  setCast(dbEntry.cast_data || []);
} else {
  // Fall back to TMDB API
  const [movieRes, creditsRes] = await Promise.all([...]);
}
```

---

#### 4. `src/pages/TVDetails.tsx`

**Already partially implemented** - enhance to use all stored fields:

- Check `entries` table for series metadata (already done partially)
- Check `entry_metadata` for ALL seasons' episodes (already done)
- Fall back to TMDB only when data is missing

---

#### 5. `src/components/admin/MetadataPrefillTool.tsx`

**Enhance `prefillSeriesEntry` to save cast data:**

```typescript
// After fetching details, also fetch credits
const credits = await getTVCredits(Number(entryId));
const topCast = credits.cast.slice(0, 12).map(c => ({
  id: c.id,
  name: c.name,
  character: c.character,
  profile_path: c.profile_path,
}));

// Include in update
await supabase.from("entries").update({
  // ... existing fields
  cast_data: topCast,
  genres: details.genres,
  tagline: details.tagline,
  status: details.status,
});
```

---

### Complete Data Mapping

| Detail Page Field | DB Column | Source |
|-------------------|-----------|--------|
| Title | `title` | entries |
| Poster | `poster_url` | entries |
| Backdrop | `backdrop_url` | entries |
| Logo | `logo_url` | entries |
| Rating | `vote_average` | entries |
| Vote Count | `vote_count` | entries |
| Overview | `overview` | entries |
| Tagline | `tagline` | entries |
| Runtime | `runtime` | entries |
| Genres | `genres` (JSONB) | entries |
| Release Year | `release_year` | entries |
| Status | `status` | entries |
| Cast | `cast_data` (JSONB) | entries |
| Number of Seasons | `number_of_seasons` | entries |
| Number of Episodes | `number_of_episodes` | entries |
| Episode Names | `name` | entry_metadata |
| Episode Overview | `overview` | entry_metadata |
| Episode Thumbnail | `still_path` | entry_metadata |
| Episode Air Date | `air_date` | entry_metadata |
| Episode Runtime | `runtime` | entry_metadata |
| Episode Rating | `vote_average` | entry_metadata |

---

### Save Flow Diagram

```text
Admin clicks SAVE
       │
       ▼
┌──────────────────────────────────────────┐
│ Fetch TMDB data:                         │
│ - Details (overview, tagline, runtime)   │
│ - Images (poster, backdrop, logo)        │
│ - Credits (top 12 cast)                  │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Save to entries table:                   │
│ - All metadata fields                    │
│ - Watch/download links                   │
│ - poster_url, backdrop_url, logo_url     │
│ - genres, cast_data (JSONB)              │
└──────────────────────────────────────────┘
       │
       ▼ (if Series)
┌──────────────────────────────────────────┐
│ For EACH season (with rate limiting):    │
│ 1. Fetch season details from TMDB        │
│ 2. Check existing admin_edited episodes  │
│ 3. Save non-edited episodes to           │
│    entry_metadata table                  │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Show success toast with summary:         │
│ "Saved 5 seasons, 62 episodes"           │
└──────────────────────────────────────────┘
```

---

### Implementation Order

1. **Database Schema**: Add new columns (tagline, number_of_episodes, status, genres, cast_data)
2. **useEntries.ts**: Update interfaces and save functions
3. **UpdateLinksPanel.tsx**: Enhance handleSave to fetch ALL data and ALL seasons
4. **MetadataPrefillTool.tsx**: Update prefill to include all fields
5. **MovieDetails.tsx**: Add DB-first loading (optional enhancement)
6. **TVDetails.tsx**: Ensure all stored data is used (mostly done)

---

### Rate Limiting Strategy

For series with many seasons (e.g., 15 seasons):
- 300ms delay between season fetches
- Show progress: "Saving Season 3 of 15..."
- Allow abort if needed
- Total time for 15 seasons: ~4.5 seconds

---

### Files Summary

| File | Action | Changes |
|------|--------|---------|
| `src/hooks/useEntries.ts` | Modify | Add new fields to interface and save functions |
| `src/components/admin/UpdateLinksPanel.tsx` | Modify | Enhance handleSave to fetch ALL seasons' episodes |
| `src/components/admin/MetadataPrefillTool.tsx` | Modify | Add cast_data and genres to prefill |
| `src/pages/MovieDetails.tsx` | Modify | Add DB-first loading (optional) |
| `src/pages/TVDetails.tsx` | Minor | Already uses DB data |

---

### Estimated Changes

| File | Lines Modified |
|------|----------------|
| `useEntries.ts` | ~40 lines |
| `UpdateLinksPanel.tsx` | ~80 lines |
| `MetadataPrefillTool.tsx` | ~30 lines |
| `MovieDetails.tsx` | ~50 lines (optional) |
