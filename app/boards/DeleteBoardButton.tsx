"use client";

import { ConfirmDeleteDialog } from "@/ui/components/ConfirmDeleteDialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteBoardAction } from "./actions";

/** Sits over the corner of a board tile, outside its link, and confirms before deleting. */
export function DeleteBoardButton({ boardId, title, games }: { boardId: number; title: string; games: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function deleteBoard(): Promise<string | null> {
    const result = await deleteBoardAction({ boardId });
    if (!result.success) return result.error;
    router.refresh();
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="absolute top-2 right-2 px-1 text-xs text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 focus-visible:opacity-100"
        aria-label={`Delete board ${title}`}
        title="Delete board"
      >
        ✕
      </button>
      {confirming && (
        <ConfirmDeleteDialog
          title={`Delete ${title}?`}
          confirmLabel="Delete board"
          onConfirm={deleteBoard}
          onClose={() => setConfirming(false)}
        >
          {games === 0
            ? "This board has no games."
            : `Its columns and ${games} ${games === 1 ? "game" : "games"} go with it.`}{" "}
          XP you&apos;ve earned stays.
        </ConfirmDeleteDialog>
      )}
    </>
  );
}
