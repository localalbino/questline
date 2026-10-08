import { getOwnedBoard } from "@/db/boards";
import { requireVerifiedSession } from "@/lib/session";
import { notFound } from "next/navigation";

export default async function BoardPage({ params }: PageProps<"/boards/[id]">) {
  const session = await requireVerifiedSession();

  const boardId = Number((await params).id);
  if (!Number.isSafeInteger(boardId)) {
    notFound();
  }

  // Boards owned by other users 404 rather than 403 so we don't leak which ids exist.
  const board = await getOwnedBoard(session, boardId);
  if (!board) {
    notFound();
  }

  return (
    <main className="m-8 flex flex-col gap-4">
      <h1 className="text-center text-lg">{board.title}</h1>
    </main>
  );
}
