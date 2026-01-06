const TMDB_API_KEY = "fc6d85b3839330e3458701b975195487";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export const getImageUrl = (path: string | null, size: string = "w500") => {
  if (!path) return null;
  return `${IMAGE_BASE_URL}/${size}${path}`;
};

export const getBackdropUrl = (path: string | null) => {
  return getImageUrl(path, "original");
};

export const getPosterUrl = (path: string | null, size: "w185" | "w342" | "w500" | "w780" | "original" = "w500") => {
  return getImageUrl(path, size);
};

export const getProfileUrl = (path: string | null) => {
  return getImageUrl(path, "w185");
};

async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const searchParams = new URLSearchParams({
    api_key: TMDB_API_KEY,
    include_adult: "false",
    ...params,
  });

  const response = await fetch(`${BASE_URL}${endpoint}?${searchParams}`);
  
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  return response.json();
}

export interface Movie {
  id: number;
  title: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
  media_type?: string;
  runtime?: number;
  number_of_seasons?: number;
  adult?: boolean;
}

// Comprehensive blocked words list for adult content filtering
const BLOCKED_WORDS = [
  // Sexual terms
  "sex", "sexy", "sexual", "sexuality",
  "erotic", "erotica", "eroticism",
  "porn", "porno", "pornographic", "pornography",
  "xxx", "x-rated", "x rated",
  "nude", "naked", "nudity", "nudist",
  "orgasm", "orgasmic",
  "breast", "breasts", "boob", "boobs",
  "dick", "penis", "cock", "vagina", "pussy",
  "masturbat", "masturbation",
  "hentai", "ecchi",
  "sensual", "seduction", "seduce",
  "lustful", "lust",
  "softcore", "hardcore",
  "adult film", "adult movie", "adult content",
  "18+", "19+", "r-rated",
  "nsfw", "explicit",
  "steamy", "intimate scene",
  "cohabitation", "affair", "one night stand",
  "stripper", "strip club", "escort",
  "fetish", "bdsm", "bondage",
  "milf", "cougar",
  "threesome", "foursome",
  "hot mom", "hot mother", "sexy mom", "sexy mother",
  "stepmother", "step mother", "stepsister", "step sister",
  "takes off his pants", "takes off her pants",
  "double life", "secret affair",
  "naughty", "provocative", "temptation",
  "forbidden love", "forbidden relationship",
  "seductive", "aroused", "arousing",
  "intimate", "passionate night",
  "one-night", "hookup", "hook up",
  "carnal", "sensuous", "titillating",
  "risque", "risqué", "raunchy",
  "indecent", "lewd", "obscene",
  "voluptuous", "busty", "cleavage",
  "undress", "undressing", "disrobe",
  "bedroom scene", "love scene",
  "scandalous", "taboo",
];

// Blocklist for specific movie/TV IDs that slip through other filters
const BLOCKED_IDS = new Set<number>([
  // Add specific movie/TV IDs here as they are found
]);

// Helper to filter adult content client-side with comprehensive checks
export const filterAdultContent = <T extends { 
  id: number;
  adult?: boolean; 
  title?: string; 
  name?: string; 
  overview?: string;
}>(items: T[]): T[] => {
  return items.filter(item => {
    // Check blocklist first
    if (BLOCKED_IDS.has(item.id)) return false;
    
    // Check adult flag
    if (item.adult) return false;
    
    // Check title, name, and overview for blocked words
    const textToCheck = [
      item.title || '',
      item.name || '',
      item.overview || ''
    ].join(' ').toLowerCase();
    
    // Check if any blocked word is present
    const hasBlockedWord = BLOCKED_WORDS.some(word => 
      textToCheck.includes(word.toLowerCase())
    );
    
    if (hasBlockedWord) return false;
    
    return true;
  });
};

export interface MovieDetails extends Movie {
  genres: { id: number; name: string }[];
  runtime: number;
  tagline: string;
  status: string;
  production_companies: { id: number; name: string; logo_path: string | null }[];
  videos?: {
    results: { key: string; type: string; site: string }[];
  };
}

export interface TVDetails extends Movie {
  genres: { id: number; name: string }[];
  episode_run_time: number[];
  tagline: string;
  status: string;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: Season[];
  videos?: {
    results: { key: string; type: string; site: string }[];
  };
}

export interface Season {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  overview: string;
}

export interface Episode {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
}

export interface SeasonDetails {
  id: number;
  name: string;
  season_number: number;
  episodes: Episode[];
  air_date: string | null;
  poster_path: string | null;
  overview: string;
}

export interface Cast {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface Genre {
  id: number;
  name: string;
}

// Episode Group interfaces (for shows with custom groupings like Parts)
export interface EpisodeGroupEpisode {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
  order: number;
}

export interface EpisodeGroup {
  id: string;
  name: string;
  order: number;
  episodes: EpisodeGroupEpisode[];
}

export interface EpisodeGroupDetails {
  id: string;
  name: string;
  description: string;
  episode_count: number;
  group_count: number;
  groups: EpisodeGroup[];
}

// Map of TV show IDs to their preferred episode group IDs
export const EPISODE_GROUP_CONFIG: Record<number, string> = {
  71446: "5eb730dfca7ec6001f7beb51", // La Casa de Papel - Parts
};

interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

// Movie endpoints
export const getTrending = (timeWindow: "day" | "week" = "day", page: number = 1) =>
  fetchTMDB<TMDBResponse<Movie>>(`/trending/all/${timeWindow}`, { page: page.toString() });

export const getPopularMovies = (page: number = 1) =>
  fetchTMDB<TMDBResponse<Movie>>("/movie/popular", { page: page.toString() });

export const getTopRatedMovies = (page: number = 1) =>
  fetchTMDB<TMDBResponse<Movie>>("/movie/top_rated", { page: page.toString() });

export const getNowPlayingMovies = (page: number = 1) =>
  fetchTMDB<TMDBResponse<Movie>>("/movie/now_playing", { page: page.toString() });

export const getUpcomingMovies = (page: number = 1) =>
  fetchTMDB<TMDBResponse<Movie>>("/movie/upcoming", { page: page.toString() });

export const getMovieDetails = (id: number) =>
  fetchTMDB<MovieDetails>(`/movie/${id}`, { append_to_response: "videos,images", include_image_language: "en,null" });

export const getMovieImages = (id: number) =>
  fetchTMDB<{ logos: { file_path: string; iso_639_1: string | null }[] }>(`/movie/${id}/images`, { include_image_language: "en,null" });

export const getMovieCredits = (id: number) =>
  fetchTMDB<{ cast: Cast[] }>(`/movie/${id}/credits`);

export const getSimilarMovies = (id: number) =>
  fetchTMDB<TMDBResponse<Movie>>(`/movie/${id}/similar`);

export const getMovieRecommendations = (id: number) =>
  fetchTMDB<TMDBResponse<Movie>>(`/movie/${id}/recommendations`);

// TV endpoints
export const getPopularTV = (page: number = 1) =>
  fetchTMDB<TMDBResponse<Movie>>("/tv/popular", { page: page.toString() });

export const getTopRatedTV = (page: number = 1) =>
  fetchTMDB<TMDBResponse<Movie>>("/tv/top_rated", { page: page.toString() });

export const getTVDetails = (id: number) =>
  fetchTMDB<TVDetails>(`/tv/${id}`, { append_to_response: "videos,images", include_image_language: "en,null" });

export const getTVImages = (id: number) =>
  fetchTMDB<{ logos: { file_path: string; iso_639_1: string | null }[] }>(`/tv/${id}/images`, { include_image_language: "en,null" });

export const getTVCredits = (id: number) =>
  fetchTMDB<{ cast: Cast[] }>(`/tv/${id}/credits`);

export const getSimilarTV = (id: number) =>
  fetchTMDB<TMDBResponse<Movie>>(`/tv/${id}/similar`);

export const getTVSeasonDetails = (tvId: number, seasonNumber: number) =>
  fetchTMDB<SeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`);

// Get episode group details (for shows with custom groupings like Parts)
export const getTVEpisodeGroupDetails = (groupId: string) =>
  fetchTMDB<EpisodeGroupDetails>(`/tv/episode_group/${groupId}`);

// Discover TV with filters
export const discoverTV = (page: number = 1, genreIds: number[] = [], sortBy: string = "popularity.desc") =>
  fetchTMDB<TMDBResponse<Movie>>("/discover/tv", {
    page: page.toString(),
    with_genres: genreIds.join(","),
    sort_by: sortBy,
    with_original_language: "ja",
  });

// Search
export const searchMulti = (query: string) =>
  fetchTMDB<TMDBResponse<Movie>>("/search/multi", { query });

// Search for anime (Japanese animation)
export const searchAnime = async (query: string): Promise<TMDBResponse<Movie>> => {
  const results = await fetchTMDB<TMDBResponse<Movie>>("/search/tv", { query });
  // Filter to only Japanese animation
  const filteredResults = results.results.filter(
    (item) => item.genre_ids?.includes(16) // Animation genre
  );
  
  // Also search for Japanese origin
  const detailedResults: Movie[] = [];
  for (const item of filteredResults.slice(0, 20)) {
    try {
      const details = await fetchTMDB<any>(`/tv/${item.id}`);
      if (details.origin_country?.includes("JP") || details.original_language === "ja") {
        detailedResults.push({ ...item, media_type: "tv" });
      }
    } catch {
      // Skip if can't fetch details
    }
  }
  
  return { ...results, results: filterAdultContent(detailedResults) };
};

// Search for Korean, Chinese, and Turkish dramas
export const searchKorean = async (query: string): Promise<TMDBResponse<Movie>> => {
  const results = await fetchTMDB<TMDBResponse<Movie>>("/search/tv", { query });
  
  // Supported countries and languages for this category
  const supportedCountries = ["KR", "CN", "TW", "HK", "TR"]; // Korea, China, Taiwan, Hong Kong, Turkey
  const supportedLanguages = ["ko", "zh", "tr"]; // Korean, Chinese, Turkish
  
  // Filter to only Korean, Chinese, and Turkish content
  const detailedResults: Movie[] = [];
  for (const item of results.results.slice(0, 30)) {
    try {
      const details = await fetchTMDB<any>(`/tv/${item.id}`);
      const hasMatchingCountry = details.origin_country?.some((country: string) => 
        supportedCountries.includes(country)
      );
      const hasMatchingLanguage = supportedLanguages.includes(details.original_language);
      
      if (hasMatchingCountry || hasMatchingLanguage) {
        detailedResults.push({ ...item, media_type: "tv" });
      }
    } catch {
      // Skip if can't fetch details
    }
  }
  
  return { ...results, results: filterAdultContent(detailedResults) };
};

// Genres
export const getMovieGenres = () =>
  fetchTMDB<{ genres: Genre[] }>("/genre/movie/list");

export const getTVGenres = () =>
  fetchTMDB<{ genres: Genre[] }>("/genre/tv/list");

// Regional Popular Content (Latest Released)
export const getIndianPopular = async (page: number = 1): Promise<TMDBResponse<Movie>> => {
  const today = new Date().toISOString().split('T')[0];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateFrom = sixMonthsAgo.toISOString().split('T')[0];
  
  const [movies, tv] = await Promise.all([
    fetchTMDB<TMDBResponse<Movie>>("/discover/movie", {
      page: page.toString(),
      with_origin_country: "IN",
      sort_by: "popularity.desc",
      "primary_release_date.gte": dateFrom,
      "primary_release_date.lte": today,
    }),
    fetchTMDB<TMDBResponse<Movie>>("/discover/tv", {
      page: page.toString(),
      with_origin_country: "IN",
      sort_by: "popularity.desc",
      "first_air_date.gte": dateFrom,
      "first_air_date.lte": today,
    }),
  ]);
  
  const combined = [
    ...filterAdultContent(movies.results).map(m => ({ ...m, media_type: "movie" as const })),
    ...filterAdultContent(tv.results).map(t => ({ ...t, media_type: "tv" as const })),
  ].sort((a, b) => b.vote_average - a.vote_average).slice(0, 20);
  
  return { ...movies, results: combined };
};

export const getAnimePopular = async (page: number = 1): Promise<TMDBResponse<Movie>> => {
  const today = new Date().toISOString().split('T')[0];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateFrom = sixMonthsAgo.toISOString().split('T')[0];
  
  const [movies, tv] = await Promise.all([
    fetchTMDB<TMDBResponse<Movie>>("/discover/movie", {
      page: page.toString(),
      with_genres: "16",
      with_original_language: "ja",
      sort_by: "popularity.desc",
      "primary_release_date.gte": dateFrom,
      "primary_release_date.lte": today,
    }),
    fetchTMDB<TMDBResponse<Movie>>("/discover/tv", {
      page: page.toString(),
      with_genres: "16",
      with_original_language: "ja",
      sort_by: "popularity.desc",
      "first_air_date.gte": dateFrom,
      "first_air_date.lte": today,
    }),
  ]);
  
  const combined = [
    ...filterAdultContent(movies.results).map(m => ({ ...m, media_type: "movie" as const })),
    ...filterAdultContent(tv.results).map(t => ({ ...t, media_type: "tv" as const })),
  ].sort((a, b) => b.vote_average - a.vote_average).slice(0, 20);
  
  return { ...movies, results: combined };
};

export const getKoreanPopular = async (page: number = 1): Promise<TMDBResponse<Movie>> => {
  const today = new Date().toISOString().split('T')[0];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateFrom = sixMonthsAgo.toISOString().split('T')[0];
  
  const [movies, tv] = await Promise.all([
    fetchTMDB<TMDBResponse<Movie>>("/discover/movie", {
      page: page.toString(),
      with_origin_country: "KR",
      sort_by: "popularity.desc",
      "primary_release_date.gte": dateFrom,
      "primary_release_date.lte": today,
    }),
    fetchTMDB<TMDBResponse<Movie>>("/discover/tv", {
      page: page.toString(),
      with_origin_country: "KR",
      sort_by: "popularity.desc",
      "first_air_date.gte": dateFrom,
      "first_air_date.lte": today,
    }),
  ]);
  
  const combined = [
    ...filterAdultContent(movies.results).map(m => ({ ...m, media_type: "movie" as const })),
    ...filterAdultContent(tv.results).map(t => ({ ...t, media_type: "tv" as const })),
  ].sort((a, b) => b.vote_average - a.vote_average).slice(0, 20);
  
  return { ...movies, results: combined };
};

// Helper to format runtime
export const formatRuntime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

// Helper to get year from date
export const getYear = (date: string | undefined) => {
  if (!date) return "N/A";
  return new Date(date).getFullYear();
};

// Helper to get display title
export const getDisplayTitle = (item: Movie) => {
  return item.title || item.name || "Unknown";
};

// Helper to get release date
export const getReleaseDate = (item: Movie) => {
  return item.release_date || item.first_air_date;
};