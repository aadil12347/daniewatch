import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Genre {
  id: number;
  name: string;
}

interface CategoryNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  genres: Genre[];
  selectedGenres: number[];
  onGenreToggle: (genreId: number) => void;
  onClearGenres: () => void;
}

export const CategoryNav = ({
  activeTab,
  onTabChange,
  genres,
  selectedGenres,
  onGenreToggle,
  onClearGenres,
}: CategoryNavProps) => {
  const [isGenreOpen, setIsGenreOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsGenreOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Desktop hover handlers
  const handleMouseEnter = () => {
    if (isMobile) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsGenreOpen(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    timeoutRef.current = setTimeout(() => {
      setIsGenreOpen(false);
    }, 300);
  };

  const handleButtonClick = () => {
    if (isMobile) {
      setIsGenreOpen(!isGenreOpen);
    } else {
      setIsGenreOpen(!isGenreOpen);
    }
  };

  const tabs = [
    { key: "popular", label: "Popular" },
    { key: "latest", label: "Latest" },
  ];

  return (
    <div className="flex flex-col gap-3 content-reveal relative z-50">
      {/* Tabs and Genre dropdown row */}
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
        {/* Genre dropdown - now first */}
        <div
          ref={dropdownRef}
          className="relative"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <button
            onClick={handleButtonClick}
            className={cn(
              "flex items-center gap-1 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200",
              selectedGenres.length > 0
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : isGenreOpen
                ? "bg-secondary/70 text-foreground"
                : "bg-secondary/30 hover:bg-secondary/50 text-foreground/70"
            )}
          >
            Genre
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

          {/* Dropdown content - responsive positioning */}
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
                    onClick={() => onGenreToggle(genre.id)}
                    className={cn(
                      "px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all duration-200",
                      selectedGenres.includes(genre.id)
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-secondary/50 hover:bg-secondary text-foreground/70 hover:text-foreground"
                    )}
                  >
                    {genre.name}
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

        {/* Popular and Latest tabs */}
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-secondary/30 hover:bg-secondary/50 text-foreground/70"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Selected genres display - separate row for better mobile layout */}
      {selectedGenres.length > 0 && (
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
        </div>
      )}
    </div>
  );
};
