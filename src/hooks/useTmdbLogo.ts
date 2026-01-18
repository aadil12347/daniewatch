import { useQuery } from "@tanstack/react-query";
import { getImageUrl, getMovieImages, getTVImages } from "@/lib/tmdb";

type MediaType = "movie" | "tv";

const pickBestLogo = (logos?: { file_path: string; iso_639_1: string | null }[]) => {
  if (!logos || logos.length === 0) return null;
  return logos.find((l) => l.iso_639_1 === "en") ?? logos[0] ?? null;
};

export const useTmdbLogo = (mediaType: MediaType, tmdbId: number, enabled: boolean) => {
  return useQuery({
    queryKey: ["tmdb-logo", mediaType, tmdbId],
    enabled,
    staleTime: 1000 * 60 * 60 * 24, // 24h
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7d
    queryFn: async () => {
      const images = mediaType === "tv" ? await getTVImages(tmdbId) : await getMovieImages(tmdbId);
      const logo = pickBestLogo(images?.logos);
      return logo ? getImageUrl(logo.file_path, "w500") : null;
    },
  });
};
