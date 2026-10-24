import { getBoardContents } from "@/db/boards";
import { igdbClient, type GameDetails } from "@/lib/igdb-client";
import { requireVerifiedSession } from "@/lib/session";
import { PageHeader } from "@/ui/components/PageHeader";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardView } from "./BoardView";
import type { BoardGroup } from "./types";

async function getGameDetails(gameIds: number[]): Promise<Map<number, GameDetails> | null> {
  try {
    const games = await igdbClient.getDetailsById(gameIds);
    return games && new Map(games.map((game) => [game.id, game]));
  } catch (error) {
    // The board is still usable without art and titles, so don't take the page down.
    console.error("Failed to load game details from IGDB", error);
    return null;
  }
}

export default async function BoardPage({ params }: PageProps<"/boards/[id]">) {
  const session = await requireVerifiedSession();

  const boardId = Number((await params).id);
  if (!Number.isSafeInteger(boardId)) {
    notFound();
  }

  // Boards owned by other users 404 rather than 403 so we don't leak which ids exist.
  const board = await getBoardContents(session, boardId);
  if (!board) {
    notFound();
  }

  const games = await getGameDetails(board.groups.flatMap((group) => group.cards.map((card) => card.gameId)));
  const groups: BoardGroup[] = board.groups.map((group) => ({
    id: group.id,
    title: group.title,
    cards: group.cards.map((card) => ({
      id: card.id,
      gameId: card.gameId,
      dueDate: card.dueDate,
      isCompleted: card.isCompleted,
      game: games?.get(card.gameId) ?? null,
    })),
  }));

  return (
    <main className="flex h-dvh flex-col">
      <PageHeader>
        <Link href="/boards" className="shrink-0 text-zinc-600 hover:text-emerald-500">
          ← Boards
        </Link>
        <h1 className="truncate text-lg">{board.title}</h1>
        {!games && <span className="truncate text-sm text-red-400">Couldn&apos;t load game details from IGDB</span>}
      </PageHeader>
      <BoardView boardId={board.id} initialGroups={groups} />
    </main>
  );
}
