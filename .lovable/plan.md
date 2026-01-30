

## Homepage Sections - Simple, Attractive & Tempting

### Final Section Layout

| Order | Section Name | Source | Appeal Factor |
|-------|-------------|--------|---------------|
| 1 | Hero Carousel | TMDB | Visual hook |
| 2 | **Top 10 Today** | TMDB | Ranking creates curiosity |
| 3 | **Trending Now** | TMDB | FOMO - what's hot |
| 4 | **Indian Hits** | TMDB | Regional pride |
| 5 | **Korean Wave** | TMDB | Cultural phenomenon |
| 6 | **Anime Picks** | TMDB | Curated feel |
| 7 | **Just Added** | DB | Fresh & new |
| 8 | **Fan Favorites** | DB | Social proof |
| 9 | **Action** | DB | Direct genre |
| 10 | **Comedy** | DB | Direct genre |
| 11 | **Thriller** | DB | Direct genre |
| 12 | **Sci-Fi** | DB | Direct genre |
| 13 | **Drama** | DB | Direct genre |
| 14 | **Series to Binge** | DB | Suggests commitment |
| 15 | **Movie Night** | DB | Cozy, inviting |
| 16 | **Top Rated** | TMDB | Quality closer |

---

## Title Comparison

| Category | Too Complex | Too Plain | Just Right |
|----------|-------------|-----------|------------|
| New content | "Fresh Off The Screen" | "New" | **"Just Added"** |
| High rated | "Critically Acclaimed" | "Best" | **"Fan Favorites"** |
| Indian | "Bollywood & Beyond" | "Indian" | **"Indian Hits"** |
| Korean | "K-Drama & Asian Hits" | "Korean" | **"Korean Wave"** |
| Anime | "Anime Universe" | "Anime" | **"Anime Picks"** |
| TV Shows | "Binge-Worthy Series" | "Series" | **"Series to Binge"** |
| Movies | "Movie Marathon" | "Movies" | **"Movie Night"** |

---

## Implementation

### 1. Section Generator Hook
**New file:** `src/hooks/useDbSections.ts`

```text
const SECTION_CONFIGS = [
  { id: "new", title: "Just Added", filter: year >= 2024, limit: 20 },
  { id: "favorites", title: "Fan Favorites", filter: rating >= 8.0, limit: 20 },
  { id: "action", title: "Action", filter: genres [28, 10759], limit: 15 },
  { id: "comedy", title: "Comedy", filter: genre 35, limit: 15 },
  { id: "thriller", title: "Thriller", filter: genres [53, 80, 9648], limit: 15 },
  { id: "scifi", title: "Sci-Fi", filter: genres [878, 14, 10765], limit: 15 },
  { id: "drama", title: "Drama", filter: genre 18, limit: 15 },
  { id: "series", title: "Series to Binge", filter: media_type === "tv", limit: 15 },
  { id: "movies", title: "Movie Night", filter: media_type === "movie", limit: 15 },
];
```

### 2. Lazy DB Row Component
**New file:** `src/components/DbContentRow.tsx`

Uses IntersectionObserver to render only when near viewport.

### 3. Update Index.tsx

```text
{/* Regional - Simple but appealing */}
<TabbedContentRow title="Indian Hits" ... />
<TabbedContentRow title="Korean Wave" ... />
<TabbedContentRow title="Anime Picks" ... />

{/* Database sections - Lazy loaded */}
{dbSections.map(section => (
  <DbContentRow key={section.id} title={section.title} items={section.items} />
))}
```

### 4. Update Homepage Cache

Add `indianPopular`, remove `popularMovies`/`popularTV`.

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/hooks/useDbSections.ts` | NEW - Section generator |
| `src/components/DbContentRow.tsx` | NEW - Lazy row component |
| `src/pages/Index.tsx` | New layout with attractive titles |
| `src/hooks/useHomepageCache.ts` | Update cache structure |

---

## Why These Names Work

- **"Just Added"** - Creates urgency, implies fresh content
- **"Fan Favorites"** - Social proof, trusted picks
- **"Indian Hits"** - Pride + quality signal
- **"Korean Wave"** - Trendy, cultural movement
- **"Anime Picks"** - Curated, not random
- **"Series to Binge"** - Action-oriented, suggests commitment
- **"Movie Night"** - Cozy, inviting, emotional

All titles are 1-3 words, easy to scan, and create emotional pull.

