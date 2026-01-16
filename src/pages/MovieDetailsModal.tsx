import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import MovieDetails from "@/pages/MovieDetails";

const MovieDetailsModal = () => {
  const navigate = useNavigate();

  return (
    <Dialog open onOpenChange={(open) => !open && navigate(-1)}>
      <DialogContent className="w-screen h-screen max-w-none p-0 border-0 rounded-none overflow-y-auto bg-background">
        <MovieDetails />
      </DialogContent>
    </Dialog>
  );
};

export default MovieDetailsModal;
