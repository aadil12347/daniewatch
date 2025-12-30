import { Cast, getProfileUrl } from "@/lib/tmdb";
import { User } from "lucide-react";

interface ActorCardProps {
  actor: Cast;
}

export const ActorCard = ({ actor }: ActorCardProps) => {
  const profileUrl = getProfileUrl(actor.profile_path);

  return (
    <div className="flex-shrink-0 w-28 sm:w-32 text-center group">
      <div className="relative aspect-square rounded-lg overflow-hidden bg-card mx-auto mb-3 border-2 border-transparent group-hover:border-primary transition-colors">
        {profileUrl ? (
          <img
            src={profileUrl}
            alt={actor.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <h4 className="font-medium text-sm line-clamp-2">{actor.name}</h4>
      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
        {actor.character}
      </p>
    </div>
  );
};
