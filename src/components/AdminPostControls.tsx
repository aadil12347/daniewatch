import { useNavigate } from 'react-router-dom';
import { Ban, MoreVertical, Link2, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
}

export const AdminPostControls = ({
  tmdbId,
  mediaType,
  title,
  posterPath,
  className = '',
}: AdminPostControlsProps) => {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const { isBlocked, blockPost, unblockPost } = usePostModeration();
  
  if (!isAdmin) return null;
  
  const blocked = isBlocked(tmdbId, mediaType);
  
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
