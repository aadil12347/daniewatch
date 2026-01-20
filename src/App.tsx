import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, type Location } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./contexts/AuthContext";
import { MediaProvider } from "./contexts/MediaContext";
import { TutorialProvider } from "./contexts/TutorialContext";
import { AdminContentVisibilityProvider } from "./contexts/AdminContentVisibilityContext";
import { SearchOverlayProvider } from "./contexts/SearchOverlayContext";
import { PageTransition } from "./components/PageTransition";
import { GlobalRouteLoader } from "./components/GlobalRouteLoader";
import { FloatingRequestButton } from "./components/FloatingRequestButton";
import { TutorialOverlay } from "./components/TutorialOverlay";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Navbar } from "@/components/Navbar";
import { MotionBlurCursor } from "@/components/MotionBlurCursor";
import { SearchOverlay } from "@/components/SearchOverlay";
import Index from "./pages/Index";
import MovieDetails from "./pages/MovieDetails";
import TVDetails from "./pages/TVDetails";
import MovieDetailsModal from "@/components/details/MovieDetailsModal";
import TVDetailsModal from "@/components/details/TVDetailsModal";
import Movies from "./pages/Movies";
import TVShows from "./pages/TVShows";
import Anime from "./pages/Anime";
import Korean from "./pages/Korean";
import Watchlist from "./pages/Watchlist";
import Search from "./pages/Search";
import Auth from "./pages/Auth";
import Requests from "./pages/Requests";
import AdminDashboard from "./pages/AdminDashboard";
import UpdateLinks from "./pages/UpdateLinks";
import NotFound from "./pages/NotFound";

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

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  const state = location.state as { backgroundLocation?: Location } | null;
  const backgroundLocation = state?.backgroundLocation;

  return (
    <>
      <PageTransition key={(backgroundLocation || location).pathname + (backgroundLocation || location).search}>
        <Routes location={backgroundLocation || location}>
          <Route path="/" element={<Index />} />
          <Route path="/movie/:id" element={<MovieDetails />} />
          <Route path="/tv/:id" element={<TVDetails />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/tv" element={<TVShows />} />
          <Route path="/anime" element={<Anime />} />
          <Route path="/korean" element={<Korean />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/search" element={<Search />} />
          <Route path="/search" element={<Search />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/update-links" element={<UpdateLinks />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PageTransition>

      {backgroundLocation && (
        <Routes>
          <Route path="/movie/:id" element={<MovieDetailsModal />} />
          <Route path="/tv/:id" element={<TVDetailsModal />} />
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

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TutorialProvider>
          <MediaProvider>
            <AdminContentVisibilityProvider>
              <SearchOverlayProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <MotionBlurCursor />
                  <BrowserRouter>
                    <ErrorBoundary>
                      <Navbar />
                      <SearchOverlay />
                      <GlobalRouteLoader />
                      <AppContent />
                      <FloatingRequestButton />
                      <TutorialOverlay />
                    </ErrorBoundary>
                  </BrowserRouter>
                </TooltipProvider>
              </SearchOverlayProvider>
            </AdminContentVisibilityProvider>
          </MediaProvider>
        </TutorialProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;

