import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, Menu, X, Film, Tv, Home, Sparkles, Bookmark, ArrowLeft, Heart, User, LogOut, FileText, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export const Navbar = () => {
  const { user, signOut } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, _setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const setIsSearchOpen = (next: boolean) => {
    _setIsSearchOpen(next);
    try {
      sessionStorage.setItem("navbar_search_open", next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  // Restore search open state after route changes (Navbar is remounted on navigation)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("navbar_search_open");
      if (saved === "1") {
        _setIsSearchOpen(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // Close search bar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    if (isSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSearchOpen]);

  // Check if we're on a details page
  const isDetailsPage =
    location.pathname.startsWith("/movie/") || location.pathname.startsWith("/tv/");

  const getUrlParam = (key: string) => {
    const sp = new URLSearchParams(location.search);
    return sp.get(key) || "";
  };

  // Sync search query from URL when navigating to search page
  useEffect(() => {
    if (location.pathname !== "/search") return;

    const urlQuery = getUrlParam("q");
    setSearchQuery(urlQuery);
    if (urlQuery) {
      setIsSearchOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      setIsScrolled(currentScrollY > 50);

      // Hide when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsHidden(true);
      } else {
        setIsHidden(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  const getOriginalPath = () => {
    if (location.pathname === "/anime" || getUrlParam("category") === "anime") {
      return "/anime";
    }
    if (location.pathname === "/korean" || getUrlParam("category") === "korean") {
      return "/korean";
    }
    return null;
  };

  const getCategoryParam = () => {
    const originalPath = getOriginalPath();
    if (originalPath === "/anime") return "&category=anime";
    if (originalPath === "/korean") return "&category=korean";
    return "";
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // If user clears the search bar, navigate back to original page
    if (!value.trim()) {
      const originalPath = getOriginalPath();
      if (originalPath) {
        navigate(originalPath, { replace: true });
      } else if (location.pathname === "/search") {
        navigate("/", { replace: true });
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) return;

    const nextUrl = `/search?q=${encodeURIComponent(searchQuery.trim())}${getCategoryParam()}&t=${Date.now()}`;
    console.log("[search] navigate", nextUrl);
    navigate(nextUrl);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const navLinks = [
    { to: "/", label: "Home", icon: Home },
    { to: "/movies", label: "Movies", icon: Film },
    { to: "/tv", label: "TV Shows", icon: Tv },
    { to: "/anime", label: "Anime", icon: Sparkles },
    { to: "/korean", label: "Korean", icon: Heart },
    { to: "/watchlist", label: "Watch List", icon: Bookmark },
  ];

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out",
          isScrolled ? "glass py-3" : "bg-gradient-to-b from-background/80 to-transparent py-4",
          isHidden ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        )}
      >
        {/* Bottom glow effect */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute bottom-0 left-1/4 right-1/4 h-8 bg-gradient-to-t from-primary/10 to-transparent blur-xl pointer-events-none" />
        
        <div className="container mx-auto px-4 flex items-center justify-between relative">
          {/* Left side: Menu toggle for mobile */}
          <div className="flex items-center md:w-auto w-10">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-full hover:bg-secondary/50 transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Logo - Desktop only on left */}
            <Link 
              to="/" 
              className="hidden md:flex items-center gap-2 group"
            >
              <div className="relative w-10 h-10 flex items-center justify-center transition-all duration-500 group-hover:scale-110">
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)] group-hover:drop-shadow-[0_0_15px_hsl(var(--primary)/0.8)] transition-all duration-500">
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
          </div>

          {/* Center: Logo for mobile/tablet - hidden when search is open */}
          <Link 
            to="/" 
            className={cn(
              "md:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-2 group transition-all duration-300",
              isSearchOpen && "opacity-0 pointer-events-none"
            )}
          >
            <div className="relative w-8 h-8 flex items-center justify-center transition-all duration-500 group-hover:scale-110">
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)] group-hover:drop-shadow-[0_0_15px_hsl(var(--primary)/0.8)] transition-all duration-500">
                <defs>
                  <linearGradient id="logoGradientMobile" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(0, 84%, 65%)" />
                    <stop offset="100%" stopColor="hsl(0, 84%, 50%)" />
                  </linearGradient>
                </defs>
                <path
                  d="M25 15 C15 15 10 25 10 50 C10 75 15 85 25 85 L55 85 C75 85 90 70 90 50 C90 30 75 15 55 15 L40 15 L40 25 L55 25 C68 25 78 35 78 50 C78 65 68 75 55 75 L25 75 C22 75 22 70 22 50 C22 30 22 25 25 25 L25 15 Z M30 35 L30 65 L55 65 C60 65 65 60 65 50 C65 40 60 35 55 35 L30 35 Z"
                  fill="url(#logoGradientMobile)"
                />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">
              Danie<span className="text-primary">Watch</span>
            </span>
          </Link>

          {/* Center: Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "nav-link-glow flex items-center gap-2 transition-all duration-300",
                  location.pathname === link.to 
                    ? "text-foreground" 
                    : "text-foreground/70 hover:text-foreground"
                )}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side: Search + User */}
          <div className={cn(
            "flex items-center gap-2 transition-all duration-300",
            isSearchOpen && "md:flex-none flex-1 ml-2"
          )} ref={searchRef}>
            <form
              onSubmit={handleSearch}
              className={cn(
                "flex items-center transition-all duration-300",
                isSearchOpen ? "flex-1 md:flex-none md:w-64" : "w-auto"
              )}
            >
              {isSearchOpen ? (
                <div className="relative w-full">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search..."
                    className="w-full bg-secondary/50 border border-border rounded-full px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 rounded-full hover:bg-secondary/50 transition-colors"
                  aria-label="Search"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </form>

            {/* Notification Bell & User Menu */}
            {user && <NotificationBell />}
            
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded-full hover:bg-secondary/50 transition-colors">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary/20 text-primary text-sm">
                        {user.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-sm text-muted-foreground truncate">
                    {user.email}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/watchlist" className="cursor-pointer">
                      <Bookmark className="w-4 h-4 mr-2" />
                      My Watchlist
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/requests" className="cursor-pointer">
                      <FileText className="w-4 h-4 mr-2" />
                      My Requests
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer">
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/auth"
                className="p-2 rounded-full hover:bg-secondary/50 transition-colors"
                aria-label="Sign in"
              >
                <User className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>

      </nav>

      {/* Sticky Back button on details pages - hidden on mobile */}
      {isDetailsPage && (
        <div className="hidden md:block fixed left-4 top-20 z-[60]">
          <button
            onClick={handleBack}
            className="p-2.5 rounded-full bg-background/90 backdrop-blur-md border border-border hover:bg-secondary/50 transition-colors flex items-center gap-2 shadow-lg"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      <div 
        className={cn(
          "md:hidden fixed inset-0 z-[100] transition-opacity duration-300",
          isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-background/80 backdrop-blur-md"
          onClick={() => setIsMenuOpen(false)}
        />

        {/* Menu Panel */}
        <div 
          className={cn(
            "absolute top-0 left-0 h-full w-72 bg-card/95 backdrop-blur-xl border-r border-border shadow-2xl transform transition-transform duration-300 ease-out",
            isMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2">
              <div className="w-8 h-8">
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
                  <defs>
                    <linearGradient id="logoGradientMenu" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="hsl(0, 84%, 65%)" />
                      <stop offset="100%" stopColor="hsl(0, 84%, 50%)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M25 15 C15 15 10 25 10 50 C10 75 15 85 25 85 L55 85 C75 85 90 70 90 50 C90 30 75 15 55 15 L40 15 L40 25 L55 25 C68 25 78 35 78 50 C78 65 68 75 55 75 L25 75 C22 75 22 70 22 50 C22 30 22 25 25 25 L25 15 Z M30 35 L30 65 L55 65 C60 65 65 60 65 50 C65 40 60 35 55 35 L30 35 Z"
                    fill="url(#logoGradientMenu)"
                  />
                </svg>
              </div>
              <span className="text-lg font-bold">
                Danie<span className="text-primary">Watch</span>
              </span>
            </Link>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="p-2 rounded-full hover:bg-secondary/50 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Menu Links */}
          <nav className="p-4">
            <ul className="space-y-1">
              {navLinks.map((link, index) => (
                <li 
                  key={link.to}
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    opacity: isMenuOpen ? 1 : 0,
                    transform: isMenuOpen ? 'translateX(0)' : 'translateX(-20px)',
                    transition: `opacity 0.3s ease ${index * 50}ms, transform 0.3s ease ${index * 50}ms`
                  }}
                >
                  <Link
                    to={link.to}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200",
                      location.pathname === link.to 
                        ? "bg-primary/15 text-primary" 
                        : "text-foreground/80 hover:bg-secondary/50 hover:text-foreground"
                    )}
                  >
                    <link.icon className={cn(
                      "w-5 h-5",
                      location.pathname === link.to && "text-primary"
                    )} />
                    <span className="font-medium">{link.label}</span>
                    {location.pathname === link.to && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Menu Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              © 2024 DanieWatch
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
