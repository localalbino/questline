import type { GameDetails } from "@/lib/igdb-client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { addCardAction } from "./actions";
import type { BoardCard } from "./types";

type GameSearchDialogProps = {
  groupId: number;
  groupTitle: string;
  onAdded: (card: BoardCard) => void;
  onClose: () => void;
};

/** Steam-style search popup for adding a game to a column. */
export function GameSearchDialog({ groupId, groupTitle, onAdded, onClose }: GameSearchDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // TODO: debounce `query` and fetch results through a server action wrapping igdbClient.searchByTitle
  // (it returns null when IGDB rate limits us). Paginate with its offset param.
  const results: GameDetails[] = [];

  useEffect(() => {
    // showModal gives us the backdrop, focus trapping, and Escape to close for free.
    // It also focuses the first focusable element (the close button), so move focus to the search box.
    dialogRef.current?.showModal();
    inputRef.current?.focus();
  }, []);

  async function addGame(game: GameDetails) {
    setAddingId(game.id);
    setError(null);
    const result = await addCardAction({ groupId, gameId: game.id });
    setAddingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onAdded(result.data);
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Clicks on the backdrop land on the dialog element itself.
      onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
      className="text-foreground mx-auto mt-24 w-full max-w-xl bg-zinc-900 p-0 shadow-2xl ring-1 ring-zinc-800 backdrop:bg-black/70"
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 text-sm text-zinc-600">
          <span>
            Add a game to <span className="text-zinc-400">{groupTitle}</span>
          </span>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="hover:text-zinc-400"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a game"
            className="w-full bg-zinc-800 px-3 py-2 text-zinc-300 caret-emerald-500 outline-none focus:ring-1 focus:ring-emerald-500"
            aria-label="Search for a game"
          />
        </div>
        {error && <span className="px-4 pb-2 text-sm text-red-400">{error}</span>}
        <ul className="max-h-96 overflow-y-auto border-t border-zinc-800">
          {results.map((game) => (
            <li key={game.id}>
              <button
                type="button"
                disabled={addingId !== null}
                onClick={() => addGame(game)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-zinc-800 disabled:opacity-50"
              >
                {game.boxArtUrl ? (
                  <Image
                    src={game.boxArtUrl}
                    alt=""
                    width={40}
                    height={56}
                    className="h-14 w-10 shrink-0 object-cover"
                  />
                ) : (
                  <div className="h-14 w-10 shrink-0 bg-zinc-800" />
                )}
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{game.title}</span>
                  <span className="truncate text-xs text-zinc-500">
                    {[game.releaseDate?.getFullYear(), game.publishers[0]].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <span className="ml-auto shrink-0 text-emerald-500">{addingId === game.id ? "Adding…" : "+ Add"}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-zinc-600">
              {query.trim() ? "Search isn't hooked up yet." : "Start typing to search IGDB."}
            </li>
          )}
        </ul>
      </div>
    </dialog>
  );
}
