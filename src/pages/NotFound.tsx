import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useRouteContentReady(true);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="dw-404-shell relative">
      <div className="dw-404-bg" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[calc(100vh-var(--app-header-offset))] max-w-5xl flex-col items-center justify-center px-4 pt-[calc(var(--app-header-offset)+2rem)] pb-16 text-center">
        <header className="mb-8">
          <h1 className="text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Scene not found
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
            The link you followed doesn’t exist anymore—or it never did. Let’s get you back to the main feature.
          </p>
        </header>

        <section className="dw-404-container" aria-label="404">
          <span className="dw-404-digit dw-404-four">
            <span className="dw-sr-only">4</span>
          </span>
          <span className="dw-404-digit dw-404-zero">
            <span className="dw-sr-only">0</span>
          </span>
          <span className="dw-404-digit dw-404-four">
            <span className="dw-sr-only">4</span>
          </span>
        </section>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/">Back to Home</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/movies">Browse Movies</Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
