import { useEffect, useState, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, type Location } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./contexts/AuthContext";
import { AdminStatusProvider } from "@/contexts/AdminStatusContext";
import { EditLinksModeProvider } from "@/contexts/EditLinksModeContext";
import { MediaProvider } from "./contexts/MediaContext";
import { TutorialProvider } from "./contexts/TutorialContext";
import { AdminContentVisibilityProvider } from "./contexts/AdminContentVisibilityContext";
import { SearchOverlayProvider } from "./contexts/SearchOverlayContext";
import { ContinueWatchingProvider } from "./hooks/useContinueWatching";
import { PageTransition } from "./components/PageTransition";
import { FloatingRequestButton } from "./components/FloatingRequestButton";
import { TutorialOverlay } from "./components/TutorialOverlay";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Navbar } from "@/components/Navbar";
import { SearchOverlay } from "@/components/SearchOverlay";
import { PerformanceModeProvider } from "@/contexts/PerformanceModeContext";
import { PerformanceModeSwitchOverlay } from "@/components/PerformanceModeSwitchOverlay";
import { InitialSplashOverlay, getShouldShowInitialSplash } from "@/components/InitialSplashOverlay";
import { EditLinksModeIndicator } from "@/components/admin/EditLinksModeIndicator";
import { EditLinksModal } from "@/components/admin/EditLinksModal";
import { InteractiveDotGrid } from "@/components/InteractiveDotGrid";

// Eager load critical pages (home, search)
import Index from "./pages/Index";
import Search from "./pages/Search";
import NotFound from "./pages/NotFound";

// Lazy load heavy pages for better initial bundle size
const MovieDetails = lazy(() => import("./pages/MovieDetails"));
const TVDetails = lazy(() => import("./pages/TVDetails"));
const MovieDetailsModal = lazy(() => import("@/components/details/MovieDetailsModal"));
const TVDetailsModal = lazy(() => import("@/components/details/TVDetailsModal"));
const Movies = lazy(() => import("./pages/Movies"));
const TVShows = lazy(() => import("./pages/TVShows"));
const Anime = lazy(() => import("./pages/Anime"));
const Korean = lazy(() => import("./pages/Korean"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Auth = lazy(() => import("./pages/Auth"));
const Requests = lazy(() => import("./pages/Requests"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Loading page">
    <div className="app-loader" aria-hidden="true">
      <div className="circle" />
      <div className="circle" />
      <div className="circle" />
      <div className="shadow" />
      <div className="shadow" />
      <div className="shadow" />
    </div>
    <span className="sr-only">Loading...</span>
  </div>
);

// Disable right-click context menu
const useDisableContextMenu = () => {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);
};

// Disable browser's default scroll restoration
const useManualScrollRestoration = () => {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "auto";
    }
  }, []);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const AnimatedRoutes = () => {
  const location = useLocation();
  const state = location.state as { backgroundLocation?: Location } | null;
  const backgroundLocation = state?.backgroundLocation;

  return (
    <>
      <PageTransition key={(backgroundLocation || location).pathname + (backgroundLocation || location).search}>
        <Routes location={backgroundLocation || location}>
          <Route path="/" element={<Index />} />
          <Route path="/movie/:id" element={<Suspense fallback={<PageLoader />}><MovieDetails /></Suspense>} />
          <Route path="/tv/:id" element={<Suspense fallback={<PageLoader />}><TVDetails /></Suspense>} />
          <Route path="/movies" element={<Suspense fallback={<PageLoader />}><Movies /></Suspense>} />
          <Route path="/tv" element={<Suspense fallback={<PageLoader />}><TVShows /></Suspense>} />
          <Route path="/anime" element={<Suspense fallback={<PageLoader />}><Anime /></Suspense>} />
          <Route path="/korean" element={<Suspense fallback={<PageLoader />}><Korean /></Suspense>} />
          <Route path="/watchlist" element={<Suspense fallback={<PageLoader />}><Watchlist /></Suspense>} />
          <Route path="/search" element={<Search />} />
          <Route path="/auth" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
          <Route path="/requests" element={<Suspense fallback={<PageLoader />}><Requests /></Suspense>} />
          <Route path="/admin" element={<Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </PageTransition>

      {backgroundLocation && (
        <Routes>
          <Route path="/movie/:id" element={<Suspense fallback={<PageLoader />}><MovieDetailsModal /></Suspense>} />
          <Route path="/tv/:id" element={<Suspense fallback={<PageLoader />}><TVDetailsModal /></Suspense>} />
        </Routes>
      )}
    </>
  );
};

const AppContent = () => {
  useDisableContextMenu();
  useManualScrollRestoration();
  return <AnimatedRoutes />;
};

const App = () => {
  const [splashActive, setSplashActive] = useState(() => getShouldShowInitialSplash());
  const [justExitedSplash, setJustExitedSplash] = useState(false);

  // Force English language and left-to-right direction on app mount
  useEffect(() => {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!justExitedSplash) {
      delete root.dataset.justExitedSplash;
      return;
    }

    root.dataset.justExitedSplash = "1";
    const t = window.setTimeout(() => setJustExitedSplash(false), 800);
    return () => window.clearTimeout(t);
  }, [justExitedSplash]);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AdminStatusProvider>
            <EditLinksModeProvider>
              <PerformanceModeProvider>
                <TutorialProvider>
                  <MediaProvider>
                    <ContinueWatchingProvider>
                      <AdminContentVisibilityProvider>
                        <SearchOverlayProvider>
                          <TooltipProvider>
                            <Toaster />
                            <Sonner />
                            <BrowserRouter>
                              <ErrorBoundary>
                                {splashActive ? (
                                  <InitialSplashOverlay
                                    onDone={() => {
                                      setSplashActive(false);
                                      setJustExitedSplash(true);
                                    }}
                                  />
                                ) : (
                                  <>
                                    <InteractiveDotGrid />
                                    <Navbar />
                                    <SearchOverlay />

                                    <PerformanceModeSwitchOverlay />
                                    <EditLinksModeIndicator />
                                    <EditLinksModal />

                                    <AppContent />
                                    <FloatingRequestButton />
                                    <TutorialOverlay />
                                  </>
                                )}
                              </ErrorBoundary>
                            </BrowserRouter>
                          </TooltipProvider>
                        </SearchOverlayProvider>
                      </AdminContentVisibilityProvider>
                    </ContinueWatchingProvider>
                  </MediaProvider>
                </TutorialProvider>
              </PerformanceModeProvider>
            </EditLinksModeProvider>
          </AdminStatusProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;

