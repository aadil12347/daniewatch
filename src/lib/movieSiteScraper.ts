import type { Movie } from "./tmdb";
import { markExternalAllowed } from "./contentVisibility";

const TMDB_API_KEY = "fc6d85b3839330e3458701b975195487";

export interface MovieSiteCard {
  site: "vegamovies" | "rogmovies";
  postUrl: string;
  poster: string;
  title: string;
  rating: number;
}

export interface ResolvedPostInfo {
  postUrl: string;
  imdbId: string | null;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  overview?: string;
  backdropUrl?: string | null;
}

// In-memory cache for resolved posts
const resolvedCache = new Map<string, ResolvedPostInfo>();

/**
 * Normalizes a URL for fetching, using Vite dev proxy when available.
 */
function getFetchUrl(targetUrl: string): string {
  if (typeof window !== "undefined") {
    if (targetUrl.startsWith("https://vegamovies.gallery")) {
      return targetUrl.replace("https://vegamovies.gallery", "/api/vegamovies");
    }
    if (targetUrl.startsWith("https://rogmovies.best")) {
      return targetUrl.replace("https://rogmovies.best", "/api/rogmovies");
    }
  }
  return targetUrl;
}

/**
 * Fetch HTML with proxy fallback.
 */
async function fetchHtml(url: string): Promise<string> {
  const primaryUrl = getFetchUrl(url);
  try {
    const res = await fetch(primaryUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (res.ok) {
      return await res.text();
    }
  } catch (err) {
    console.warn(`[MovieScraper] Primary fetch failed for ${primaryUrl}:`, err);
  }

  // Fallback direct or CORS proxy
  try {
    const res = await fetch(url);
    if (res.ok) {
      return await res.text();
    }
  } catch (e) {
    console.warn(`[MovieScraper] Direct fetch failed for ${url}:`, e);
  }

  throw new Error(`Unable to fetch HTML for ${url}`);
}

/**
 * Clean title strings and decode entities.
 */
function cleanPostTitle(title: string): string {
  return title
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "-")
    .replace(/&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract poster cards from VegaMovies HTML.
 */
export function parseVegaCards(html: string): MovieSiteCard[] {
  const cards: MovieSiteCard[] = [];
  const seenUrls = new Set<string>();

  // Match poster-card blocks
  const cardRegex = /<div class="poster-card"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null) {
    const block = match[1];
    const urlM = block.match(/<meta itemprop="url" content="([^"]+)"/i) || block.match(/<a\s+[^>]*href="([^"]+)"/i);
    const imgM = block.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i);
    const altM = block.match(/alt="([^"]+)"/i);
    const titleM = block.match(/class="poster-title"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const rateM = block.match(/<meta itemprop="ratingValue" content="([^"]+)"/i);

    if (urlM && (imgM || altM || titleM)) {
      const postUrl = urlM[1];
      if (seenUrls.has(postUrl)) continue;
      seenUrls.add(postUrl);

      const rawTitle = altM ? altM[1] : (titleM ? titleM[1] : "");
      const title = cleanPostTitle(rawTitle);
      const poster = imgM ? imgM[1] : "";
      const rating = rateM ? parseFloat(rateM[1]) : 7.2;

      if (title.length > 2 && postUrl) {
        cards.push({
          site: "vegamovies",
          postUrl,
          poster,
          title,
          rating,
        });
      }
    }
  }

  return cards;
}

/**
 * Extract poster cards from RogMovies HTML.
 */
export function parseRogCards(html: string): MovieSiteCard[] {
  const cards: MovieSiteCard[] = [];
  const seenUrls = new Set<string>();

  const cardRegex = /<div class="poster-card"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null) {
    const block = match[1];
    const urlM = block.match(/<meta itemprop="url" content="([^"]+)"/i) || block.match(/<a\s+[^>]*href="([^"]+)"/i);
    const imgM = block.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i);
    const altM = block.match(/alt="([^"]+)"/i);
    const titleM = block.match(/class="poster-title"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const rateM = block.match(/<meta itemprop="ratingValue" content="([^"]+)"/i);

    if (urlM && (imgM || altM || titleM)) {
      const postUrl = urlM[1];
      if (seenUrls.has(postUrl)) continue;
      seenUrls.add(postUrl);

      const rawTitle = altM ? altM[1] : (titleM ? titleM[1] : "");
      const title = cleanPostTitle(rawTitle);
      const poster = imgM ? imgM[1] : "";
      const rating = rateM ? parseFloat(rateM[1]) : 7.4;

      if (title.length > 2 && postUrl) {
        cards.push({
          site: "rogmovies",
          postUrl,
          poster,
          title,
          rating,
        });
      }
    }
  }

  return cards;
}

/**
 * Fetch top cards from VegaMovies.
 */
export async function fetchVegaMoviesCards(count = 8): Promise<MovieSiteCard[]> {
  try {
    const html = await fetchHtml("https://vegamovies.gallery/");
    const cards = parseVegaCards(html);
    return cards.slice(0, count);
  } catch (e) {
    console.error("[MovieScraper] Failed to fetch VegaMovies cards:", e);
    return [];
  }
}

/**
 * Fetch top cards from RogMovies.
 */
export async function fetchRogMoviesCards(count = 7): Promise<MovieSiteCard[]> {
  try {
    const html = await fetchHtml("https://rogmovies.best/");
    const cards = parseRogCards(html);
    return cards.slice(0, count);
  } catch (e) {
    console.error("[MovieScraper] Failed to fetch RogMovies cards:", e);
    return [];
  }
}

/**
 * Convert a MovieSiteCard to a Movie object for DanieWatch UI.
 */
export function cardToMovie(card: MovieSiteCard, index: number): Movie {
  const isSeries =
    /\b(season|series|episode|s\d+|s\d+e\d+|show)\b/i.test(card.title) ||
    card.title.includes("TV-Show");
  const mediaType: "movie" | "tv" = isSeries ? "tv" : "movie";

  // Check if already resolved in cache
  const cached = resolvedCache.get(card.postUrl);

  const movieId = cached?.tmdbId ?? -(20000 + index);

  return {
    id: movieId,
    title: card.title,
    overview: `Available on ${card.site === "vegamovies" ? "VegaMovies" : "RogMovies"}. Tap to stream or download.`,
    poster_path: card.poster,
    backdrop_path: cached?.backdropUrl || card.poster,
    vote_average: card.rating,
    genre_ids: [28, 12, 18],
    media_type: cached?.mediaType ?? mediaType,
    origin_site: card.site,
    post_url: card.postUrl,
    imdb_id: cached?.imdbId ?? undefined,
    is_resolved: !!cached,
    resolved_tmdb_id: cached?.tmdbId,
    resolved_media_type: cached?.mediaType,
  };
}

export interface CuratedHomePosts {
  top5: Movie[];
  top10: Movie[];
}

/**
 * Loads the Top 5 (3 Vega + 2 Rog) and Top 10 (5 Vega + 5 Rog interleaved side by side).
 */
export async function getCuratedMovieSitePosts(): Promise<CuratedHomePosts> {
  const [vegaCards, rogCards] = await Promise.all([
    fetchVegaMoviesCards(8),
    fetchRogMoviesCards(7),
  ]);

  // Top 5: Vega top 3 + Rog top 2
  const top5Cards: MovieSiteCard[] = [
    ...vegaCards.slice(0, 3),
    ...rogCards.slice(0, 2),
  ];

  // Top 10: next 5 Vega (3 to 7) and next 5 Rog (2 to 6) interleaved 1-by-1
  const vegaNext5 = vegaCards.slice(3, 8);
  const rogNext5 = rogCards.slice(2, 7);
  const top10Cards: MovieSiteCard[] = [];

  for (let i = 0; i < 5; i++) {
    if (vegaNext5[i]) top10Cards.push(vegaNext5[i]);
    if (rogNext5[i]) top10Cards.push(rogNext5[i]);
  }

  const top5Movies = top5Cards.map((card, i) => cardToMovie(card, i));
  const top10Movies = top10Cards.map((card, i) => cardToMovie(card, 10 + i));

  return {
    top5: top5Movies,
    top10: top10Movies,
  };
}

/**
 * Resolves a post's detail page:
 * 1. Fetches post HTML
 * 2. Extracts IMDb code (tt...)
 * 3. Extracts TMDB code via TMDB Find API
 * 4. Fetches TMDB data of that movie or season
 * 5. Returns ResolvedPostInfo
 */
export async function resolveMovieSitePost(
  postUrl: string,
  fallbackTitle?: string
): Promise<ResolvedPostInfo> {
  // Check memory cache
  if (resolvedCache.has(postUrl)) {
    const cached = resolvedCache.get(postUrl)!;
    markExternalAllowed(cached.tmdbId);
    return cached;
  }

  // Check sessionStorage
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem(`resolved_post_${postUrl}`);
      if (stored) {
        const parsed = JSON.parse(stored) as ResolvedPostInfo;
        resolvedCache.set(postUrl, parsed);
        markExternalAllowed(parsed.tmdbId);
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  try {
    const html = await fetchHtml(postUrl);

    // 1. Look for IMDb ID
    const imdbMatch =
      html.match(/imdb\.com\/title\/(tt\d+)/i) ||
      html.match(/href=["'][^"']*imdb\.com\/title\/(tt\d+)/i) ||
      html.match(/\b(tt\d{7,8})\b/i);
    const imdbId = imdbMatch ? imdbMatch[1] : null;

    let tmdbId: number | null = null;
    let mediaType: "movie" | "tv" = "movie";
    let title = fallbackTitle || "Unknown Title";
    let overview = "";
    let backdropUrl: string | null = null;

    // 2. Query TMDB Find API with IMDb ID
    if (imdbId) {
      try {
        const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const res = await fetch(findUrl);
        if (res.ok) {
          const data = await res.json();
          const movie = data.movie_results?.[0];
          const tv = data.tv_results?.[0];

          if (movie) {
            tmdbId = movie.id;
            mediaType = "movie";
            title = movie.title;
            overview = movie.overview;
            backdropUrl = movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null;
          } else if (tv) {
            tmdbId = tv.id;
            mediaType = "tv";
            title = tv.name;
            overview = tv.overview;
            backdropUrl = tv.backdrop_path ? `https://image.tmdb.org/t/p/original${tv.backdrop_path}` : null;
          }
        }
      } catch (err) {
        console.warn(`[MovieScraper] TMDB find error for ${imdbId}:`, err);
      }
    }

    // 3. Fallback: Search TMDB by cleaned title if IMDb ID didn't resolve
    if (!tmdbId && fallbackTitle) {
      try {
        // Strip common release tags from title
        const cleanQuery = fallbackTitle
          .replace(/download/i, "")
          .replace(/\b(480p|720p|1080p|2160p|4k|web-dl|bluray|predvd|hdtc|dual audio|multi audio|hindi|english)\b.*/gi, "")
          .replace(/[([{].*?[})\]]/g, "")
          .trim();

        if (cleanQuery.length > 2) {
          const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanQuery)}&include_adult=false`;
          const sRes = await fetch(searchUrl);
          if (sRes.ok) {
            const sData = await sRes.json();
            const first = sData.results?.[0];
            if (first && (first.media_type === "movie" || first.media_type === "tv")) {
              tmdbId = first.id;
              mediaType = first.media_type;
              title = first.title || first.name;
              overview = first.overview;
              backdropUrl = first.backdrop_path ? `https://image.tmdb.org/t/p/original${first.backdrop_path}` : null;
            }
          }
        }
      } catch (e) {
        console.warn(`[MovieScraper] TMDB search fallback failed for ${fallbackTitle}:`, e);
      }
    }

    // Fallback ID if nothing found
    if (!tmdbId) {
      tmdbId = Math.abs(hashCode(postUrl));
    }

    const resolved: ResolvedPostInfo = {
      postUrl,
      imdbId,
      tmdbId,
      mediaType,
      title,
      overview,
      backdropUrl,
    };

    // Store in cache
    resolvedCache.set(postUrl, resolved);
    markExternalAllowed(tmdbId);

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(`resolved_post_${postUrl}`, JSON.stringify(resolved));
      } catch {
        // ignore
      }
    }

    return resolved;
  } catch (err) {
    console.error(`[MovieScraper] Failed to resolve post ${postUrl}:`, err);
    throw err;
  }
}

/**
 * Pre-resolve posts in background batches.
 */
export async function preResolvePosts(
  movies: Movie[],
  onItemResolved?: (resolvedMovie: Movie) => void
): Promise<void> {
  const unresolved = movies.filter((m) => m.post_url && !m.is_resolved);
  if (unresolved.length === 0) return;

  const BATCH_SIZE = 3;
  for (let i = 0; i < unresolved.length; i += BATCH_SIZE) {
    const batch = unresolved.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (movie) => {
        try {
          const resolved = await resolveMovieSitePost(movie.post_url!, movie.title);
          const updatedMovie: Movie = {
            ...movie,
            id: resolved.tmdbId,
            media_type: resolved.mediaType,
            backdrop_path: resolved.backdropUrl || movie.backdrop_path,
            is_resolved: true,
            resolved_tmdb_id: resolved.tmdbId,
            resolved_media_type: resolved.mediaType,
            imdb_id: resolved.imdbId || undefined,
          };
          if (onItemResolved) {
            onItemResolved(updatedMovie);
          }
        } catch {
          // ignore
        }
      })
    );
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
