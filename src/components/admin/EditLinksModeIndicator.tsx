import { useAdminStatus } from "@/contexts/AdminStatusContext";
import { useEditLinksMode } from "@/contexts/EditLinksModeContext";
import { Button } from "@/components/ui/button";

export function EditLinksModeIndicator() {
  const { isAdmin } = useAdminStatus();
  const { isEditLinksMode, setEditLinksMode } = useEditLinksMode();

  if (!isAdmin || !isEditLinksMode) return null;

  return (
    <div className="fixed right-4 top-20 z-[90]">
      <div className="rounded-xl border border-border bg-background/95 backdrop-blur px-3 py-2 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-wide uppercase">Edit Links mode</div>
            <div className="text-xs text-muted-foreground">Ctrl + Shift + E</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setEditLinksMode(false)}>
            Turn off
          </Button>
        </div>
      </div>
    </div>
  );
}
