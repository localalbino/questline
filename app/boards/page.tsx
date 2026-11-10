import { getBoardSummaries, MAX_BOARDS_PER_USER } from "@/db/boards";
import { requireVerifiedSession } from "@/lib/session";
import { PageHeader } from "@/ui/components/PageHeader";
import { BoardGrid } from "./BoardGrid";

export default async function BoardsPage() {
  const session = await requireVerifiedSession();
  // No pagination; everyone is limited to a few boards since we don't have much space on Neon's free tier.
  const boards = await getBoardSummaries(session);

  return (
    <main className="flex min-h-dvh flex-col">
      <PageHeader>
        <h1 className="truncate text-lg">Your boards</h1>
        <span className="text-sm text-zinc-600">
          {boards.length}/{MAX_BOARDS_PER_USER}
        </span>
      </PageHeader>
      <BoardGrid boards={boards} boardHref={(id) => `/boards/${id}`} createHref="/boards/create" />
    </main>
  );
}
