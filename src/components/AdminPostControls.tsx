import { useState } from 'react';
import { Ban, Pin, PinOff, Shield, ShieldOff } from 'lucide-react';
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
  variant?: 'icon' | 'dropdown';
  className?: string;
}

const PIN_PAGES = [
  { value: 'home', label: 'Home' },
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
  variant = 'dropdown',
  className = '',
}: AdminPostControlsProps) => {
  const { isAdmin } = useAdmin();
  const { isBlocked, isPinned, getPinnedPage, blockPost, unblockPost, pinPost, unpinPost } = usePostModeration();
  
  if (!isAdmin) return null;
  
  const blocked = isBlocked(tmdbId, mediaType);
  const pinned = isPinned(tmdbId, mediaType);
  const pinnedPage = getPinnedPage(tmdbId, mediaType);
  
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
  
  if (variant === 'icon') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Button
          size="icon"
          variant={blocked ? "destructive" : "ghost"}
          className="w-8 h-8"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleBlock();
          }}
          title={blocked ? 'Unblock post' : 'Block post'}
        >
          {blocked ? <ShieldOff className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant={pinned ? "default" : "ghost"}
              className="w-8 h-8"
              onClick={(e) => e.stopPropagation()}
              title={pinned ? `Pinned to ${pinnedPage}` : 'Pin post'}
            >
              {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
            {pinned && (
              <>
                <DropdownMenuItem onClick={handleUnpin}>
                  <PinOff className="w-4 h-4 mr-2" />
                  Unpin
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {PIN_PAGES.map((page) => (
              <DropdownMenuItem 
                key={page.value} 
                onClick={() => handlePin(page.value)}
                className={pinnedPage === page.value ? 'bg-primary/20' : ''}
              >
                <Pin className="w-4 h-4 mr-2" />
                Pin to {page.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={`w-8 h-8 ${blocked ? 'text-destructive' : ''} ${pinned ? 'text-primary' : ''} ${className}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          title="Admin controls"
        >
          <Shield className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={handleBlock}>
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
        
        <DropdownMenuSeparator />
        
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
