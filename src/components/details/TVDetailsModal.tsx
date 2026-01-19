import { useNavigate } from "react-router-dom";

import TVDetails from "@/pages/TVDetails";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AnimatedBackButton } from "@/components/AnimatedBackButton";

export default function TVDetailsModal() {
  const navigate = useNavigate();

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
        <div className="h-full flex flex-col bg-background">
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3">
            <AnimatedBackButton label="Back" size="navbar" />
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <TVDetails modal />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
