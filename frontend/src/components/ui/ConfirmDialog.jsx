import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

/**
 * ConfirmDialog — reusable confirmation dialog for destructive actions.
 * Usage:
 *   <ConfirmDialog
 *     trigger={<button>Delete</button>}
 *     title="Are you sure?"
 *     description="This cannot be undone."
 *     confirmLabel="Delete"
 *     onConfirm={async () => { await deleteItem(); }}
 *   />
 */
export function ConfirmDialog({
  trigger,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmLabel = "Delete",
  variant = "danger",  // "danger" | "primary"
}) {
  const [busy, setBusy] = useState(false);
  const actionCls = variant === "danger"
    ? "bg-red-600 hover:bg-red-700 text-white"
    : "bg-ayana-primary hover:bg-ayana-primary-hover text-white";

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="confirm-cancel" disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="confirm-action"
            disabled={busy}
            className={actionCls}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try { await onConfirm(); } finally { setBusy(false); }
            }}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
