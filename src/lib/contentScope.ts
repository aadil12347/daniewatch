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
  return lang ? (KOREAN_LANGS as readonly string[]).includes(lang) : false;
};

// Anime definition used across the app: Japanese + Animation genre.
export const isAnimeScope = (m: unknown): boolean => {
  const lang = getOriginalLanguage(m);
  return lang === "ja" && hasGenre(m, 16);
};

export const isIndianScope = (m: unknown): boolean => {
  const lang = getOriginalLanguage(m);
  return lang ? (INDIAN_LANGS as readonly string[]).includes(lang) : false;
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
