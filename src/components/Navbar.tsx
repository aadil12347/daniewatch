import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Menu, X, Film, Tv, Home, Sparkles, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setIsSearchOpen(false);
    }
  };

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled ? "glass py-3" : "bg-gradient-to-b from-background/80 to-transparent py-4"
      )}
    >
      {/* Bottom glow effect */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="absolute bottom-0 left-1/4 right-1/4 h-8 bg-gradient-to-t from-primary/10 to-transparent blur-xl pointer-events-none" />
      <div className="container mx-auto px-4 flex items-center justify-between relative">
        {/* Mobile Menu Toggle - Left side on mobile/tablet */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-full hover:bg-secondary/50 transition-colors"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Logo - Centered on mobile/tablet, left on desktop */}
        <Link to="/" className="flex items-center gap-2 group md:relative absolute left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0">
          <div className="relative w-10 h-10 flex items-center justify-center transition-all duration-500 group-hover:scale-110">
            <svg viewBox="0 0 100 100" className="w-10 h-10 drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)] group-hover:drop-shadow-[0_0_15px_hsl(var(--primary)/0.8)] transition-all duration-500">
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(0, 84%, 65%)" />
                  <stop offset="100%" stopColor="hsl(0, 84%, 50%)" />
                </linearGradient>
              </defs>
              <path
                d="M25 15 C15 15 10 25 10 50 C10 75 15 85 25 85 L55 85 C75 85 90 70 90 50 C90 30 75 15 55 15 L40 15 L40 25 L55 25 C68 25 78 35 78 50 C78 65 68 75 55 75 L25 75 C22 75 22 70 22 50 C22 30 22 25 25 25 L25 15 Z M30 35 L30 65 L55 65 C60 65 65 60 65 50 C65 40 60 35 55 35 L30 35 Z"
                fill="url(#logoGradient)"
              />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">
            Danie<span className="text-primary">Watch</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            className="nav-link-glow flex items-center gap-2 text-foreground/80 hover:text-foreground transition-all duration-300"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          <Link
            to="/movies"
            className="nav-link-glow flex items-center gap-2 text-foreground/80 hover:text-foreground transition-all duration-300"
          >
            <Film className="w-4 h-4" />
            Movies
          </Link>
          <Link
            to="/tv"
            className="nav-link-glow flex items-center gap-2 text-foreground/80 hover:text-foreground transition-all duration-300"
          >
            <Tv className="w-4 h-4" />
            TV Shows
          </Link>
          <Link
            to="/anime"
            className="nav-link-glow flex items-center gap-2 text-foreground/80 hover:text-foreground transition-all duration-300"
          >
            <Sparkles className="w-4 h-4" />
            Anime
          </Link>
          <Link
            to="/watchlist"
            className="nav-link-glow flex items-center gap-2 text-foreground/80 hover:text-foreground transition-all duration-300"
          >
            <Bookmark className="w-4 h-4" />
            Watch List
          </Link>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          {/* Search Form */}
          <form
            onSubmit={handleSearch}
            className={cn(
              "flex items-center transition-all duration-300",
              isSearchOpen ? "w-64" : "w-auto"
            )}
          >
            {isSearchOpen ? (
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search movies, TV shows..."
                  className="w-full bg-secondary/50 border border-border rounded-full px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="p-2 rounded-full hover:bg-secondary/50 transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Mobile Menu with slide-in animation */}
      <div 
        className={cn(
          "md:hidden fixed top-0 left-0 h-full w-64 glass z-50 transform transition-transform duration-300 ease-out",
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col gap-2 p-4 pt-20">
          <Link
            to="/"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <Home className="w-5 h-5" />
            Home
          </Link>
          <Link
            to="/movies"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <Film className="w-5 h-5" />
            Movies
          </Link>
          <Link
            to="/tv"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <Tv className="w-5 h-5" />
            TV Shows
          </Link>
          <Link
            to="/anime"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <Sparkles className="w-5 h-5" />
            Anime
          </Link>
          <Link
            to="/watchlist"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <Bookmark className="w-5 h-5" />
            Watch List
          </Link>
        </div>
      </div>

      {/* Backdrop overlay */}
      {isMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </nav>
  );
};
