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
    { key: "latest", label: "Latest" },
    { key: "popular", label: "Popular" },
  ];

  return (
    <div className="flex items-center gap-1 sm:gap-2 flex-wrap content-reveal relative z-50">
      {/* Latest and Popular tabs */}
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

      {/* Genre dropdown */}
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

        {/* Dropdown content */}
        <div
          className={cn(
            "absolute top-full left-0 mt-2 w-72 sm:w-80 p-3 sm:p-4 rounded-xl bg-popover border border-border shadow-2xl transition-all duration-200 origin-top-left",
            isGenreOpen
              ? "opacity-100 scale-100 pointer-events-auto z-[100]"
              : "opacity-0 scale-95 pointer-events-none z-[100]"
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{ zIndex: 100 }}
        >
          {/* Header with clear button */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs sm:text-sm text-muted-foreground font-medium">
              Select Genres
            </span>
            {selectedGenres.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearGenres();
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {/* Genre grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 max-h-64 overflow-y-auto">
            {genres.map((genre) => (
              <button
                key={genre.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onGenreToggle(genre.id);
                }}
                className={cn(
                  "px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg text-xs font-medium transition-all text-left truncate",
                  selectedGenres.includes(genre.id)
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground"
                )}
              >
                {genre.name}
              </button>
            ))}
          </div>

          {/* Mobile close hint */}
          {isMobile && (
            <p className="text-[10px] text-muted-foreground text-center mt-3 pt-2 border-t border-border/50">
              Tap outside to close
            </p>
          )}
        </div>
      </div>

      {/* Selected genres display */}
      {selectedGenres.length > 0 && (
        <div className="flex items-center gap-1.5 ml-2">
          {genres
            .filter((g) => selectedGenres.includes(g.id))
            .slice(0, 3)
            .map((genre) => (
              <span
                key={genre.id}
                className="px-2 py-1 text-[10px] sm:text-xs bg-primary/20 text-primary rounded-full"
              >
                {genre.name}
              </span>
            ))}
          {selectedGenres.length > 3 && (
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              +{selectedGenres.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
};
