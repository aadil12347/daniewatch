import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2, Film, AlertCircle, ArrowLeft, ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveMovieSitePost, type ResolvedPostInfo } from "@/lib/movieSiteScraper";
import { markExternalAllowed } from "@/lib/contentVisibility";

export default function PostDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const postUrl = searchParams.get("url") || "";
  const initialTitle = searchParams.get("title") || "Loading Title...";
  const initialPoster = searchParams.get("poster") || "";
  const site = searchParams.get("site") || "vegamovies";

  const [status, setStatus] = useState<string>("Extracting IMDb code from post...");
  const [resolvedInfo, setResolvedInfo] = useState<ResolvedPostInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(true);

  useEffect(() => {
    if (!postUrl) {
      setError("No post URL provided.");
      setIsResolving(false);
      return;
    }

    let isMounted = true;

    async function executeResolution() {
      try {
        setIsResolving(true);
        setStatus("Extracting IMDb code from post...");

        const info = await resolveMovieSitePost(postUrl, initialTitle);

        if (!isMounted) return;

        setResolvedInfo(info);
        setStatus(`Found TMDB ${info.mediaType.toUpperCase()} #${info.tmdbId}. Loading details...`);
        markExternalAllowed(info.tmdbId);

        // Seamless transition to TMDB movie/TV details page
        setTimeout(() => {
          if (!isMounted) return;
          navigate(`/${info.mediaType}/${info.tmdbId}`, { replace: true });
        }, 500);
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Resolution failed:", err);
        setError("Failed to extract IMDb/TMDB data from this post. You can try again or visit source.");
      } finally {
        if (isMounted) {
          setIsResolving(false);
        }
      }
    }

    executeResolution();

    return () => {
      isMounted = false;
    };
  }, [postUrl, initialTitle, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <Helmet>
        <title>{initialTitle} - DanieWatch</title>
      </Helmet>

      {/* Top Bar */}
      <div className="container mx-auto px-4 py-4 flex items-center justify-between border-b border-border/40">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
              site === "vegamovies"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-red-500/20 text-red-400 border border-red-500/30"
            }`}
          >
            {site === "vegamovies" ? "VegaMovies" : "RogMovies"}
          </span>
        </div>
      </div>

      {/* Content Container */}
      <div className="container mx-auto px-4 py-12 max-w-2xl flex flex-col items-center text-center">
        {/* Poster Thumbnail */}
        {initialPoster ? (
          <div className="relative group w-48 h-72 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-border/50 mb-6 bg-secondary/30">
            <img
              src={initialPoster}
              alt={initialTitle}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          </div>
        ) : (
          <div className="w-48 h-72 rounded-2xl bg-secondary/40 flex items-center justify-center mb-6 ring-1 ring-border">
            <Film className="w-12 h-12 text-muted-foreground" />
          </div>
        )}

        {/* Title */}
        <h1 className="text-xl md:text-2xl font-bold tracking-tight mb-4 px-2 leading-relaxed">
          {initialTitle}
        </h1>

        {/* Loading / Status Box */}
        {isResolving ? (
          <div className="w-full max-w-md p-4 rounded-xl bg-secondary/30 border border-border/50 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>
        ) : error ? (
          <div className="w-full max-w-md p-4 rounded-xl bg-destructive/15 border border-destructive/30 flex flex-col items-center gap-3">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <div className="flex gap-3 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
              {postUrl && (
                <a
                  href={postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline px-3 py-2"
                >
                  Open Original Link
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        ) : resolvedInfo ? (
          <div className="w-full max-w-md p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-primary">
              Resolved: {resolvedInfo.title}
            </p>
            <Button
              className="gap-2"
              onClick={() =>
                navigate(`/${resolvedInfo.mediaType}/${resolvedInfo.tmdbId}`)
              }
            >
              <Play className="w-4 h-4 fill-current" />
              Open Title
            </Button>
          </div>
        ) : null}
      </div>

      <div className="py-6 text-center text-xs text-muted-foreground/60 border-t border-border/20">
        DanieWatch Multi-Site Content Engine
      </div>
    </div>
  );
}
