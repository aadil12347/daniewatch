import { useNavigate } from "react-router-dom";

import MovieDetails from "@/pages/MovieDetails";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function MovieDetailsModal() {
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
        className="w-screen h-[100dvh] max-w-none p-0 sm:rounded-none overflow-hidden gap-0 border-0 grid-rows-[1fr]"
      >
        <div className="h-full overflow-y-auto overscroll-contain bg-background">
          <MovieDetails modal />
        </div>
      </DialogContent>
    </Dialog>
  );
}
