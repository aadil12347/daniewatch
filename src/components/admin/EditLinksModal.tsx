import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UpdateLinksPanel } from "@/components/admin/UpdateLinksPanel";
import { useAdminStatus } from "@/contexts/AdminStatusContext";
import { useEditLinksMode } from "@/contexts/EditLinksModeContext";

export function EditLinksModal() {
  const { isAdmin } = useAdminStatus();
  const { isEditorOpen, closeEditor, editorTmdbId } = useEditLinksMode();

  if (!isAdmin) return null;

  return (
    <Dialog open={isEditorOpen} onOpenChange={(open) => (!open ? closeEditor() : undefined)}>
      <DialogContent
        contentVariant="fullscreenBelowHeader"
        className="p-0 max-h-[calc(100vh-80px)] overflow-hidden flex flex-col"
        overlayClassName="bg-black/80 backdrop-blur-sm"
      >
        <div className="overflow-y-auto flex-1 p-3 sm:p-4">
          <UpdateLinksPanel embedded initialTmdbId={editorTmdbId ?? undefined} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
