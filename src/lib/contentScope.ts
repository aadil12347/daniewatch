import { Movie } from "@/lib/tmdb";

export const KOREAN_LANGS = ["ko", "zh", "tr"] as const;
export const INDIAN_LANGS = ["hi", "ta", "te"] as const;

const getOriginalLanguage = (m: unknown): string | null => {
  const lang = (m as any)?.original_language;
  return typeof lang === "string" ? lang : null;
};

const hasGenre = (m: unknown, genreId: number): boolean => {
  const ids = (m as any)?.genre_ids;
  return Array.isArray(ids) && ids.includes(genreId);
};

export const isKoreanScope = (m: unknown): boolean => {
  const lang = getOriginalLanguage(m);
  if (lang && (KOREAN_LANGS as readonly string[]).includes(lang)) {
    return true;
  }

  const originCountry = (m as any)?.origin_country;
  if (Array.isArray(originCountry) && originCountry.some((c: string) => ["KR", "CN", "TW", "HK", "TR"].includes(c))) {
    return true;
  }

  const productionCountries = (m as any)?.production_countries;
  if (Array.isArray(productionCountries) && productionCountries.some((pc: any) => ["KR", "CN", "TW", "HK", "TR"].includes(pc.iso_3166_1))) {
    return true;
  }

  return false;
};

// Helper to check Korean scope with DB metadata priority
export const isKoreanScopeWithDb = (
  m: unknown,
  dbMeta?: { originalLanguage?: string | null; originCountry?: string[] | null }
): boolean => {
  // Prefer DB metadata if available
  if (dbMeta?.originalLanguage) {
    return (KOREAN_LANGS as readonly string[]).includes(dbMeta.originalLanguage);
  }
  if (dbMeta?.originCountry?.length) {
    return dbMeta.originCountry.some(c => ["KR", "CN", "TW", "HK", "TR"].includes(c));
  }

  // Fallback to TMDB item data
  return isKoreanScope(m);
};

// Anime definition used across the app: Japanese + Animation genre.
export const isAnimeScope = (m: unknown): boolean => {
  const lang = getOriginalLanguage(m);
  return lang === "ja" && hasGenre(m, 16);
};

// Helper to check Anime scope with DB metadata priority
export const isAnimeScopeWithDb = (
  m: unknown,
  dbMeta?: { originalLanguage?: string | null }
): boolean => {
  // Prefer DB metadata if available
  if (dbMeta?.originalLanguage) {
    return dbMeta.originalLanguage === "ja" && hasGenre(m, 16);
  }

  // Fallback to TMDB item data
  return isAnimeScope(m);
};

export const isIndianScope = (m: unknown): boolean => {
  const lang = getOriginalLanguage(m);
  return lang ? (INDIAN_LANGS as readonly string[]).includes(lang) : false;
};

// Helper to check Indian scope with DB metadata priority
export const isIndianScopeWithDb = (
  m: unknown,
  dbMeta?: { originalLanguage?: string | null }
): boolean => {
  // Prefer DB metadata if available
  if (dbMeta?.originalLanguage) {
    return (INDIAN_LANGS as readonly string[]).includes(dbMeta.originalLanguage);
  }

  // Fallback to TMDB item data
  return isIndianScope(m);
};

export const isAllowedOnMoviesPage = (m: Pick<Movie, "media_type">): boolean => {
  const media = (m.media_type as string | undefined) ?? "movie";
  if (media !== "movie") return false;
  return !(isAnimeScope(m) || isIndianScope(m) || isKoreanScope(m));
};

export const isAllowedOnTvPage = (m: Pick<Movie, "media_type" | "first_air_date">): boolean => {
  const media = (m.media_type as string | undefined) ?? ((m as any)?.first_air_date ? "tv" : undefined);
  if (media !== "tv") return false;
  return !(isAnimeScope(m) || isIndianScope(m) || isKoreanScope(m));
};
