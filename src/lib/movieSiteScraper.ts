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
  logoUrl?: string | null;
  trailerKey?: string | null;
}

export interface ScrapedEpisode {
  episodeNumber: number;
  title: string;
  overview?: string;
  thumbnailUrl?: string; // from TMDB still_path
  vcloudUrl?: string;    // preferred VCloud link (vcloud.fit, etc.)
  fallbackUrl?: string;  // alternative non-zip direct link
  resolution?: string;   // e.g. "1080p", "720p", "480p"
}

export interface ScrapedMovieQuality {
  resolution: string; // "2160p", "1080p", "720p", "480p"
  label: string;
  vcloudUrl?: string;
  fallbackUrl?: string;
}

export interface ScrapedPostDetail {
  postUrl: string;
  originSite: "vegamovies" | "rogmovies";
  imdbId: string | null;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string | null;
  logoUrl: string | null;
  trailerKey: string | null;
  voteAverage: number;
  releaseYear: string;
  runtime?: string;
  genres: string[];
  cast: Array<{ name: string; character: string; profileUrl: string | null }>;
  episodes: ScrapedEpisode[];
  movieQualities: ScrapedMovieQuality[];
}

// In-memory cache for resolved posts
const resolvedCache = new Map<string, ResolvedPostInfo>();
const fullDetailsCache = new Map<string, ScrapedPostDetail>();

/**
 * Filter out batch/zip links
 */
export function isBatchOrZip(str: string): boolean {
  return /\b(batch|zip|pack|rar|full\s*season|all\s*episodes|complete\s*zip)\b/i.test(str);
}

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
    // Generic proxy for external landing/host domains (nexdrive, vcloud, fastdl, etc.)
    return `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  }
  return targetUrl;
}

/**
 * Fetch HTML with proxy fallback.
 */
export async function fetchHtml(url: string, referer?: string): Promise<string> {
  const primaryUrl = getFetchUrl(url);
  try {
    const res = await fetch(primaryUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(referer ? { Referer: referer } : {}),
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

  // Public CORS proxy fallback
  try {
    const corsProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(corsProxyUrl);
    if (res.ok) {
      return await res.text();
    }
  } catch (e) {
    // ignore
  }

  throw new Error(`Unable to fetch HTML for ${url}`);
}

/**
 * Clean title strings and decode entities.
 */
export function cleanPostTitle(title: string): string {
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
export async function fetchVegaMoviesCards(count = 16): Promise<MovieSiteCard[]> {
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
export async function fetchRogMoviesCards(count = 16): Promise<MovieSiteCard[]> {
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
  vegaPosts: Movie[];
  rogPosts: Movie[];
  seriesPosts: Movie[];
  moviePosts: Movie[];
}

/**
 * Loads the curated posts strictly from VegaMovies and RogMovies:
 * - Top 5 Hero: 3 Vega + 2 Rog
 * - Top 10 Today: 5 Vega + 5 Rog interleaved side by side
 * - VegaMovies list & RogMovies list
 * - Series list & Movies list
 */
export async function getCuratedMovieSitePosts(): Promise<CuratedHomePosts> {
  const [vegaCards, rogCards] = await Promise.all([
    fetchVegaMoviesCards(16),
    fetchRogMoviesCards(16),
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

  const vegaMovies = vegaCards.map((c, i) => cardToMovie(c, 100 + i));
  const rogMovies = rogCards.map((c, i) => cardToMovie(c, 200 + i));

  const allPosts = [...vegaMovies, ...rogMovies];
  const seriesPosts = allPosts.filter((m) => m.media_type === "tv");
  const moviePosts = allPosts.filter((m) => m.media_type === "movie");

  return {
    top5: top5Movies,
    top10: top10Movies,
    vegaPosts: vegaMovies,
    rogPosts: rogMovies,
    seriesPosts,
    moviePosts,
  };
}

/**
 * Resolves basic post info (IMDb, TMDB ID, mediaType)
 */
export async function resolveMovieSitePost(
  postUrl: string,
  fallbackTitle?: string
): Promise<ResolvedPostInfo> {
  if (resolvedCache.has(postUrl)) {
    const cached = resolvedCache.get(postUrl)!;
    markExternalAllowed(cached.tmdbId);
    return cached;
  }

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

    if (!tmdbId && fallbackTitle) {
      try {
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
 * Comprehensive post detail and episode link extractor:
 * 1. Fetches post HTML
 * 2. Extracts IMDb ID
 * 3. Fetches TMDB trailer (videoKey), logo, cast, and episode thumbnails
 * 4. Scrapes post download links, resolving landing links (VCloud & non-zip fallbacks)
 * 5. Strictly excludes batch/zip links
 */
export async function fetchPostFullDetails(
  postUrl: string,
  fallbackTitle = "Unknown",
  fallbackPoster = "",
  siteHint = "vegamovies"
): Promise<ScrapedPostDetail> {
  if (fullDetailsCache.has(postUrl)) {
    return fullDetailsCache.get(postUrl)!;
  }

  const originSite = (postUrl.includes("rogmovies") || siteHint === "rogmovies")
    ? "rogmovies"
    : "vegamovies";

  const postHtml = await fetchHtml(postUrl);

  // 1. IMDb ID
  const imdbMatch =
    postHtml.match(/imdb\.com\/title\/(tt\d+)/i) ||
    postHtml.match(/href=["'][^"']*imdb\.com\/title\/(tt\d+)/i) ||
    postHtml.match(/\b(tt\d{7,8})\b/i);
  const imdbId = imdbMatch ? imdbMatch[1] : null;

  // Detect Series vs Movie from post content & title
  const isSeries =
    /\b(season|series|episode|s\d+|s\d+e\d+|tv-show)\b/i.test(postUrl + " " + fallbackTitle + " " + postHtml.slice(0, 3000));
  let mediaType: "movie" | "tv" = isSeries ? "tv" : "movie";

  let tmdbId: number | null = null;
  let title = cleanPostTitle(fallbackTitle);
  let overview = "";
  let posterUrl = fallbackPoster;
  let backdropUrl: string | null = fallbackPoster || null;
  let voteAverage = 7.5;
  let releaseYear = "2026";
  let runtime: string | undefined;
  let genres: string[] = ["Action", "Adventure", "Drama"];

  // 2. Query TMDB Find API with IMDb
  if (imdbId) {
    try {
      const findRes = await fetch(
        `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`
      );
      if (findRes.ok) {
        const fJson = await findRes.json();
        const movie = fJson.movie_results?.[0];
        const tv = fJson.tv_results?.[0];
        if (tv) {
          mediaType = "tv";
          tmdbId = tv.id;
          title = tv.name;
          overview = tv.overview || "";
          if (tv.poster_path) posterUrl = `https://image.tmdb.org/t/p/w500${tv.poster_path}`;
          if (tv.backdrop_path) backdropUrl = `https://image.tmdb.org/t/p/original${tv.backdrop_path}`;
          voteAverage = tv.vote_average ? Number(tv.vote_average.toFixed(1)) : 7.5;
          if (tv.first_air_date) releaseYear = tv.first_air_date.slice(0, 4);
        } else if (movie) {
          mediaType = "movie";
          tmdbId = movie.id;
          title = movie.title;
          overview = movie.overview || "";
          if (movie.poster_path) posterUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
          if (movie.backdrop_path) backdropUrl = `https://image.tmdb.org/t/p/original${movie.backdrop_path}`;
          voteAverage = movie.vote_average ? Number(movie.vote_average.toFixed(1)) : 7.5;
          if (movie.release_date) releaseYear = movie.release_date.slice(0, 4);
        }
      }
    } catch (e) {
      console.warn("[MovieScraper] TMDB find failed:", e);
    }
  }

  // Fallback search TMDB if not resolved
  if (!tmdbId) {
    try {
      const cleanQuery = fallbackTitle
        .replace(/download/i, "")
        .replace(/\b(480p|720p|1080p|2160p|4k|web-dl|bluray|predvd|hdtc|dual audio|multi audio|hindi|english)\b.*/gi, "")
        .replace(/[([{].*?[})\]]/g, "")
        .trim();

      if (cleanQuery.length > 2) {
        const sRes = await fetch(
          `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanQuery)}&include_adult=false`
        );
        if (sRes.ok) {
          const sJson = await sRes.json();
          const first = sJson.results?.[0];
          if (first) {
            tmdbId = first.id;
            mediaType = first.media_type === "tv" ? "tv" : "movie";
            title = first.title || first.name || title;
            overview = first.overview || overview;
            if (first.poster_path) posterUrl = `https://image.tmdb.org/t/p/w500${first.poster_path}`;
            if (first.backdrop_path) backdropUrl = `https://image.tmdb.org/t/p/original${first.backdrop_path}`;
            voteAverage = first.vote_average ? Number(first.vote_average.toFixed(1)) : voteAverage;
            const dateStr = first.release_date || first.first_air_date;
            if (dateStr) releaseYear = dateStr.slice(0, 4);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (!tmdbId) {
    tmdbId = Math.abs(hashCode(postUrl));
  }
  markExternalAllowed(tmdbId);

  // 3. TMDB Deep Enrichment: Trailer, Logo, Cast, Genres, Season Episodes
  let trailerKey: string | null = null;
  let logoUrl: string | null = null;
  const cast: Array<{ name: string; character: string; profileUrl: string | null }> = [];
  interface TmdbEpInfo {
    episode_number: number;
    name: string;
    overview: string;
    still_path: string | null;
  }
  const tmdbEpisodes: TmdbEpInfo[] = [];

  if (tmdbId > 0 && tmdbId < 10000000) {
    try {
      const [vRes, iRes, cRes, dRes] = await Promise.allSettled([
        fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/videos?api_key=${TMDB_API_KEY}`),
        fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/images?api_key=${TMDB_API_KEY}`),
        fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/credits?api_key=${TMDB_API_KEY}`),
        fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`),
      ]);

      if (vRes.status === "fulfilled" && vRes.value.ok) {
        const vData = await vRes.value.json();
        const trailer =
          vData.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer") ||
          vData.results?.find((v: any) => v.site === "YouTube");
        if (trailer) trailerKey = trailer.key;
      }

      if (iRes.status === "fulfilled" && iRes.value.ok) {
        const iData = await iRes.value.json();
        const logo =
          iData.logos?.find((l: any) => l.iso_639_1 === "en") ||
          iData.logos?.[0];
        if (logo?.file_path) {
          logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
        }
      }

      if (cRes.status === "fulfilled" && cRes.value.ok) {
        const cData = await cRes.value.json();
        if (cData.cast && Array.isArray(cData.cast)) {
          cData.cast.slice(0, 12).forEach((actor: any) => {
            cast.push({
              name: actor.name,
              character: actor.character || "",
              profileUrl: actor.profile_path
                ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
                : null,
            });
          });
        }
      }

      if (dRes.status === "fulfilled" && dRes.value.ok) {
        const dData = await dRes.value.json();
        if (dData.genres && Array.isArray(dData.genres)) {
          genres = dData.genres.map((g: any) => g.name);
        }
        if (dData.runtime) {
          const hours = Math.floor(dData.runtime / 60);
          const mins = dData.runtime % 60;
          runtime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        } else if (dData.number_of_seasons) {
          runtime = `${dData.number_of_seasons} Season${dData.number_of_seasons > 1 ? "s" : ""}`;
        }
      }

      // Fetch TMDB Episodes for series
      if (mediaType === "tv") {
        try {
          const sRes = await fetch(
            `https://api.themoviedb.org/3/tv/${tmdbId}/season/1?api_key=${TMDB_API_KEY}`
          );
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData.episodes && Array.isArray(sData.episodes)) {
              sData.episodes.forEach((ep: any) => {
                tmdbEpisodes.push({
                  episode_number: ep.episode_number,
                  name: ep.name || `Episode ${ep.episode_number}`,
                  overview: ep.overview || "",
                  still_path: ep.still_path || null,
                });
              });
            }
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.warn("[MovieScraper] TMDB deep enrichment error:", e);
    }
  }

  // 4. Scrape download & landing links from post body
  const rawPostLinks: Array<{ href: string; text: string; resolution: string }> = [];
  const aRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = aRegex.exec(postHtml)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    const lower = href.toLowerCase() + " " + text.toLowerCase();

    // Skip generic navigation/social/apk links
    if (
      !href ||
      href === "/" ||
      href.startsWith("#") ||
      href.includes("imdb.com") ||
      href.includes("youtube.com") ||
      href.includes("telegram") ||
      href.includes("facebook") ||
      href.includes("twitter") ||
      href.includes("/category/") ||
      href.includes("/tag/") ||
      href.includes("-apk") ||
      href.includes(".apk")
    ) {
      continue;
    }

    // STRICT: Exclude batch / zip links
    if (isBatchOrZip(text) || isBatchOrZip(href)) {
      continue;
    }

    const isLanding =
      lower.includes("nexdrive") ||
      lower.includes("vgmlink") ||
      lower.includes("fastdl") ||
      lower.includes("gdflix") ||
      lower.includes("vcloud") ||
      lower.includes("hubcloud") ||
      lower.includes("filebee");

    const isDwdText =
      lower.includes("download") ||
      lower.includes("episode") ||
      lower.includes("v-cloud") ||
      lower.includes("g-direct") ||
      lower.includes("drive");

    if (isLanding || isDwdText) {
      let resolution = "720p";
      if (lower.includes("2160p") || lower.includes("4k")) resolution = "2160p";
      else if (lower.includes("1080p")) resolution = "1080p";
      else if (lower.includes("480p")) resolution = "480p";

      rawPostLinks.push({ href, text, resolution });
    }
  }

  // 5. Resolve landing pages to extract VCloud or non-zip fallback links
  const extractedHostLinks: Array<{ url: string; label: string; isVcloud: boolean; resolution: string }> = [];

  // Check top landing candidates
  const candidatesToCheck = rawPostLinks.slice(0, 6);

  await Promise.allSettled(
    candidatesToCheck.map(async (candidate) => {
      try {
        const landingHtml = await fetchHtml(candidate.href, postUrl);
        const lRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let lMatch: RegExpExecArray | null;

        while ((lMatch = lRegex.exec(landingHtml)) !== null) {
          const lHref = lMatch[1];
          const lText = lMatch[2].replace(/<[^>]+>/g, "").trim();

          // Strictly skip batch zip links
          if (isBatchOrZip(lText) || isBatchOrZip(lHref)) continue;

          const isVcloud = lHref.includes("vcloud") || lHref.includes("hubcloud");
          const isDirectOther =
            lHref.includes("fastdl.zip") ||
            lHref.includes("filebee.xyz") ||
            lHref.includes("vegadrive") ||
            lHref.includes("gdrive") ||
            lHref.includes("pixeldrain");

          if (isVcloud || isDirectOther) {
            extractedHostLinks.push({
              url: lHref,
              label: lText || (isVcloud ? "V-Cloud Server" : "Direct Server"),
              isVcloud,
              resolution: candidate.resolution,
            });
          }
        }
      } catch {
        // Fallback: candidate itself
        if (!isBatchOrZip(candidate.href)) {
          extractedHostLinks.push({
            url: candidate.href,
            label: candidate.text || "Direct Link",
            isVcloud: candidate.href.includes("vcloud"),
            resolution: candidate.resolution,
          });
        }
      }
    })
  );

  // 6. Format Episodes (for TV Series)
  const episodes: ScrapedEpisode[] = [];

  if (mediaType === "tv") {
    // Separate preferred VCloud links and other direct links
    const vcloudHostLinks = extractedHostLinks.filter((l) => l.isVcloud);
    const otherHostLinks = extractedHostLinks.filter((l) => !l.isVcloud);

    const hostPool = vcloudHostLinks.length > 0 ? vcloudHostLinks : otherHostLinks;
    const totalEpCount = Math.max(hostPool.length, tmdbEpisodes.length, 1);

    for (let i = 0; i < totalEpCount; i++) {
      const epNum = i + 1;
      const tmdbEp = tmdbEpisodes[i];
      const hostItem = hostPool[i];

      const epTitle = tmdbEp?.name || `Episode ${epNum}`;
      const epOverview = tmdbEp?.overview || "";
      const thumbnailUrl = tmdbEp?.still_path
        ? `https://image.tmdb.org/t/p/w500${tmdbEp.still_path}`
        : (backdropUrl || posterUrl);

      episodes.push({
        episodeNumber: epNum,
        title: epTitle,
        overview: epOverview,
        thumbnailUrl,
        vcloudUrl: hostItem?.isVcloud ? hostItem.url : undefined,
        fallbackUrl: hostItem?.url || postUrl,
        resolution: hostItem?.resolution || "720p",
      });
    }
  }

  // 7. Format Movie Qualities (for Movies)
  const movieQualities: ScrapedMovieQuality[] = [];
  const standardResList = ["2160p", "1080p", "720p", "480p"];

  standardResList.forEach((res) => {
    const matching = extractedHostLinks.filter((l) => l.resolution === res);
    const vcloud = matching.find((m) => m.isVcloud);
    const fallback = matching.find((m) => !m.isVcloud) || matching[0];

    if (vcloud || fallback) {
      movieQualities.push({
        resolution: res,
        label: res === "2160p" ? "4K Ultra HD" : `${res} Quality`,
        vcloudUrl: vcloud?.url,
        fallbackUrl: fallback?.url,
      });
    }
  });

  // If no resolution specific link found, add general server entry
  if (movieQualities.length === 0 && extractedHostLinks.length > 0) {
    const firstVcloud = extractedHostLinks.find((l) => l.isVcloud);
    const firstOther = extractedHostLinks.find((l) => !l.isVcloud);
    movieQualities.push({
      resolution: "1080p",
      label: "Fast Streaming Server",
      vcloudUrl: firstVcloud?.url,
      fallbackUrl: firstOther?.url || extractedHostLinks[0]?.url,
    });
  }

  const detailResult: ScrapedPostDetail = {
    postUrl,
    originSite,
    imdbId,
    tmdbId,
    mediaType,
    title,
    overview,
    posterUrl,
    backdropUrl,
    logoUrl,
    trailerKey,
    voteAverage,
    releaseYear,
    runtime,
    genres,
    cast,
    episodes,
    movieQualities,
  };

  fullDetailsCache.set(postUrl, detailResult);
  return detailResult;
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
