import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

const Watchlist = () => {
  const { user } = useAuth();
  const { getWatchlistAsMovies, loading } = useWatchlist();
  const watchlistMovies = getWatchlistAsMovies();

  return (
    <>
      <Helmet>
        <title>Watch List - Cineby</title>
        <meta name="description" content="Your personal watchlist of movies and TV shows" />
      </Helmet>

      <Navbar />

      <main className="min-h-screen pt-20 pb-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">My Watch List</h1>

          {!user ? (
            // Not logged in state
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                <LogIn className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Sign in to view your watchlist</h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Create an account or sign in to save movies and TV shows to your personal watchlist.
              </p>
              <Button asChild className="gradient-red">
                <Link to="/auth">Sign In</Link>
              </Button>
            </div>
          ) : loading ? (
            // Loading state
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading your watchlist...</p>
            </div>
          ) : watchlistMovies.length === 0 ? (
            // Empty watchlist state
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                <Bookmark className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Your watchlist is empty</h2>
              <p className="text-muted-foreground max-w-md">
                Start adding movies and TV shows to your watchlist by clicking the bookmark icon on any title.
              </p>
            </div>
          ) : (
            // Watchlist grid
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {watchlistMovies.map((item) => (
                <MovieCard key={`${item.media_type}-${item.id}`} movie={item} size="md" />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
};

export default Watchlist;
