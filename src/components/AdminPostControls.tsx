import { useMemo, useState } from 'react';
import { Ban, Link2, MoreVertical, ShieldOff } from 'lucide-react';
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
import { usePostModeration } from '@/hooks/usePostModeration';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'sonner';

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
  const { isBlocked, blockPost, unblockPost } = usePostModeration();

  const [linksOpen, setLinksOpen] = useState(false);

  if (!isAdmin) return null;

  const blocked = isBlocked(tmdbId, mediaType);

  const modalInitialId = useMemo(() => String(tmdbId), [tmdbId]);

  const handleBlock = () => {
    if (blocked) {
      unblockPost(tmdbId, mediaType);
      toast.success(`"${title || 'Post'}" unblocked`);
    } else {
      blockPost(tmdbId, mediaType, title, posterPath);
      toast.success(`"${title || 'Post'}" blocked`);
    }
  };

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

        <DropdownMenuContent onClick={(e) => e.stopPropagation()} className="z-50">
          {/* Quick Edit (in dropdown) */}
          <QuickEditLinksDropdown tmdbId={modalInitialId} mediaType={mediaType} />

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

          <DropdownMenuSeparator />

          {/* Block/Unblock */}
          <DropdownMenuItem onClick={handleBlock} className={blocked ? 'text-green-500' : 'text-destructive'}>
            {blocked ? (
              <>
                <ShieldOff className="w-4 h-4 mr-2" />
                Unblock Post
              </>
            ) : (
              <>
                <Ban className="w-4 h-4 mr-2" />
                Block Post
              </>
            )}
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

