import { getBoardSummaries, MAX_BOARDS_PER_USER } from "@/db/boards";
import { requireVerifiedSession } from "@/lib/session";
import { cn } from "cn";
import { PageHeader } from "@/ui/components/PageHeader";
import Link from "next/link";

type BoardSummary = Awaited<ReturnType<typeof getBoardSummaries>>[number];

// Same footprint as a column on the board page.
const tileClassName = "flex h-36 w-72 flex-col p-3";

export default async function BoardsPage() {
  const session = await requireVerifiedSession();
  // No pagination; everyone is limited to a few boards since we don't have much space on Neon's free tier.
  const boards = await getBoardSummaries(session);
  const canCreate = boards.length < MAX_BOARDS_PER_USER;

  return (
    <main className="flex min-h-dvh flex-col">
      <PageHeader>
        <h1 className="truncate text-lg">Your boards</h1>
        <span className="text-sm text-zinc-600">
          {boards.length}/{MAX_BOARDS_PER_USER}
        </span>
      </PageHeader>
      <ul className="flex flex-wrap items-start gap-4 p-4">
        {boards.map((board) => (
          <li key={board.id}>
            <BoardTile board={board} />
          </li>
        ))}
        <li>
          {canCreate ? (
            <Link
              href="/boards/create"
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
    </main>
  );
}

function BoardTile({ board }: { board: BoardSummary }) {
  const progress = board.games === 0 ? 0 : board.completed / board.games;

  return (
    <Link
      href={`/boards/${board.id}`}
      className={cn(tileClassName, "gap-1 bg-zinc-900 hover:ring-1 hover:ring-emerald-500")}
    >
      <span className="truncate text-zinc-400">{board.title}</span>
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
