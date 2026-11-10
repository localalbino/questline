import { MAX_BOARDS_PER_USER } from "@/lib/limits";
import { cn } from "cn";
import Link from "next/link";
import { DeleteBoardButton } from "./DeleteBoardButton";

export type BoardSummary = { id: number; title: string; columns: number; games: number; completed: number };

// Same footprint as a column on the board page.
const tileClassName = "flex h-36 w-72 flex-col p-3";

/** The user's board tiles plus a tile for creating another, or a note once they're at the limit. */
export function BoardGrid({
  boards,
  boardHref,
  createHref,
}: {
  boards: BoardSummary[];
  boardHref: (id: number) => string;
  createHref: string;
}) {
  const canCreate = boards.length < MAX_BOARDS_PER_USER;
  return (
    <ul className="flex flex-wrap items-start gap-4 p-4">
      {boards.map((board) => (
        <li key={board.id} className="group relative">
          <BoardTile board={board} href={boardHref(board.id)} />
          <DeleteBoardButton boardId={board.id} title={board.title} games={board.games} />
        </li>
      ))}
      <li>
        {canCreate ? (
          <Link
            href={createHref}
            className={cn(
              tileClassName,
              "justify-center border border-dashed border-zinc-800 text-zinc-600 hover:border-emerald-500 hover:text-emerald-500",
            )}
          >
            {boards.length === 0 ? "+ Create your first board" : "+ New board"}
          </Link>
        ) : (
          <div
            className={cn(tileClassName, "justify-center border border-dashed border-zinc-800 text-sm text-zinc-600")}
          >
            You&apos;ve reached the limit of {MAX_BOARDS_PER_USER} boards.
          </div>
        )}
      </li>
    </ul>
  );
}

function BoardTile({ board, href }: { board: BoardSummary; href: string }) {
  const progress = board.games === 0 ? 0 : board.completed / board.games;
  // Every game beaten. Empty boards don't count.
  const finished = board.games > 0 && board.completed === board.games;

  return (
    <Link
      href={href}
      className={cn(
        tileClassName,
        "gap-1 bg-zinc-900",
        finished ? "ring-1 ring-emerald-500 hover:ring-2" : "hover:ring-1 hover:ring-emerald-500",
      )}
    >
      {/* Right padding keeps the title clear of the delete button. */}
      <span className={cn("truncate pr-5", finished ? "text-emerald-500" : "text-zinc-400")}>{board.title}</span>
      <span className="text-xs text-zinc-600">
        {board.columns} {board.columns === 1 ? "column" : "columns"} · {board.games}{" "}
        {board.games === 1 ? "game" : "games"}
      </span>
      <div className="mt-auto flex flex-col gap-1">
        <span className="text-xs text-zinc-500">
          {board.completed}/{board.games} completed
        </span>
        <div className="h-1 bg-zinc-800">
          <div className="h-full bg-emerald-500" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </Link>
  );
}
