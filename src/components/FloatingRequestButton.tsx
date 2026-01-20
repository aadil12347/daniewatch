import React from "react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMedia } from "@/contexts/MediaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { cn } from "@/lib/utils";
import { RequestHelpSheet } from "@/components/RequestHelpSheet";

export const FloatingRequestButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentMedia, isVideoPlaying } = useMedia();
  const { user } = useAuth();
  const { isAdmin, isOwner } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as { backgroundLocation?: unknown } | null;
  const isDetailsModalOpen = Boolean(state?.backgroundLocation);

  // Hide for admin/owner, when video is playing, or when a details modal is open
  // (details modals render their own in-modal Request button to avoid nested-dialog issues)
  if (isAdmin || isOwner || isVideoPlaying || isDetailsModalOpen) return null;

  const handleButtonClick = () => {
    if (!user) {
      // Redirect non-authenticated users to signup
      navigate("/auth");
      return;
    }
    setIsOpen(true);
  };

  return (
    <>
      <Button
        size="icon"
        onClick={handleButtonClick}
        data-tutorial="request"
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          "transition-all duration-300 hover:scale-110",
          "animate-pulse-glow",
        )}
      >
        <MessageSquarePlus className="w-6 h-6" />
      </Button>

      <RequestHelpSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        defaults={
          currentMedia
            ? {
                title: currentMedia.title,
                type: currentMedia.type,
                tmdbId: currentMedia.tmdbId,
                seasonNumber: currentMedia.seasonNumber,
              }
            : undefined
        }
      />
    </>
  );
};

