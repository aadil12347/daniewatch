import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquarePlus } from "lucide-react";

import TVDetails from "@/pages/TVDetails";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AnimatedBackButton } from "@/components/AnimatedBackButton";
import { Button } from "@/components/ui/button";
import { useMedia } from "@/contexts/MediaContext";
import { RequestHelpSheet } from "@/components/RequestHelpSheet";

export default function TVDetailsModal() {
  const navigate = useNavigate();
  const { currentMedia } = useMedia();
  const [requestOpen, setRequestOpen] = useState(false);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) navigate(-1);
      }}
    >
      <DialogContent
        hideClose
        contentVariant="fullscreenBelowHeader"
        className="p-0 sm:rounded-none overflow-hidden gap-0 border-0 grid-rows-[1fr]"
      >
        <div className="h-full bg-background relative">
          <div className="absolute left-3 top-3 z-20 hidden md:block">
            <AnimatedBackButton label="Back" size="navbar" />
          </div>

          {/* Match the page's floating Request button placement */}
          <Button
            size="icon"
            onClick={() => setRequestOpen(true)}
            disabled={!currentMedia}
            aria-label="Request this title"
            title={!currentMedia ? "Loading title…" : "Request"}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 hover:scale-110 animate-pulse-glow"
          >
            <MessageSquarePlus className="w-6 h-6" />
          </Button>

          <RequestHelpSheet
            open={requestOpen}
            onOpenChange={setRequestOpen}
            modal={false}
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

          <div className="h-full overflow-y-auto overscroll-contain">
            <TVDetails modal />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

