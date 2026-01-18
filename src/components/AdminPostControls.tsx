import { useMemo, useState } from 'react';
import { Link2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QuickEditLinksDropdown } from '@/components/admin/QuickEditLinksDropdown';
import { UpdateLinksPanel } from '@/components/admin/UpdateLinksPanel';
import { useAdmin } from '@/hooks/useAdmin';

interface AdminPostControlsProps {
  tmdbId: number | string;
  mediaType: 'movie' | 'tv';
  title?: string;
  posterPath?: string;
  className?: string;
}

export const AdminPostControls = ({
  tmdbId,
  mediaType,
  title,
  posterPath,
  className = '',
}: AdminPostControlsProps) => {
  const { isAdmin } = useAdmin();

  const [linksOpen, setLinksOpen] = useState(false);

  if (!isAdmin) return null;

  const modalInitialId = useMemo(() => String(tmdbId), [tmdbId]);

  return (
    <Dialog open={linksOpen} onOpenChange={setLinksOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={`w-8 h-8 bg-black/60 hover:bg-black/80 backdrop-blur-sm ${className}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            title="Admin controls"
          >
            <MoreVertical className="w-4 h-4 text-white" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          onPointerDownCapture={(e) => e.stopPropagation()}
          className="z-50 max-h-[80vh] overflow-auto overscroll-contain touch-pan-y"
        >
          {/* Quick Edit (in dropdown) */}
          <QuickEditLinksDropdown tmdbId={modalInitialId} mediaType={mediaType} title={title} posterPath={posterPath} />

          <DropdownMenuSeparator />

          {/* Full editor (modal) */}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setLinksOpen(true);
            }}
          >
            <Link2 className="w-4 h-4 mr-2" />
            Update Links (Full)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent
        className="max-w-6xl w-[95vw] h-[90vh] overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle>Update Links</DialogTitle>
        </DialogHeader>
        <div className="h-[calc(90vh-56px)] overflow-y-auto p-4">
          <UpdateLinksPanel embedded initialTmdbId={modalInitialId} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

