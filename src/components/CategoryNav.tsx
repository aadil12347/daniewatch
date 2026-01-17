import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyHoverSwipe } from "@/lib/hoverSwipe";

interface Genre {
  id: number;
  name: string;
}

interface CategoryNavProps {
  genres: Genre[];
  selectedGenres: number[];
  onGenreToggle: (genreId: number) => void;
  onClearGenres: () => void;
  selectedYear: string | null;
  onYearChange: (year: string | null) => void;
}

const YEAR_OPTIONS = [
  { value: null, label: "All Years" },
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
  { value: "2022", label: "2022" },
  { value: "2021", label: "2021" },
  { value: "2020", label: "2020" },
  { value: "older", label: "2019 & Older" },
];

export const CategoryNav = ({
  genres,
  selectedGenres,
  onGenreToggle,
  onClearGenres,
  selectedYear,
  onYearChange,
}: CategoryNavProps) => {
  const [isGenreOpen, setIsGenreOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const genreDropdownRef = useRef<HTMLDivElement>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const genreTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const yearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setHoverSwipeVars = (e: React.MouseEvent<HTMLElement>) => {
    applyHoverSwipe(e.currentTarget, e.clientX, e.clientY);
  };

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(event.target as Node)) {
        setIsGenreOpen(false);
      }
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) {
        setIsYearOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Genre hover handlers
  const handleGenreMouseEnter = () => {
    if (isMobile) return;
    if (genreTimeoutRef.current) clearTimeout(genreTimeoutRef.current);
    setIsGenreOpen(true);
  };

  const handleGenreMouseLeave = () => {
    if (isMobile) return;
    genreTimeoutRef.current = setTimeout(() => setIsGenreOpen(false), 300);
  };

  // Year hover handlers
  const handleYearMouseEnter = () => {
    if (isMobile) return;
    if (yearTimeoutRef.current) clearTimeout(yearTimeoutRef.current);
    setIsYearOpen(true);
  };

  const handleYearMouseLeave = () => {
    if (isMobile) return;
    yearTimeoutRef.current = setTimeout(() => setIsYearOpen(false), 300);
  };

  const getYearLabel = () => {
    if (!selectedYear) return "Year";
    const option = YEAR_OPTIONS.find(o => o.value === selectedYear);
    return option?.label || "Year";
  };

  return (
    <div className="flex flex-col gap-3 content-reveal relative z-50">
      {/* Filters row */}
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
        {/* Genre dropdown */}
        <div
          ref={genreDropdownRef}
          className="relative"
          onMouseEnter={handleGenreMouseEnter}
          onMouseLeave={handleGenreMouseLeave}
        >
          <button
            onMouseMove={setHoverSwipeVars}
            onClick={() => setIsGenreOpen(!isGenreOpen)}
            className={cn(
              "hover-swipe flex items-center gap-1 px-4 sm:px-5 py-3 tracking-tight rounded-none text-xs sm:text-sm font-medium transition-colors duration-200",
              selectedGenres.length > 0
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : isGenreOpen
                ? "bg-secondary/70 text-foreground"
                : "bg-secondary/30 text-foreground/70 hover:text-primary-foreground"
            )}
          >
            <span>Genre</span>
            {selectedGenres.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary-foreground/20 rounded-full">
                {selectedGenres.length}
              </span>
            )}
            <ChevronDown
              className={cn(
                "w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200",
                isGenreOpen && "rotate-180"
              )}
            />
          </button>

          {/* Genre dropdown content */}
          <div
            className={cn(
              "absolute top-full mt-2 bg-card/95 backdrop-blur-xl rounded-lg border border-border shadow-xl transition-all duration-200 overflow-hidden",
              "left-0 w-[calc(100vw-2rem)] max-w-[280px] sm:w-64 md:w-72",
              isGenreOpen
                ? "opacity-100 visible translate-y-0"
                : "opacity-0 invisible -translate-y-2"
            )}
          >
            <div className="p-3 max-h-64 overflow-y-auto">
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {genres.map((genre) => (
                  <button
                    key={genre.id}
                    onMouseMove={setHoverSwipeVars}
                    onClick={() => onGenreToggle(genre.id)}
                    className={cn(
                      "hover-swipe px-3 sm:px-4 py-2 tracking-tight rounded-none text-[10px] sm:text-xs font-medium transition-colors duration-200",
                      selectedGenres.includes(genre.id)
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-secondary/50 text-foreground/70 hover:text-primary-foreground"
                    )}
                  >
                    <span>{genre.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedGenres.length > 0 && (
              <div className="border-t border-border p-2">
                <button
                  onClick={() => {
                    onClearGenres();
                    setIsGenreOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Year dropdown */}
        <div
          ref={yearDropdownRef}
          className="relative"
          onMouseEnter={handleYearMouseEnter}
          onMouseLeave={handleYearMouseLeave}
        >
          <button
            onMouseMove={setHoverSwipeVars}
            onClick={() => setIsYearOpen(!isYearOpen)}
            className={cn(
              "hover-swipe flex items-center gap-1 px-4 sm:px-5 py-3 tracking-tight rounded-none text-xs sm:text-sm font-medium transition-colors duration-200",
              selectedYear
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : isYearOpen
                ? "bg-secondary/70 text-foreground"
                : "bg-secondary/30 hover:text-primary-foreground text-foreground/70"
            )}
          >
            <span>{getYearLabel()}</span>
            <ChevronDown
              className={cn(
                "w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200",
                isYearOpen && "rotate-180"
              )}
            />
          </button>

          {/* Year dropdown content */}
          <div
            className={cn(
              "absolute top-full mt-2 bg-card/95 backdrop-blur-xl rounded-lg border border-border shadow-xl transition-all duration-200 overflow-hidden",
              "left-0 w-36 sm:w-40",
              isYearOpen
                ? "opacity-100 visible translate-y-0"
                : "opacity-0 invisible -translate-y-2"
            )}
          >
            <div className="p-2 max-h-64 overflow-y-auto">
              {YEAR_OPTIONS.map((option) => (
                <button
                  key={option.value ?? "all"}
                  onMouseMove={setHoverSwipeVars}
                  onClick={() => {
                    onYearChange(option.value);
                    setIsYearOpen(false);
                  }}
                  className={cn(
                    "hover-swipe w-full px-4 py-3 tracking-tight text-left text-xs sm:text-sm rounded-none transition-colors",
                    selectedYear === option.value
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:text-primary-foreground"
                  )}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected filters display */}
      {(selectedGenres.length > 0 || selectedYear) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {genres
            .filter((g) => selectedGenres.includes(g.id))
            .slice(0, isMobile ? 2 : 3)
            .map((genre) => (
              <span
                key={genre.id}
                className="px-2 py-1 text-[10px] sm:text-xs bg-primary/20 text-primary rounded-full whitespace-nowrap"
              >
                {genre.name}
              </span>
            ))}
          {selectedGenres.length > (isMobile ? 2 : 3) && (
            <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
              +{selectedGenres.length - (isMobile ? 2 : 3)} more
            </span>
          )}
          {selectedYear && (
            <span className="px-2 py-1 text-[10px] sm:text-xs bg-primary/20 text-primary rounded-full whitespace-nowrap">
              {YEAR_OPTIONS.find(o => o.value === selectedYear)?.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
