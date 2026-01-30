import { useAdminStatus } from "@/contexts/AdminStatusContext";
import { useEditLinksMode } from "@/contexts/EditLinksModeContext";
import { Button } from "@/components/ui/button";
import { PostSearchPicker } from "./PostSearchPicker";

export function EditLinksModeIndicator() {
  const { isAdmin } = useAdminStatus();
  const { isEditLinksMode, setEditLinksMode } = useEditLinksMode();

  if (!isAdmin || !isEditLinksMode) return null;

  return (
    <>
      <div className="fixed right-6 bottom-6 z-50">
        <div className="rounded-full border border-primary/50 bg-background/95 backdrop-blur px-4 py-3 shadow-lg ring-2 ring-primary/20">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold tracking-wide uppercase text-primary">Edit Mode</div>
              <div className="text-[10px] text-muted-foreground hidden sm:block">Ctrl+Shift+E</div>
            </div>
            <Button variant="secondary" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditLinksMode(false)}>
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
