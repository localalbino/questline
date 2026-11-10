"use client";

import { BoardGrid } from "@/app/boards/BoardGrid";
import { MAX_BOARDS_PER_USER } from "@/lib/limits";
import { PageHeader } from "@/ui/components/PageHeader";
import { useDemo } from "./DemoProvider";
import { summarizeBoards } from "./state";

export default function DemoBoardsPage() {
  const { state } = useDemo();
  const boards = summarizeBoards(state);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader>
        <h1 className="truncate text-lg">Your boards</h1>
        <span className="text-sm text-zinc-600">
          {boards.length}/{MAX_BOARDS_PER_USER}
        </span>
      </PageHeader>
      <BoardGrid boards={boards} boardHref={(id) => `/demo/boards/${id}`} createHref="/demo/boards/create" />
    </main>
  );
}
