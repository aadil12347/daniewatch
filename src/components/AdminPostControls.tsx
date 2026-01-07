import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Pin, PinOff, MoreVertical, Link2, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { usePostModeration } from '@/hooks/usePostModeration';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'sonner';

interface AdminPostControlsProps {
  tmdbId: number | string;
  mediaType: 'movie' | 'tv';
  title?: string;
  posterPath?: string;
  className?: string;
  showPinOption?: boolean;
}

const PIN_PAGES = [
  { value: 'movies', label: 'Movies' },
  { value: 'tvshows', label: 'TV Shows' },
  { value: 'anime', label: 'Anime' },
  { value: 'indian', label: 'Indian' },
  { value: 'korean', label: 'Korean' },
];

export const AdminPostControls = ({
  tmdbId,
  mediaType,
  title,
  posterPath,
  className = '',
  showPinOption = true,
}: AdminPostControlsProps) => {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const { isBlocked, isPinned, getPinnedPage, blockPost, unblockPost, pinPost, unpinPost } = usePostModeration();
  
  if (!isAdmin) return null;
  
  const blocked = isBlocked(tmdbId, mediaType);
  const pinned = isPinned(tmdbId, mediaType);
  const pinnedPage = getPinnedPage(tmdbId, mediaType);
  
  const handleUpdateLinks = () => {
    navigate(`/admin/update-links?id=${tmdbId}`);
  };
  
  const handleBlock = () => {
    if (blocked) {
      unblockPost(tmdbId, mediaType);
      toast.success(`"${title || 'Post'}" unblocked`);
    } else {
      blockPost(tmdbId, mediaType, title, posterPath);
      toast.success(`"${title || 'Post'}" blocked`);
    }
  };
  
  const handlePin = (page: string) => {
    if (pinned && pinnedPage === page) {
      unpinPost(tmdbId, mediaType);
      toast.success(`"${title || 'Post'}" unpinned`);
    } else {
      pinPost(tmdbId, mediaType, page, title, posterPath);
      toast.success(`"${title || 'Post'}" pinned to ${page}`);
    }
  };
  
  const handleUnpin = () => {
    unpinPost(tmdbId, mediaType);
    toast.success(`"${title || 'Post'}" unpinned`);
  };
  
  return (
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
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        {/* Update Links */}
        <DropdownMenuItem onClick={handleUpdateLinks}>
          <Link2 className="w-4 h-4 mr-2" />
          Update Links
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Pin to page - only show if showPinOption is true (not on homepage) */}
        {showPinOption && (
          <>
            {pinned && (
              <DropdownMenuItem onClick={handleUnpin}>
                <PinOff className="w-4 h-4 mr-2" />
                Unpin from {pinnedPage}
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Pin className="w-4 h-4 mr-2" />
                Pin to page
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {PIN_PAGES.map((page) => (
                  <DropdownMenuItem 
                    key={page.value} 
                    onClick={() => handlePin(page.value)}
                    className={pinnedPage === page.value ? 'bg-primary/20' : ''}
                  >
                    {page.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            <DropdownMenuSeparator />
          </>
        )}
        
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
  );
};
