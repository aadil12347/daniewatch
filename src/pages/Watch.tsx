import { useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet-async";

const Watch = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const season = Number(searchParams.get("season")) || 1;
  const episode = Number(searchParams.get("episode")) || 1;

  const handleBack = () => {
    navigate(-1);
  };

  // Escape key to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleBack();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Build the VidKing embed URL
  const getEmbedUrl = () => {
    const baseUrl = "https://www.vidking.net/embed";
    const params = new URLSearchParams({
      color: "dc2626",
      autoPlay: "true",
    });

    if (type === "movie") {
      return `${baseUrl}/movie/${id}?${params.toString()}`;
    } else {
      params.append("nextEpisode", "true");
      params.append("episodeSelector", "true");
      return `${baseUrl}/tv/${id}/${season}/${episode}?${params.toString()}`;
    }
  };


  return (
    <>
      <Helmet>
        <title>Now Playing - DanieWatch</title>
      </Helmet>

      <div
        className="fixed inset-0 w-screen h-screen bg-black z-[9999]"
        style={{ position: 'fixed', width: '100vw', height: '100vh', top: 0, left: 0 }}
      >
        {/* Back button - Top left */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 z-[10000] w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white"
          onClick={handleBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Close button - Top right */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-[10000] w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white"
          onClick={handleBack}
        >
          <X className="w-5 h-5" />
        </Button>

        {/* Video iframe - True full screen */}
        <iframe
          src={getEmbedUrl()}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        />
      </div>
    </>
  );
};

export default Watch;
