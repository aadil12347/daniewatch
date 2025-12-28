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
      <div className="container mx-auto px-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative w-10 h-10 rounded-xl gradient-red flex items-center justify-center shadow-glow transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
            <span className="text-2xl font-black text-foreground italic tracking-tighter drop-shadow-lg" style={{ fontFamily: 'Georgia, serif' }}>D</span>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-foreground/20 rounded-full blur-sm" />
          </div>
          <span className="text-xl font-bold tracking-tight hidden sm:block">
            Danie<span className="text-primary">Watch</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          <Link
            to="/movies"
            className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors"
          >
            <Film className="w-4 h-4" />
            Movies
          </Link>
          <Link
            to="/tv"
            className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors"
          >
            <Tv className="w-4 h-4" />
            TV Shows
          </Link>
          <Link
            to="/anime"
            className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Anime
          </Link>
          <Link
            to="/watchlist"
            className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors"
          >
            <Bookmark className="w-4 h-4" />
            Watch List
          </Link>
        </div>

        {/* Search & Menu */}
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

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-full hover:bg-secondary/50 transition-colors"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden glass mt-2 mx-4 rounded-xl p-4 animate-fade-in">
          <div className="flex flex-col gap-4">
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
      )}
    </nav>
  );
};
