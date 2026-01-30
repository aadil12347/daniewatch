import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditLinksMode } from "@/contexts/EditLinksModeContext";
import { useSectionCuration } from "@/hooks/useSectionCuration";
import { cn } from "@/lib/utils";

interface SectionCurationControlsProps {
  sectionId: string;
  sectionTitle: string;
  className?: string;
}

export function SectionCurationControls({ sectionId, sectionTitle, className }: SectionCurationControlsProps) {
  const { isEditLinksMode, openPicker } = useEditLinksMode();
  const { resetSection, hasCuration } = useSectionCuration(sectionId);

  if (!isEditLinksMode) return null;

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

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs gap-1 bg-primary/10 border-primary/30 hover:bg-primary/20"
        onClick={handleAdd}
      >
        <Plus className="w-3.5 h-3.5" />
        Add
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
