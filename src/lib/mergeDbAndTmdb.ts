import { Movie } from "@/lib/tmdb";

export type MediaType = "movie" | "tv";

export const getItemKey = (id: number, mediaType: MediaType) => `${id}-${mediaType}`;

export const getMovieKey = (m: Pick<Movie, "id" | "media_type" | "first_air_date" | "release_date">): string => {
  const mediaType: MediaType = (m.media_type as MediaType) ?? (m.first_air_date ? "tv" : "movie");
  return getItemKey(m.id, mediaType);
};

const getTmdbYear = (m: Pick<Movie, "release_date" | "first_air_date">): number | null => {
  const date = m.release_date || m.first_air_date;
  if (!date) return null;
  const year = Number(String(date).slice(0, 4));
  return Number.isFinite(year) ? year : null;
};

export type DbMetaGetter = (key: string) => { release_year?: number | null } | null;
export type DbPredicate = (key: string) => boolean;

export const mergeDbAndTmdb = (args: {
  tmdbItems: Movie[];
  dbOnlyHydratedItems: Movie[];
  isDbItem: DbPredicate;
  getDbMeta: DbMetaGetter;
}): Movie[] => {
  const { tmdbItems, dbOnlyHydratedItems, isDbItem, getDbMeta } = args;

  const byKey = new Map<string, Movie>();

  // Prefer hydrated items if they collide (they're usually richer).
  for (const m of tmdbItems) byKey.set(getMovieKey(m), m);
  for (const m of dbOnlyHydratedItems) byKey.set(getMovieKey(m), m);

  const all = Array.from(byKey.values());

  const dbFirst: Movie[] = [];
  const rest: Movie[] = [];

  for (const m of all) {
    const key = getMovieKey(m);
    (isDbItem(key) ? dbFirst : rest).push(m);
  }

  const getDbYear = (m: Movie): number | null => {
    const meta = getDbMeta(getMovieKey(m));
    const y = meta?.release_year;
    return typeof y === "number" && Number.isFinite(y) ? y : null;
  };

  const sortByYearDesc = (a: Movie, b: Movie) => {
    const ya = getDbYear(a) ?? getTmdbYear(a) ?? 0;
    const yb = getDbYear(b) ?? getTmdbYear(b) ?? 0;
    if (yb !== ya) return yb - ya;

    const da = a.release_date || a.first_air_date || "";
    const db = b.release_date || b.first_air_date || "";
    return db.localeCompare(da);
  };

  dbFirst.sort(sortByYearDesc);
  rest.sort(sortByYearDesc);

  // Final dedupe pass (paranoia) while keeping the new order.
  const seen = new Set<string>();
  const out: Movie[] = [];
  for (const m of [...dbFirst, ...rest]) {
    const key = getMovieKey(m);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }

  return out;
};
