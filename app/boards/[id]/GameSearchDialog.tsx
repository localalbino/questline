import type { GameDetails } from "@/lib/igdb-client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { addCardAction, searchGamesAction } from "./actions";
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
  const [search, setSearch] = useState<{ query: string; games: GameDetails[]; hasMore: boolean } | null>(null);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Bumped on every search so responses that arrive after a newer search started are dropped.
  const latestSearch = useRef(0);
  const results = search?.games ?? [];

  useEffect(() => {
    // showModal gives us the backdrop, focus trapping, and Escape to close for free.
    // It also focuses the first focusable element (the close button), so move focus to the search box.
    dialogRef.current?.showModal();
    inputRef.current?.focus();
    return () => clearTimeout(debounce.current);
  }, []);

  async function runSearch(searchQuery: string, offset: number) {
    const request = ++latestSearch.current;
    setSearching(true);
    setError(null);
    const result = await searchGamesAction({ query: searchQuery, offset }).catch(() => ({
      success: false as const,
      error: "Search failed. Try again.",
    }));
    if (request !== latestSearch.current) return;

    setSearching(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSearch((current) => ({
      query: searchQuery,
      games: offset === 0 ? result.data.games : [...(current?.games ?? []), ...result.data.games],
      hasMore: result.data.hasMore,
    }));
  }

  function changeQuery(value: string) {
    setQuery(value);
    clearTimeout(debounce.current);
    const trimmed = value.trim();
    if (!trimmed) {
      latestSearch.current++;
      setSearch(null);
      setSearching(false);
      return;
    }
    // Wait for a pause in typing; IGDB is rate limited and each search costs two requests.
    setSearching(true);
    debounce.current = setTimeout(() => runSearch(trimmed, 0), 300);
  }

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

  let emptyMessage: string | null = null;
  if (!query.trim()) emptyMessage = "Start typing to search IGDB.";
  else if (results.length === 0 && searching) emptyMessage = "Searching…";
  else if (search && results.length === 0) emptyMessage = `No games found for "${search.query}".`;

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
            onChange={(e) => changeQuery(e.target.value)}
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
          {search?.hasMore && (
            <li>
              <button
                type="button"
                disabled={searching}
                onClick={() => runSearch(search.query, search.games.length)}
                className="w-full px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-400 disabled:opacity-50"
              >
                {searching ? "Loading…" : "Load more"}
              </button>
            </li>
          )}
          {emptyMessage && <li className="px-4 py-6 text-center text-sm text-zinc-600">{emptyMessage}</li>}
        </ul>
      </div>
    </dialog>
  );
}
