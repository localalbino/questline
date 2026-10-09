import { db } from "@/db";
import { MAX_BOARDS_PER_USER } from "@/db/boards";
import { boardsTable } from "@/db/schema";
import { requireVerifiedSession } from "@/lib/session";
import { BoardsList } from "@/ui/components/BoardsList";
import { LinkButton } from "@/ui/components/LinkButton";
import { eq } from "drizzle-orm";

export default async function BoardsPage() {
  const session = await requireVerifiedSession();

  const boards = await db
    .select({
      id: boardsTable.id,
      title: boardsTable.title,
    })
    .from(boardsTable)
    .where(eq(boardsTable.ownerId, session?.user.id));

  return (
    <main className="m-8 flex flex-col gap-4 lg:m-96">
      <h1 className="text-center text-lg">Your boards</h1>
      <BoardsList boards={boards} />
      {boards.length < MAX_BOARDS_PER_USER ? (
        <LinkButton href="/boards/create" variant="outline">
          + New board
        </LinkButton>
      ) : (
        <span className="text-center text-zinc-600">You cannot create any more boards</span>
      )}
    </main>
  );
}
