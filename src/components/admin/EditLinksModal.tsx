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
        className="p-0 overflow-y-auto"
        overlayClassName="bg-black/70"
      >
        <div className="p-4 sm:p-6">
          <UpdateLinksPanel embedded initialTmdbId={editorTmdbId ?? undefined} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
