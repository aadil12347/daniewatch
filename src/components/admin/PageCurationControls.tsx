import { Plus, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditLinksMode } from "@/contexts/EditLinksModeContext";
import { useAdminStatus } from "@/contexts/AdminStatusContext";
import { useSectionCuration } from "@/hooks/useSectionCuration";
import { cn } from "@/lib/utils";

interface PageCurationControlsProps {
  sectionId: string;
  sectionTitle: string;
  className?: string;
}

export function PageCurationControls({ sectionId, sectionTitle, className }: PageCurationControlsProps) {
  const { isAdmin } = useAdminStatus();
  const { isEditLinksMode, openPicker } = useEditLinksMode();
  const { resetSection, hasCuration, curatedItems } = useSectionCuration(sectionId);

  if (!isAdmin || !isEditLinksMode) return null;

  const handleAdd = () => {
    openPicker(sectionId, sectionTitle);
  };

  const handleReset = async () => {
    if (!hasCuration) return;
    const confirmed = window.confirm(`Reset "${sectionTitle}" curation? This will remove all pinned and added items.`);
    if (confirmed) {
      await resetSection();
    }
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/30">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-primary">
          Curation Mode
          {curatedItems.length > 0 && (
            <span className="ml-1 opacity-75">({curatedItems.length} items)</span>
          )}
        </span>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs gap-1 bg-primary/10 border-primary/30 hover:bg-primary/20"
        onClick={handleAdd}
      >
        <Plus className="w-3.5 h-3.5" />
        Add to Page
      </Button>
      
      {hasCuration && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs gap-1 bg-muted/50 hover:bg-destructive/20 hover:border-destructive/50"
          onClick={handleReset}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </Button>
      )}
    </div>
  );
}
