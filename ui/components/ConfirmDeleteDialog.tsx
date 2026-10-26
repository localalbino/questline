import { useEffect, useRef, useState, type ReactNode } from "react";

type ConfirmDeleteDialogProps = {
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  /** Resolves to an error message to show, or null once the delete succeeded. */
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
};

/** Modal asking the user to confirm a delete. Stays open with the error if the delete fails. */
export function ConfirmDeleteDialog({
  title,
  children,
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
  onConfirm,
  onClose,
}: ConfirmDeleteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    // Start on Cancel so a stray Enter doesn't delete anything.
    cancelRef.current?.focus();
  }, []);

  async function confirm() {
    setPending(true);
    setError(null);
    const message = await onConfirm().catch(() => "Something went wrong. Try again.");
    setPending(false);
    if (message) setError(message);
    else dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Don't let Escape close it mid-request; the outcome would be hidden.
      onCancel={(e) => pending && e.preventDefault()}
      // Clicks on the backdrop land on the dialog element itself.
      onClick={(e) => e.target === e.currentTarget && !pending && dialogRef.current?.close()}
      // Keep keys from reaching drag handlers on whatever opened the dialog.
      onKeyDown={(e) => e.stopPropagation()}
      className="text-foreground mx-auto mt-32 w-full max-w-sm bg-zinc-900 p-0 shadow-2xl ring-1 ring-zinc-800 backdrop:bg-black/70"
    >
      <div className="flex flex-col gap-3 p-4">
        <h2 className="text-lg">{title}</h2>
        {children && <div className="text-sm text-zinc-400">{children}</div>}
        {error && <span className="text-sm text-red-400">{error}</span>}
        <div className="mt-2 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={confirm}
            className="bg-red-500 px-3 py-1.5 text-sm text-black hover:bg-red-400 disabled:opacity-50"
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
