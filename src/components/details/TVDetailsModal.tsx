import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import TVDetails from "@/pages/TVDetails";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AnimatedBackButton } from "@/components/AnimatedBackButton";
import { finishPosterExpandTransition } from "@/lib/posterExpandTransition";

export default function TVDetailsModal() {
  const navigate = useNavigate();

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => finishPosterExpandTransition());
    });
    return () => cancelAnimationFrame(raf);
  }, []);

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
          <div className="absolute left-3 top-3 z-20">
            <AnimatedBackButton label="Back" size="navbar" />
          </div>

          <div className="h-full overflow-y-auto overscroll-contain">
            <TVDetails modal />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
