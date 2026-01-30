import { Plus, RotateCcw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEditLinksMode } from "@/contexts/EditLinksModeContext";
import { useAdminStatus } from "@/contexts/AdminStatusContext";
import { useSectionCuration } from "@/hooks/useSectionCuration";
import { cn } from "@/lib/utils";

interface SectionCurationControlsProps {
  sectionId: string;
  sectionTitle: string;
  className?: string;
}

export function SectionCurationControls({ sectionId, sectionTitle, className }: SectionCurationControlsProps) {
  const { isAdmin } = useAdminStatus();
  const { isEditLinksMode, openPicker } = useEditLinksMode();
  const { resetSection, hasCuration, curatedItems } = useSectionCuration(sectionId);

  if (!isAdmin || !isEditLinksMode) return null;

  const handleAdd = () => {
    openPicker(sectionId, sectionTitle);
  };

  const handleReset = async () => {
    if (!hasCuration) return;
    const confirmed = window.confirm(`Reset "${sectionTitle}" to default order? This will remove all pinned and added items.`);
    if (confirmed) {
      await resetSection();
    }
  };

  const pinnedCount = curatedItems.filter((c) => c.isPinned).length;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Curation Mode Badge */}
      <Badge 
        variant="default" 
        className="gap-1.5 px-3 py-1 bg-primary/20 text-primary border border-primary/40 animate-pulse"
      >
        <Layers className="w-3.5 h-3.5" />
        <span className="text-xs font-semibold">Curation Mode</span>
        {hasCuration && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
            {curatedItems.length}
          </span>
        )}
      </Badge>

      {pinnedCount > 0 && (
        <Badge variant="secondary" className="text-[10px] px-2 py-1">
          📌 {pinnedCount} pinned
        </Badge>
      )}

      <Button
        variant="outline"
        size="sm"
        className="h-7 px-3 text-xs gap-1.5 bg-primary/10 border-primary/40 hover:bg-primary/20 hover:border-primary font-medium"
        onClick={handleAdd}
      >
        <Plus className="w-3.5 h-3.5" />
        Add
      </Button>
      
      {hasCuration && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 text-xs gap-1.5 bg-muted/50 hover:bg-destructive/20 hover:border-destructive/50 font-medium"
          onClick={handleReset}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </Button>
      )}
    </div>
  );
}
