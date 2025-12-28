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
}

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

// Genres
export const getMovieGenres = () =>
  fetchTMDB<{ genres: Genre[] }>("/genre/movie/list");

export const getTVGenres = () =>
  fetchTMDB<{ genres: Genre[] }>("/genre/tv/list");

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
