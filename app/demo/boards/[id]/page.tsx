"use client";

import { BoardView } from "@/app/boards/[id]/BoardView";
import { idSchema } from "@/app/boards/[id]/schema";
import { StreakControl, StreakProvider } from "@/app/boards/[id]/StreakControl";
import { PageHeader } from "@/ui/components/PageHeader";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { useDemo } from "../../DemoProvider";

export default function DemoBoardPage() {
  const { id } = useParams<{ id: string }>();
  const { state, revision } = useDemo();
  const parsedId = idSchema.safeParse(Number(id));
  const board = parsedId.success ? state.boards.find((b) => b.id === parsedId.data) : undefined;

  // Like the real page's props, which only change on a refresh: the board keeps its own optimistic
  // state, so feeding it every store change would apply some edits twice (e.g. an added game).
  // A failed action bumps the revision, which swaps in the store's version.
  const key = `${board?.id}:${revision}`;
  const [snapshot, setSnapshot] = useState({ key, board });
  if (snapshot.key !== key) setSnapshot({ key, board });

  if (!board || !snapshot.board) notFound();

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <StreakProvider initialStreak={snapshot.board.streak}>
        <PageHeader>
          <Link href="/demo" className="shrink-0 text-zinc-600 hover:text-emerald-500">
            ← Boards
          </Link>
          <h1 className="truncate text-lg">{board.title}</h1>
          <div className="ml-auto">
            <StreakControl boardId={board.id} />
          </div>
        </PageHeader>
        <BoardView boardId={board.id} initialGroups={snapshot.board.groups} />
      </StreakProvider>
    </main>
  );
}
