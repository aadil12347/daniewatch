import { useAdminStatus } from "@/contexts/AdminStatusContext";
import { useEditLinksMode } from "@/contexts/EditLinksModeContext";
import { Button } from "@/components/ui/button";
import { PostSearchPicker } from "./PostSearchPicker";
import { Layers, Pencil } from "lucide-react";

export function EditLinksModeIndicator() {
  const { isAdmin } = useAdminStatus();
  const { isEditLinksMode, setEditLinksMode } = useEditLinksMode();

  if (!isAdmin || !isEditLinksMode) return null;

  return (
    <>
      <div className="fixed right-6 bottom-6 z-50">
        <div className="rounded-2xl border-2 border-primary/60 bg-background/95 backdrop-blur-md px-5 py-4 shadow-2xl ring-4 ring-primary/20 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-4">
            {/* Animated icon */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
              <div className="relative p-2 rounded-full bg-primary text-primary-foreground">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-bold tracking-wide uppercase text-primary">Edit Mode</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                <span className="hidden sm:inline">Ctrl+Shift+E to exit • </span>
                Drag to reorder • Click cards to edit
              </div>
            </div>
            
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 px-4 text-xs font-semibold hover:bg-destructive/20 hover:text-destructive transition-colors" 
              onClick={() => setEditLinksMode(false)}
            >
              Exit
            </Button>
          </div>
        </div>
      </div>
      
      {/* Post Search Picker Modal */}
      <PostSearchPicker />
    </>
  );
}
