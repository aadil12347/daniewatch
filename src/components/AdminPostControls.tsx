import { useEffect, useRef, useState } from 'react';
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
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // If quick menu is open and user clicks anywhere else, close the menu and
  // swallow that click so it doesn't trigger the underlying post click.
  useEffect(() => {
    if (!quickMenuOpen) return;

    const onWindowClickCapture = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      if (triggerRef.current?.contains(target)) return;
      if (contentRef.current?.contains(target)) return;

      e.preventDefault();
      e.stopPropagation();
      (e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
      setQuickMenuOpen(false);
    };

    window.addEventListener('click', onWindowClickCapture, true);
    return () => window.removeEventListener('click', onWindowClickCapture, true);
  }, [quickMenuOpen]);

  const modalInitialId = String(tmdbId);

  if (!isAdmin) return null;

  return (
    <Dialog open={linksOpen} onOpenChange={setLinksOpen}>
      {/* modal={false} keeps the page scrollable while the menu is open */}
      <DropdownMenu modal={false} open={quickMenuOpen} onOpenChange={setQuickMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
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

        <DropdownMenuContent ref={contentRef} className="z-50 touch-pan-y">
          {/* Quick Edit (in dropdown) */}
          <QuickEditLinksDropdown tmdbId={modalInitialId} mediaType={mediaType} />

          <DropdownMenuSeparator />

          {/* Full editor (modal) */}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setQuickMenuOpen(false);
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

