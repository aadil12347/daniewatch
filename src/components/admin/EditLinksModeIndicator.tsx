import { useAdminStatus } from "@/contexts/AdminStatusContext";
import { useEditLinksMode } from "@/contexts/EditLinksModeContext";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export function EditLinksModeIndicator() {
  const { isAdmin } = useAdminStatus();
  const { isEditLinksMode, setEditLinksMode } = useEditLinksMode();

  if (!isAdmin || !isEditLinksMode) return null;

  return (
    <div className="fixed left-4 bottom-4 z-50">
      <Button
        variant="secondary"
        size="sm"
        className="h-7 px-3 text-xs font-medium bg-destructive/90 hover:bg-destructive text-white border border-destructive shadow-lg"
        onClick={() => setEditLinksMode(false)}
      >
        <Pencil className="w-3 h-3 mr-1.5" />
        Exit Edit Mode
      </Button>
    </div>
  );
}
