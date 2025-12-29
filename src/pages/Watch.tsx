import { forwardRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import CustomVideoPlayer from "@/components/CustomVideoPlayer";

const Watch = forwardRef<HTMLDivElement>((_, ref) => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const season = Number(searchParams.get("season")) || 1;
  const episode = Number(searchParams.get("episode")) || 1;
  const title = searchParams.get("title") || "";

  const handleBack = () => {
    navigate(-1);
  };

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
        <title>{title ? `${title} - Now Playing` : "Now Playing"} - DanieWatch</title>
      </Helmet>

      <div
        ref={ref}
        className="fixed inset-0 w-screen h-screen bg-black z-[9999]"
        style={{ position: 'fixed', width: '100vw', height: '100vh', top: 0, left: 0 }}
      >
        <CustomVideoPlayer
          embedUrl={getEmbedUrl()}
          title={title || undefined}
          onBack={handleBack}
          onClose={handleBack}
        />
      </div>
    </>
  );
});

Watch.displayName = "Watch";

export default Watch;
