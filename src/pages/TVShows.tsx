import { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { Helmet } from "react-helmet-async";

import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { CategoryNav } from "@/components/CategoryNav";
import { Skeleton } from "@/components/ui/skeleton";
import { getTVGenres, filterAdultContent, Movie, Genre } from "@/lib/tmdb";
import { useListStateCache } from "@/hooks/useListStateCache";
import { useMinDurationLoading } from "@/hooks/useMinDurationLoading";
import { usePostModeration } from "@/hooks/usePostModeration";
import { usePageHoverPreload } from "@/hooks/usePageHoverPreload";
import { useEntryAvailability } from "@/hooks/useEntryAvailability";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminListFilter } from "@/contexts/AdminListFilterContext";
import { groupDbLinkedFirst } from "@/lib/sortContent";

const TVShows = () => {
  const [shows, setShows] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useMinDurationLoading(2000);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestoredFromCache, setIsRestoredFromCache] = useState(false);
  const [animateFromIndex, setAnimateFromIndex] = useState(0);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedElRef = useRef<Element | null>(null);
  const isFetchingMoreRef = useRef(false);
  const pageRef = useRef(1);

  const restoreScrollYRef = useRef<number | null>(null);
  const anchorRef = useRef<{ scrollY: number; docHeight: number; wasNearBottom: boolean } | null>(null);
  const userMovedDuringLoadRef = useRef(false);
  const prevLenRef = useRef(0);

  const { saveCache, getCache } = useListStateCache<Movie>();
  const { filterBlockedPosts, isLoading: isModerationLoading } = usePostModeration();
  const { isAdmin } = useAdmin();
  const { showOnlyDbLinked } = useAdminListFilter();
  const { getAvailability, isLoading: isAvailabilityLoading } = useEntryAvailability();

  const baseVisible = useMemo(() => filterBlockedPosts(shows, "tv"), [filterBlockedPosts, shows]);

  const visibleShows = useMemo(() => {
    const sorted = isAvailabilityLoading
      ? baseVisible
      : groupDbLinkedFirst(baseVisible, (s) => {
          const a = getAvailability(s.id);
          return a.hasWatch || a.hasDownload;
        });

    return isAdmin && showOnlyDbLinked
      ? sorted.filter((s) => {
          const a = getAvailability(s.id);
          return a.hasWatch || a.hasDownload;
        })
      : sorted;
  }, [baseVisible, getAvailability, isAdmin, isAvailabilityLoading, showOnlyDbLinked]);

  const { isLoading: isHoverPreloadLoading } = usePageHoverPreload(visibleShows, { enabled: !isLoading });

  const pageIsLoading = isLoading || isModerationLoading || isHoverPreloadLoading || isAvailabilityLoading;

  // Fetch genres on mount
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await getTVGenres();
        setGenres(response.genres);
      } catch (error) {
        console.error("Failed to fetch genres:", error);
      }
    };
    fetchGenres();
  }, []);

  // Try to restore from cache on mount
  useEffect(() => {
    const cached = getCache("default", selectedGenres);
    if (cached && cached.items.length > 0) {
      restoreScrollYRef.current = cached.scrollY ?? 0;
      setShows(cached.items);
      setPage(cached.page);
      pageRef.current = cached.page;
      setHasMore(cached.hasMore);
      setIsLoading(false);
      setIsRestoredFromCache(true);
    }
    setIsInitialized(true);
  }, []);

  // Restore scroll position after cache is applied
  useEffect(() => {
    if (!isRestoredFromCache) return;
    if (shows.length === 0) return;

    const y = restoreScrollYRef.current;
    if (y === null) return;
    restoreScrollYRef.current = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: "auto" });
      });
    });
  }, [isRestoredFromCache, shows.length]);

  // Save cache before unmount
  useEffect(() => {
    return () => {
      if (shows.length > 0) {
        saveCache({
          items: shows,
          page,
          hasMore,
          activeTab: "default",
          selectedFilters: selectedGenres,
        });
      }
    };
  }, [shows, page, hasMore, selectedGenres, saveCache]);

  const requestShows = useCallback(async (pageNum: number) => {
    const today = new Date().toISOString().split("T")[0];

    const params = new URLSearchParams({
      api_key: "fc6d85b3839330e3458701b975195487",
      include_adult: "false",
      page: pageNum.toString(),
      sort_by: "first_air_date.desc",
      "vote_count.gte": "20",
      "first_air_date.lte": today,
    });

    if (selectedYear) {
      if (selectedYear === "older") {
        params.set("first_air_date.lte", "2019-12-31");
      } else {
        params.set("first_air_date_year", selectedYear);
      }
    }

    if (selectedGenres.length > 0) {
      params.set("with_genres", selectedGenres.join(","));
    }

    const res = await fetch(`https://api.themoviedb.org/3/discover/tv?${params}`);
    const response = await res.json();

    const results = filterAdultContent(response.results) as Movie[];
    const more = response.page < response.total_pages;

    return { results, hasMore: more };
  }, [selectedGenres, selectedYear]);

  const fetchShows = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (reset) {
        setIsLoading(true);
        setAnimateFromIndex(0);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const { results, hasMore: more } = await requestShows(pageNum);

        if (reset) {
          setShows(results);
          // avoid re-triggering fly-in on initial/reset renders (prevents "flashing")
          setAnimateFromIndex(results.length);
        } else {
          setShows((prev) => [...prev, ...results]);
        }

        setHasMore(more);
      } catch (error) {
        console.error("Failed to fetch TV shows:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [requestShows, setIsLoadingMore]
  );

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    if (isLoading) return;
    if (isLoadingMore) return;
    if (isFetchingMoreRef.current) return;

    // single-flight lock
    isFetchingMoreRef.current = true;

    const distanceToBottom =
      document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);

    anchorRef.current = {
      scrollY: window.scrollY,
      docHeight: document.documentElement.scrollHeight,
      wasNearBottom: distanceToBottom < 140,
    };
    userMovedDuringLoadRef.current = false;

    const onUserScroll = () => {
      userMovedDuringLoadRef.current = true;
    };

    window.addEventListener("scroll", onUserScroll, { passive: true });

    // animate only newly appended items
    setAnimateFromIndex(shows.length);

    try {
      setIsLoadingMore(true);
      const nextPage = pageRef.current + 1;
      const { results, hasMore: more } = await requestShows(nextPage);

      setShows((prev) => [...prev, ...results]);
      setHasMore(more);

      pageRef.current = nextPage;
      setPage(nextPage);
    } catch (error) {
      console.error("Failed to fetch TV shows:", error);
    } finally {
      window.removeEventListener("scroll", onUserScroll);
      setIsLoadingMore(false);
      isFetchingMoreRef.current = false;
    }
  }, [hasMore, isLoading, isLoadingMore, requestShows, setIsLoadingMore, shows.length]);

  const ensureObserver = useCallback(() => {
    if (observerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries, self) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          // baton passing: only the last card should be observed
          self.unobserve(entry.target);
          observedElRef.current = null;

          void loadMore();
        });
      },
      {
        root: null,
        rootMargin: "0px 0px 0px 0px",
        threshold: 0.99,
      }
    );
  }, [loadMore]);

  const setLastCardNode = useCallback(
    (node: HTMLElement | null) => {
      ensureObserver();
      if (!observerRef.current) return;

      if (observedElRef.current) {
        observerRef.current.unobserve(observedElRef.current);
        observedElRef.current = null;
      }

      if (node) {
        observedElRef.current = node;
        observerRef.current.observe(node);
      }
    },
    [ensureObserver]
  );

  // Fetch more when page changes (handled by observer + loadMore) — intentionally removed

  // Tell global loader it can stop as soon as we have real content on screen.
  useEffect(() => {
    if (!pageIsLoading && shows.length > 0) {
      requestAnimationFrame(() => window.dispatchEvent(new Event("route:content-ready")));
    }
  }, [pageIsLoading, shows.length]);

  // Reset and fetch when filters change
  useEffect(() => {
    if (!isInitialized) return;
    if (isRestoredFromCache) {
      setIsRestoredFromCache(false);
      return;
    }

    pageRef.current = 1;
    setPage(1);
    setShows([]);
    setHasMore(true);

    fetchShows(1, true);
  }, [selectedGenres, selectedYear, isInitialized, fetchShows, isRestoredFromCache]);

  // Keep visual scroll position stable after appending cards
  useLayoutEffect(() => {
    const len = shows.length;
    const prev = prevLenRef.current;
    prevLenRef.current = len;

    if (len <= prev) return;
    if (!anchorRef.current) return;

    // Only stabilize when the user was actually "waiting at the bottom".
    if (!anchorRef.current.wasNearBottom) {
      anchorRef.current = null;
      return;
    }

    // If the user scrolled intentionally during the request, don't fight them.
    if (userMovedDuringLoadRef.current) {
      anchorRef.current = null;
      return;
    }

    // Only correct if we're still basically at the same scroll position.
    if (Math.abs(window.scrollY - anchorRef.current.scrollY) < 6) {
      window.scrollTo({ top: anchorRef.current.scrollY, left: 0, behavior: "auto" });
    }
    anchorRef.current = null;
  }, [shows.length]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      observedElRef.current = null;
    };
  }, []);

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((prev) => (prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]));
  };

  const clearGenres = () => {
    setSelectedGenres([]);
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedYear(null);
  };

  // Convert genres to CategoryNav format
  const genresForNav = useMemo(() => genres.map((g) => ({ id: g.id, name: g.name })), [genres]);

  return (
    <>
      <Helmet>
        <title>TV Shows - DanieWatch</title>
        <meta name="description" content="Browse TV shows sorted by latest release date. Filter by genre and year." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pt-24 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 content-reveal">TV Shows</h1>

          {/* Category Navigation */}
          <div className="mb-8">
            <CategoryNav
              genres={genresForNav}
              selectedGenres={selectedGenres}
              onGenreToggle={toggleGenre}
              onClearGenres={clearGenres}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
            />
          </div>

          {/* Grid */}
          <div id="one" className="image-grid">
            {pageIsLoading
              ? Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="image-grid__card image-grid__card--flyin">
                    <Skeleton className="aspect-[2/3] rounded-xl" />
                    <Skeleton className="h-4 w-3/4 mt-3" />
                    <Skeleton className="h-3 w-1/2 mt-2" />
                  </div>
                ))
              : visibleShows.map((show, index) => {
                  const isLast = index === visibleShows.length - 1;
                  const shouldFlyIn = index >= animateFromIndex;

                  return (
                    <div
                      key={`${show.id}-tv`}
                      ref={isLast ? setLastCardNode : undefined}
                      className={shouldFlyIn ? "image-grid__card image-grid__card--flyin" : "image-grid__card"}
                    >
                      <MovieCard movie={{ ...show, media_type: "tv" }} animationDelay={0} />
                    </div>
                  );
                })}
          </div>

          {/* No results message */}
          {!pageIsLoading && shows.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No TV shows found with the selected filters.</p>
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm hover:bg-primary/90 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Loading More Indicator */}
          <div className="image-grid__footer">
            {isLoadingMore && (
              <div className="image-grid__status">
                <div className="pl pl-fade" aria-hidden="true" />
                <p className="text-muted-foreground">Loading…</p>
              </div>
            )}

            {!isLoadingMore && !hasMore && shows.length > 0 && (
              <div className="image-grid__status">
                <p className="text-muted-foreground">You've reached the end</p>
              </div>
            )}

            {/* Keep existing loader as a fallback for accessibility */}
            <span className="sr-only">
              {isLoadingMore ? "Loading more" : !hasMore && shows.length > 0 ? "End of list" : ""}
            </span>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default TVShows;


