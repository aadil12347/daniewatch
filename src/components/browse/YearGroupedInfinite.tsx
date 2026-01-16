import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  discoverMoviesByYear,
  discoverTVByYear,
  discoverMixedByYear,
  filterAdultContent,
  filterAdultContentStrict,
  filterMinimal,
  Movie,
} from "@/lib/tmdb";
import { YearSection } from "@/components/browse/YearSection";

export type BrowseMode = "global" | "indian" | "anime" | "korean";
export type MediaScope = "movie" | "tv" | "mixed";

function getCurrentYear() {
  return new Date().getFullYear();
}

export function YearGroupedInfinite({
  mode,
  mediaScope,
  selectedGenres,
  selectedYear,
  maxYears,
}: {
  mode: BrowseMode;
  mediaScope: MediaScope;
  selectedGenres: number[];
  selectedYear: string | null;
  maxYears?: number;
}) {
  const [yearOrder, setYearOrder] = useState<number[]>([]);
  const [itemsByYear, setItemsByYear] = useState<Record<number, Movie[]>>({});
  const [loadingYear, setLoadingYear] = useState<Record<number, boolean>>({});
  const [loadingMoreYear, setLoadingMoreYear] = useState<Record<number, boolean>>({});
  const [pageByYear, setPageByYear] = useState<Record<number, number>>({});
  const [hasMoreByYear, setHasMoreByYear] = useState<Record<number, boolean>>({});

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const strictFilter = mode === "indian" || mode === "korean";

  const normalizeResults = useCallback(
    async (raw: Movie[], defaultMedia: "movie" | "tv" | undefined) => {
      // Mode-specific filtering:
      // - anime/korean search helpers already strict in their endpoints; for discover we keep existing behavior
      // - global: minimal adult filtering
      // - indian/korean: strict certification checks like existing pages
      if (strictFilter) {
        return await filterAdultContentStrict(raw, defaultMedia ?? "movie");
      }
      if (mode === "global") {
        return filterMinimal(raw);
      }
      return filterAdultContent(raw);
    },
    [mode, strictFilter]
  );

  const fetchYearPage = useCallback(
    async ({ year, page, reset }: { year: number; page: number; reset: boolean }) => {
      if (reset) {
        setLoadingYear((p) => ({ ...p, [year]: true }));
      } else {
        setLoadingMoreYear((p) => ({ ...p, [year]: true }));
      }

      try {
        let response:
          | { results: Movie[]; page: number; total_pages: number }
          | { results: Movie[]; page: number; total_pages: number };

        if (mediaScope === "movie") {
          response = await discoverMoviesByYear({ year, page, mode, genreIds: selectedGenres, selectedYear });
          const normalized = await normalizeResults(response.results, "movie");
          setItemsByYear((prev) => ({
            ...prev,
            [year]: reset ? normalized.map((m) => ({ ...m, media_type: "movie" })) : [...(prev[year] ?? []), ...normalized.map((m) => ({ ...m, media_type: "movie" }))],
          }));
        } else if (mediaScope === "tv") {
          response = await discoverTVByYear({ year, page, mode, genreIds: selectedGenres, selectedYear });
          const normalized = await normalizeResults(response.results, "tv");
          setItemsByYear((prev) => ({
            ...prev,
            [year]: reset ? normalized.map((t) => ({ ...t, media_type: "tv" })) : [...(prev[year] ?? []), ...normalized.map((t) => ({ ...t, media_type: "tv" }))],
          }));
        } else {
          response = await discoverMixedByYear({ year, page, mode, genreIds: selectedGenres, selectedYear });
          const normalized = await normalizeResults(response.results, undefined);
          setItemsByYear((prev) => ({
            ...prev,
            [year]: reset ? normalized : [...(prev[year] ?? []), ...normalized],
          }));
        }

        setPageByYear((p) => ({ ...p, [year]: page }));
        setHasMoreByYear((p) => ({ ...p, [year]: page < response.total_pages }));
      } catch (e) {
        console.error("Failed to fetch year", { year, page, e });
        setHasMoreByYear((p) => ({ ...p, [year]: false }));
      } finally {
        setLoadingYear((p) => ({ ...p, [year]: false }));
        setLoadingMoreYear((p) => ({ ...p, [year]: false }));
      }
    },
    [mediaScope, mode, normalizeResults, selectedGenres, selectedYear]
  );

  const resetAll = useCallback(() => {
    setItemsByYear({});
    setLoadingYear({});
    setLoadingMoreYear({});
    setPageByYear({});
    setHasMoreByYear({});

    const current = getCurrentYear();

    if (selectedYear) {
      const y = selectedYear === "older" ? 2019 : Number(selectedYear);
      setYearOrder([y]);
      // fetch the first page for the selected year
      queueMicrotask(() => fetchYearPage({ year: y, page: 1, reset: true }));
      return;
    }

    const initialYears: number[] = [];
    const count = maxYears ?? 6;
    for (let i = 0; i < count; i++) initialYears.push(current - i);
    setYearOrder(initialYears);

    queueMicrotask(() => {
      initialYears.forEach((y) => fetchYearPage({ year: y, page: 1, reset: true }));
    });
  }, [fetchYearPage, maxYears, selectedYear]);

  // Reset when mode/filters change
  useEffect(() => {
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mediaScope, selectedGenres.join(","), selectedYear, maxYears]);

  // Infinite scroll behavior
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting) return;

        if (selectedYear) {
          // For single-year view, load next page for that year
          const y = yearOrder[0];
          if (!y) return;
          if (loadingMoreYear[y] || loadingYear[y]) return;
          if (!hasMoreByYear[y]) return;
          const nextPage = (pageByYear[y] ?? 1) + 1;
          fetchYearPage({ year: y, page: nextPage, reset: false });
          return;
        }

        // For multi-year view, append the next year section
        const lastYear = yearOrder[yearOrder.length - 1];
        if (!lastYear) return;
        const nextYear = lastYear - 1;
        if (maxYears && yearOrder.length >= maxYears) return;
        if (yearOrder.includes(nextYear)) return;

        setYearOrder((prev) => [...prev, nextYear]);
        fetchYearPage({ year: nextYear, page: 1, reset: true });
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);

    return () => observerRef.current?.disconnect();
  }, [fetchYearPage, hasMoreByYear, loadingMoreYear, loadingYear, maxYears, pageByYear, selectedYear, yearOrder]);

  const anyLoading = useMemo(() => yearOrder.some((y) => loadingYear[y]), [loadingYear, yearOrder]);

  return (
    <div className="space-y-2">
      {yearOrder.map((y) => (
        <YearSection
          key={y}
          yearLabel={selectedYear && selectedYear === "older" ? "2019 & Older" : String(y)}
          items={itemsByYear[y] ?? []}
          isLoading={!!loadingYear[y] && (itemsByYear[y]?.length ?? 0) === 0}
          mediaType={mediaScope}
        />
      ))}

      <div ref={sentinelRef} className="flex justify-center py-8">
        {(anyLoading || (selectedYear && loadingMoreYear[yearOrder[0] ?? 0])) && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading more...</span>
          </div>
        )}
      </div>
    </div>
  );
}
