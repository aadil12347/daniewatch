import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, Menu, X, Film, Tv, Home, Sparkles, Bookmark, ArrowLeft, Heart, User, LogOut, FileText, Shield, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { AnimatedBackButton } from "@/components/AnimatedBackButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export const Navbar = () => {
  const setHoverSwipeVars = (e: ReactMouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--hs-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--hs-y", `${e.clientY - rect.top}px`);
  };
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const isMobile = useIsMobile();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, _setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement | null>(null);
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

      // Only hide/show header on scroll for desktop
      // Mobile: header is ALWAYS visible
      if (!isMobile) {
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          setIsHidden(true);
        } else {
          setIsHidden(false);
        }
      } else {
        setIsHidden(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY, isMobile]);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Expose header height as a CSS var so global loaders can start below it.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const update = () => {
      document.documentElement.style.setProperty("--app-header-offset", `${el.offsetHeight}px`);
    };

    update();

    // Some environments may not support ResizeObserver; avoid crashing the app.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    }

    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

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
    if (location.pathname === "/indian" || getUrlParam("category") === "indian") {
      return "/indian";
    }
    return null;
  };

  const getCategoryParam = () => {
    const originalPath = getOriginalPath();
    if (originalPath === "/anime") return "&category=anime";
    if (originalPath === "/korean") return "&category=korean";
    if (originalPath === "/indian") return "&category=indian";
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

  // Desktop navigation links - no Home
  const navLinks = [
    { to: "/movies", label: "Movies", icon: Film },
    { to: "/tv", label: "TV Shows", icon: Tv },
    { to: "/indian", label: "Indian", icon: Globe },
    { to: "/anime", label: "Anime", icon: Sparkles },
    { to: "/korean", label: "Korean", icon: Heart },
    { to: "/watchlist", label: "Watch List", icon: Bookmark },
  ];

  // Mobile menu links - includes Home at the start
  const mobileNavLinks = [
    { to: "/", label: "Home", icon: Home },
    ...navLinks,
    ...(user && !isAdmin ? [{ to: "/requests", label: "My Requests", icon: FileText }] : []),
    ...(user && isAdmin ? [{ to: "/admin", label: "Admin Panel", icon: Shield }] : []),
  ];

  return (
    <>
      <nav
        ref={navRef}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-[background-color,padding,transform,opacity] duration-300 ease-out will-change-[transform,opacity]",
          isScrolled ? "glass py-3" : "bg-gradient-to-b from-background/80 to-transparent py-4",
          isHidden ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        )}
      >
        {/* Bottom glow effect */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute bottom-0 left-1/4 right-1/4 h-8 bg-gradient-to-t from-primary/10 to-transparent blur-xl pointer-events-none" />
        
        <div className="container mx-auto px-4 flex items-center justify-between relative">
          {/* Left side: Menu toggle + Logo for mobile */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-full hover:bg-secondary/50 transition-colors"
              aria-label="Toggle menu"
              data-tutorial="mobile-menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Logo - Always visible on left */}
            <Link 
              to="/" 
              className={cn(
                "flex items-center gap-2 group transition-all duration-300",
                isSearchOpen && "md:flex hidden"
              )}
            >
              <div className="relative w-8 h-8 md:w-10 md:h-10 flex items-center justify-center transition-all duration-500 group-hover:scale-110">
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
              <span className="text-base md:text-xl font-bold tracking-tight">
                Danie<span className="text-primary">Watch</span>
              </span>
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <div
            className="hidden md:flex items-center gap-3 absolute left-1/2 -translate-x-1/2"
            data-tutorial="navigation"
          >
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onMouseMove={setHoverSwipeVars}
                  className={cn(
                    "hover-swipe rounded-full px-3 py-2 flex items-center gap-2 transition-colors duration-300",
                    isActive
                      ? "bg-primary/15 text-foreground"
                      : "text-foreground/70 hover:text-primary-foreground"
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
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
                  data-tutorial="search"
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
                  {!isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/requests" className="cursor-pointer">
                        <FileText className="w-4 h-4 mr-2" />
                        My Requests
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer">
                        <Shield className="w-4 h-4 mr-2" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
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
          <AnimatedBackButton label="Back" size="navbar" />
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
            "absolute top-0 left-0 h-full w-72 bg-card/95 backdrop-blur-xl border-r border-border shadow-2xl transform transition-transform duration-300 ease-out will-change-transform",
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

          <nav className="p-4">
            <ul className="space-y-1">
              {mobileNavLinks.map((link, index) => (
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
